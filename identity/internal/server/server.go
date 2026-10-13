package server

import (
	"context"
	"regexp"
	"strings"
	"time"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/store"
)

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// R2: límites de la contraseña, contados en caracteres (no en bytes: una ñ o un emoji ocupan más de uno).
const (
	minPasswordChars = 12
	maxPasswordChars = 128
	maxEmailChars    = 254 // R1
)

// Finalidades de consentimiento del registro público (N-DAT-02, N-DAT-14; docs/glossary.md §4).
// Una finalidad que no esté aquí se ignora: no es una aceptación de nada que hayamos declarado.
const (
	consentAgeConfirmation = "AGE_CONFIRMATION"
	consentTerms           = "TERMS"
	consentPrivacy         = "PRIVACY_DATA_PROCESSING"
	consentMarketing       = "MARKETING"
)

// consentPurposes en el orden en que se presentan en S-GEN-03 (docs/ux/functional-spec/00-transversal.md).
var consentPurposes = []string{consentAgeConfirmation, consentTerms, consentPrivacy, consentMarketing}

// IdentityServer implementa los RPC ya implementados de identity.proto. Los demás devuelven
// UNIMPLEMENTED (pb.UnimplementedIdentityServer) hasta su paso del roadmap (identity/SPEC.md §12).
type IdentityServer struct {
	pb.UnimplementedIdentityServer
	users    store.UserStore
	tokens   *auth.TokenIssuer
	reporter *observability.Reporter
	metrics  *observability.Metrics
	// now es el reloj del servidor; se inyecta para que las pruebas sean deterministas.
	now func() time.Time
}

// reporter puede ser nil (pruebas): los fallos internos simplemente no se registran.
func NewIdentityServer(users store.UserStore, tokens *auth.TokenIssuer, reporter *observability.Reporter, metrics *observability.Metrics) *IdentityServer {
	return &IdentityServer{users: users, tokens: tokens, reporter: reporter, metrics: metrics, now: time.Now}
}

