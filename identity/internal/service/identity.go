// Package service tiene los casos de uso de identity: orquesta dominio, store,
// emision de tokens y eventos (go-standards.md seccion 2). No conoce gRPC ni
// JSON: el adaptador es server. Toda funcion de E/S recibe ctx primero.
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/store"
)

// ConsentGrant es una aceptacion tal como la entrega quien se registra.
type ConsentGrant struct {
	Purpose     string
	TextVersion string
	Granted     bool
	Channel     string
	Device      string
}

// AuthResult es el resultado de registro/login/refresh (sin tokens fallidos).
type AuthResult struct {
	Success      bool
	Reason       string
	ErrorMessage string
	UserID       string
	TenantID     string
	Role         string
	AccessToken  string
	RefreshToken string
}

// Claims validados de un access token.
type Claims struct {
	UserID   string
	TenantID string
	Role     string
}

// Permissions es el resultado de GetUserPermissions (R10).
type Permissions struct {
	Role           string
	EnabledModules []string
	Permissions    []string
}

// IdentityService implementa los casos de uso sobre la interfaz del store.
type IdentityService struct {
	users    store.UserStore
	tokens   *auth.TokenIssuer
	reporter *observability.Reporter
	metrics  *observability.Metrics
	// now es el reloj inyectado (go-standards.md 3.3): time.Now solo en main.
	now func() time.Time
}

// New construye el servicio. reporter y metrics pueden ser nil en pruebas.
func New(users store.UserStore, tokens *auth.TokenIssuer, reporter *observability.Reporter, metrics *observability.Metrics) *IdentityService {
	return &IdentityService{users: users, tokens: tokens, reporter: reporter, metrics: metrics, now: time.Now}
}

// WithClock inyecta el reloj (pruebas deterministas).
func (s *IdentityService) WithClock(now func() time.Time) *IdentityService {
	s.now = now
	return s
}

// Purposes de consentimiento que acepta el registro publico (R18).
var (
	PurposeAgeConfirmation = "AGE_CONFIRMATION"
	PurposeTerms           = "TERMS"
	PurposePrivacy         = "PRIVACY_DATA_PROCESSING"
	PurposeMarketing       = "MARKETING"
	AllPurposes            = []string{PurposeAgeConfirmation, PurposeTerms, PurposePrivacy, PurposeMarketing}
)

// RegisterInput agrupa lo que llega del registro publico. Now es el reloj del
// servidor (go-standards.md 3.3): el servicio no llama a time.Now por su cuenta.
type RegisterInput struct {
	Email    string
	Password string
	FullName string
	Role     string
	TenantID string
	Consents []ConsentGrant
	Now      time.Time
}

// Register crea la cuenta y emite tokens (R1, R2, R6, R18).
func (s *IdentityService) Register(ctx context.Context, in RegisterInput) (*AuthResult, error) {
	if err := domain.ValidateEmail(domain.NormalizeEmail(in.Email)); err != nil {
		return reject("INVALID_EMAIL", "correo invalido"), nil
	}
	if err := domain.ValidatePassword(in.Password); err != nil {
		return reject("WEAK_PASSWORD", "la contrasena debe tener entre 12 y 128 caracteres"), nil
	}
	records, reason := ValidateConsents(in.Consents, in.Now)
	if reason != "" {
		return reject(reason, consentMessage(reason)), nil
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		if s.reporter != nil {
			s.reporter.Defect(ctx, "password hashing failed", observability.Wrap(err, "hash password"))
		}
		return internal(), nil
	}
	user := &domain.User{
		Email: domain.NormalizeEmail(in.Email), PasswordHash: hash, FullName: in.FullName,
		Role: in.Role, TenantID: in.TenantID, Consents: records,
	}
	if err := s.users.Create(ctx, user); err != nil {
		if errors.Is(err, domain.ErrEmailTaken) {
			return reject("EMAIL_TAKEN", "ese correo ya esta registrado"), nil
		}
		if s.reporter != nil {
			s.reporter.Defect(ctx, "user creation failed", observability.Wrap(err, "create user"))
		}
		return internal(), nil
	}
	return s.issueTokens(ctx, user)
}

// Login autentica (R4: mismo error exista o no el correo).
func (s *IdentityService) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	user, err := s.users.FindByEmail(ctx, domain.NormalizeEmail(email))
	if err != nil || !auth.VerifyPassword(password, user.PasswordHash) {
		if s.metrics != nil {
			s.metrics.Inc("pp_logins_total", "result", "failure")
		}
		return reject("INVALID_CREDENTIALS", "correo o contrasena incorrectos"), nil
	}
	if s.metrics != nil {
		s.metrics.Inc("pp_logins_total", "result", "success")
	}
	return s.issueTokens(ctx, user)
}