// R1–R3 (identity/SPEC.md §5).
func (s *IdentityServer) Register(ctx context.Context, req *pb.RegisterRequest) (*pb.AuthResult, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !emailPattern.MatchString(email) || len(email) > maxEmailChars {
		return rejected("INVALID_EMAIL", "correo inválido"), nil
	}
	if n := len([]rune(req.Password)); n < minPasswordChars || n > maxPasswordChars {
		return rejected("WEAK_PASSWORD", "la contraseña debe tener entre 12 y 128 caracteres"), nil
	}
	// N-DAT-02 y N-DAT-14: sin las aceptaciones obligatorias no se crea la cuenta.
	consents, reason := s.recordConsents(req)
	if reason != "" {
		return rejected(reason, consentMessage(reason)), nil
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		s.reporter.Defect(ctx, "password hashing failed", observability.Wrap(err, "hash password"))
		return &pb.AuthResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	user := &store.User{
		Email: email, PasswordHash: hash, FullName: req.FullName,
		Role: req.Role.String(), TenantID: req.TenantId, Consents: consents,
	}
	if err := s.users.Create(ctx, user); err != nil {
		if err == store.ErrEmailTaken {
			return rejected("EMAIL_TAKEN", "ese correo ya está registrado"), nil
		}
		s.reporter.Defect(ctx, "user creation failed", observability.Wrap(err, "create user"))
		return &pb.AuthResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	return s.issueTokens(ctx, user)
}

// consentMessage es el texto que ve la persona; el `reason` estable es lo que traduce la app.
func consentMessage(reason string) string {
	if reason == "AGE_REQUIREMENT" {
		return "debes confirmar que tienes al menos 18 años"
	}
	return "debes aceptar los términos y la política de privacidad"
}

// recordConsents valida las aceptaciones del registro y devuelve los registros a guardar.
// Orden de comprobación: primero la edad (N-DAT-14), después términos y privacidad por separado (N-DAT-02).
func (s *IdentityServer) recordConsents(req *pb.RegisterRequest) ([]store.ConsentRecord, string) {
	byPurpose := map[string]*pb.ConsentGrant{}
	for _, c := range req.Consents {
		if c == nil {
			continue
		}
		for _, purpose := range consentPurposes {
			if c.Purpose == purpose {
				byPurpose[purpose] = c
			}
		}
	}
	// Una aceptación sin la versión del texto que la persona vio no es trazable: no cuenta.
	accepted := func(purpose string) bool {
		c := byPurpose[purpose]
		return c != nil && c.Granted && c.TextVersion != ""
	}
	if !accepted(consentAgeConfirmation) {
		return nil, "AGE_REQUIREMENT"
	}
	for _, purpose := range []string{consentTerms, consentPrivacy} {
		if !accepted(purpose) {
			return nil, "CONSENT_REQUIRED"
		}
	}
	now := s.now().UTC()
	records := make([]store.ConsentRecord, 0, len(byPurpose))
	for _, purpose := range consentPurposes {
		c := byPurpose[purpose]
		if c == nil {
			continue
		}
		records = append(records, store.ConsentRecord{
			Purpose: purpose, TextVersion: c.TextVersion, Granted: c.Granted,
			RecordedAt: now, Channel: req.Channel, Device: req.Device,
		})
	}
	return records, ""
}

// rejected construye un AuthResult fallido con su `reason` estable (docs/glossary.md §7.3).
func rejected(reason, message string) *pb.AuthResult {
	return &pb.AuthResult{Success: false, Reason: reason, ErrorMessage: message}
}

// R4: mismo mensaje si el correo no existe o si la contraseña falla (anti-enumeración).
func (s *IdentityServer) Login(ctx context.Context, req *pb.LoginRequest) (*pb.AuthResult, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	user, err := s.users.FindByEmail(ctx, email)
	if err != nil || !auth.VerifyPassword(req.Password, user.PasswordHash) {
		// §9: `result` lleva solo el resultado, nunca el correo (§2.3 de observabilidad).
		s.metrics.Inc("pp_logins_total", "result", "failure")
		return rejected("INVALID_CREDENTIALS", "correo o contraseña incorrectos"), nil
	}
	s.metrics.Inc("pp_logins_total", "result", "success")
	return s.issueTokens(ctx, user)
}

func (s *IdentityServer) ValidateToken(_ context.Context, req *pb.ValidateTokenRequest) (*pb.ValidateTokenResult, error) {
	claims, err := s.tokens.VerifyAccessToken(req.AccessToken)
	if err != nil {
		return &pb.ValidateTokenResult{Valid: false}, nil
	}
	return &pb.ValidateTokenResult{
		Valid:    true,
		UserId:   claims.UserID,
		TenantId: claims.TenantID,
		Role:     pb.UserRole(pb.UserRole_value[claims.Role]),
	}, nil
}

func (s *IdentityServer) GetUserPermissions(ctx context.Context, req *pb.GetUserPermissionsRequest) (*pb.UserPermissions, error) {
	user, err := s.users.FindByID(ctx, req.UserId)
	if err != nil {
		return &pb.UserPermissions{}, nil
	}
	// R10: módulos derivados de permisos (security-standards.md §3). Roles personalizados por comercio: F08.6.
	perms := auth.PermissionsFor(user.Role)
	return &pb.UserPermissions{
		Role:           pb.UserRole(pb.UserRole_value[user.Role]),
		EnabledModules: auth.ModulesForPermissions(perms),
		Permissions:    perms,
	}, nil
}

// R6: un access token nunca sirve como refresh token (secretos distintos).
func (s *IdentityServer) RefreshToken(ctx context.Context, req *pb.RefreshTokenRequest) (*pb.AuthResult, error) {
	claims, err := s.tokens.VerifyRefreshToken(req.RefreshToken)
	if err != nil {
		return rejected("TOKEN_INVALID", "refresh token inválido o expirado"), nil
	}
	user, err := s.users.FindByID(ctx, claims.UserID)
	if err != nil {
		return rejected("NOT_FOUND", "usuario no encontrado"), nil
	}
	return s.issueTokens(ctx, user)
}

func (s *IdentityServer) issueTokens(ctx context.Context, user *store.User) (*pb.AuthResult, error) {
	access, err := s.tokens.IssueAccessToken(user.ID, user.TenantID, user.Role)
	if err != nil {
		s.reporter.Defect(ctx, "access token issuance failed", observability.Wrap(err, "issue access token"))
		return &pb.AuthResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	refresh, err := s.tokens.IssueRefreshToken(user.ID, user.TenantID, user.Role)
	if err != nil {
		s.reporter.Defect(ctx, "refresh token issuance failed", observability.Wrap(err, "issue refresh token"))
		return &pb.AuthResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	return &pb.AuthResult{
		Success: true, AccessToken: access, RefreshToken: refresh,
		UserId: user.ID, TenantId: user.TenantID, Role: pb.UserRole(pb.UserRole_value[user.Role]),
	}, nil
}