// ValidateAccessToken verifica el access token (R9).
func (s *IdentityService) ValidateAccessToken(accessToken string) (*Claims, error) {
	claims, err := s.tokens.VerifyAccessToken(accessToken)
	if err != nil {
		return nil, err
	}
	return &Claims{UserID: claims.UserID, TenantID: claims.TenantID, Role: claims.Role}, nil
}

// PermissionsForUser devuelve rol, permisos y modulos derivados (R10).
func (s *IdentityService) PermissionsForUser(ctx context.Context, userID string) (*Permissions, error) {
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	perms := auth.PermissionsFor(user.Role)
	return &Permissions{Role: user.Role, EnabledModules: auth.ModulesForPermissions(perms), Permissions: perms}, nil
}

// Refresh rota el refresh token (F08.3 añade rotacion y deteccion de reuso).
func (s *IdentityService) Refresh(ctx context.Context, refreshToken string) (*AuthResult, error) {
	claims, err := s.tokens.VerifyRefreshToken(refreshToken)
	if err != nil {
		return reject("TOKEN_INVALID", "refresh token invalido o expirado"), nil
	}
	user, err := s.users.FindByID(ctx, claims.UserID)
	if err != nil {
		return reject("NOT_FOUND", "usuario no encontrado"), nil
	}
	return s.issueTokens(ctx, user)
}

func (s *IdentityService) issueTokens(ctx context.Context, user *domain.User) (*AuthResult, error) {
	access, err := s.tokens.IssueAccessToken(user.ID, user.TenantID, user.Role)
	if err != nil {
		if s.reporter != nil {
			s.reporter.Defect(ctx, "access token issuance failed", observability.Wrap(err, "issue access token"))
		}
		return internal(), nil
	}
	refresh, err := s.tokens.IssueRefreshToken(user.ID, user.TenantID, user.Role)
	if err != nil {
		if s.reporter != nil {
			s.reporter.Defect(ctx, "refresh token issuance failed", observability.Wrap(err, "issue refresh token"))
		}
		return internal(), nil
	}
	return &AuthResult{
		Success: true, AccessToken: access, RefreshToken: refresh,
		UserID: user.ID, TenantID: user.TenantID, Role: user.Role,
	}, nil
}

// ValidateConsents aplica R18: sin edad confirmada no hay cuenta; los terminos y
// la privacidad se comprueban por separado. Devuelve los registros a guardar o
// el `reason` estable del rechazo. now sella la fecha del servidor.
func ValidateConsents(grants []ConsentGrant, now time.Time) ([]domain.ConsentRecord, string) {
	byPurpose := map[string]ConsentGrant{}
	for _, g := range grants {
		for _, p := range AllPurposes {
			if g.Purpose == p {
				byPurpose[p] = g
			}
		}
	}
	accepted := func(p string) bool {
		g, ok := byPurpose[p]
		return ok && g.Granted && g.TextVersion != ""
	}
	if !accepted(PurposeAgeConfirmation) {
		return nil, "AGE_REQUIREMENT"
	}
	for _, p := range []string{PurposeTerms, PurposePrivacy} {
		if !accepted(p) {
			return nil, "CONSENT_REQUIRED"
		}
	}
	records := make([]domain.ConsentRecord, 0, len(byPurpose))
	for _, p := range AllPurposes {
		g, ok := byPurpose[p]
		if !ok {
			continue
		}
		records = append(records, domain.ConsentRecord{
			Purpose: p, TextVersion: g.TextVersion, Granted: g.Granted,
			Channel: g.Channel, Device: g.Device,
			RecordedAt: now.UTC(),
		})
	}
	return records, ""
}

func consentMessage(reason string) string {
	if reason == "AGE_REQUIREMENT" {
		return "debes confirmar que tienes al menos 18 anos"
	}
	return "debes aceptar los terminos y la politica de privacidad"
}

func reject(reason, message string) *AuthResult {
	return &AuthResult{Success: false, Reason: reason, ErrorMessage: message}
}

func internal() *AuthResult {
	return &AuthResult{Success: false, ErrorMessage: "error interno"}
}

// ErrorEnvuelto es un helper de claridad para los tests del paquete.
func ErrorEnvuelto(op string, err error) error {
	return fmt.Errorf("%s: %w", op, err)
}

var _ = strings.TrimSpace
