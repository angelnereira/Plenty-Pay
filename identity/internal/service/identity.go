// Package service tiene los casos de uso de identity: orquesta dominio, store,
// emision de tokens y eventos (go-standards.md seccion 2). No conoce gRPC ni
// JSON: el adaptador es server. Toda funcion de E/S recibe ctx primero.
package service

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/store"
	"plentypay/identity/internal/tenancy"
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
	SessionID    string
	AccessToken  string
	RefreshToken string
}

// Claims validados de un access token.
type Claims struct {
	UserID    string
	TenantID  string
	Role      string
	SessionID string
}

// Permissions es el resultado de GetUserPermissions (R10).
type Permissions struct {
	Role           string
	EnabledModules []string
	Permissions    []string
}

// SecurityReporter reporta eventos de abuso a `security`: TOKEN_REUSE (R8) y
// LOGIN_FAILED (F05.5, bloqueo por IP).
type SecurityReporter interface {
	ReportTokenReuse(ctx context.Context, userID, ip string) error
	ReportLoginFailed(ctx context.Context, userID, ip string) error
}

// revocationCache evita consultar la base en cada request (R9). Guarda dos
// estados: sesiones sabidas VIVAS (TTL <= 15 s, como pide la regla) y sesiones
// REVOCADAS (sin TTL: revocar es permanente). Revocar invalida la entrada viva.
type revocationCache struct {
	ttl     time.Duration
	mu      sync.Mutex
	alive   map[string]time.Time
	revoked map[string]struct{}
}

func newRevocationCache(ttl time.Duration) *revocationCache {
	return &revocationCache{ttl: ttl, alive: map[string]time.Time{}, revoked: map[string]struct{}{}}
}

// freshAlive indica si la sesion se sabe viva y la consulta es reciente.
func (c *revocationCache) freshAlive(sessionID string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	at, ok := c.alive[sessionID]
	return ok && time.Since(at) < c.ttl
}

// markAlive registra la sesion como viva.
func (c *revocationCache) markAlive(sessionID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.revoked, sessionID)
	c.alive[sessionID] = time.Now()
}

// markRevoked registra la revocacion e invalida la entrada viva.
func (c *revocationCache) markRevoked(sessionID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.revoked[sessionID] = struct{}{}
	delete(c.alive, sessionID)
}

// isRevoked consulta el estado cacheado de revocacion.
func (c *revocationCache) isRevoked(sessionID string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.revoked[sessionID]
	return ok
}

// IdentityService implementa los casos de uso sobre la interfaz del store.
type IdentityService struct {
	users    store.UserStore
	sessions store.SessionStore      // nil = sin sesiones (pruebas/E2E sin BD)
	attempts store.LoginAttemptStore // nil = sin bloqueo progresivo
	tenants  store.TenantStore       // nil = sin tenants (pruebas)
	lockout  domain.LockoutPolicy
	tokens   *auth.TokenIssuer
	reporter *observability.Reporter
	metrics  *observability.Metrics
	security SecurityReporter
	revoked  *revocationCache
	// now es el reloj inyectado (go-standards.md 3.3): time.Now solo en main.
	now func() time.Time
}

// New construye el servicio. reporter y metrics pueden ser nil en pruebas.
func New(users store.UserStore, tokens *auth.TokenIssuer, reporter *observability.Reporter, metrics *observability.Metrics) *IdentityService {
	return &IdentityService{
		users: users, tokens: tokens, reporter: reporter, metrics: metrics,
		revoked: newRevocationCache(15 * time.Second),
		lockout: domain.DefaultLockoutPolicy,
		now:     time.Now,
	}
}

// WithTenants activa la gestion de negocios (F08.5).
func (s *IdentityService) WithTenants(ts store.TenantStore) *IdentityService {
	s.tenants = ts
	return s
}

// WithLockout activa el bloqueo progresivo (R5).
func (s *IdentityService) WithLockout(la store.LoginAttemptStore) *IdentityService {
	s.attempts = la
	return s
}

// WithLockoutPolicy inyecta otra escalera (pruebas).
func (s *IdentityService) WithLockoutPolicy(p domain.LockoutPolicy) *IdentityService {
	s.lockout = p
	return s
}

// WithSessions activa sesiones con rotacion de refresh (R8/R9).
func (s *IdentityService) WithSessions(ss store.SessionStore) *IdentityService {
	s.sessions = ss
	return s
}

// WithSecurityReporter activa el reporte de TOKEN_REUSE a `security`.
func (s *IdentityService) WithSecurityReporter(r SecurityReporter) *IdentityService {
	s.security = r
	return s
}

// WithRevocationTTL ajusta el TTL de la cache de revocacion (pruebas).
func (s *IdentityService) WithRevocationTTL(d time.Duration) *IdentityService {
	s.revoked = newRevocationCache(d)
	return s
}

// WithClock inyecta el reloj (pruebas deterministas).
func (s *IdentityService) WithClock(now func() time.Time) *IdentityService {
	s.now = now
	return s
}

// startSession abre sesion (o devuelve "" si el servicio corre sin sesiones).
func (s *IdentityService) startSession(ctx context.Context, userID string) string {
	if s.sessions == nil {
		return ""
	}
	session, err := s.sessions.CreateSession(ctx, userID)
	if err != nil {
		if s.reporter != nil {
			s.reporter.Defect(ctx, "session creation failed", observability.Wrap(err, "create session"))
		}
		return ""
	}
	return session.ID
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
		ID:    uuid.NewString(),
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
	return s.issueTokens(ctx, user, s.startSession(ctx, user.ID))
}

// Login autentica (R4: mismo error exista o no el correo) y aplica el bloqueo
// progresivo (R5).
func (s *IdentityService) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	user, err := s.users.FindByEmail(ctx, domain.NormalizeEmail(email))
	if err != nil {
		// R4: se compara contra un hash ficticio para gastar el mismo tiempo.
		auth.VerifyPassword(password, auth.DummyHash)
		s.reportLoginFailed(ctx, "", ipFromContext(ctx))
		if s.metrics != nil {
			s.metrics.Inc("pp_logins_total", "result", "failure")
		}
		return reject("INVALID_CREDENTIALS", "correo o contrasena incorrectos"), nil
	}
	if !auth.VerifyPassword(password, user.PasswordHash) {
		locked := s.registerFailure(ctx, user.ID)
		if s.metrics != nil {
			s.metrics.Inc("pp_logins_total", "result", "failure")
		}
		if locked {
			return reject("ACCOUNT_LOCKED", "cuenta bloqueada temporalmente por intentos fallidos"), nil
		}
		return reject("INVALID_CREDENTIALS", "correo o contrasena incorrectos"), nil
	}
	// Credenciales correctas: si la cuenta sigue bloqueada, no entra (R5).
	if s.attempts != nil {
		if until, _ := s.attempts.BlockedUntil(ctx, user.ID); until != nil {
			return reject("ACCOUNT_LOCKED", "cuenta bloqueada temporalmente por intentos fallidos"), nil
		}
		_ = s.attempts.ResetFailures(ctx, user.ID) // R5: el exito reinicia la cuenta
	}
	if s.metrics != nil {
		s.metrics.Inc("pp_logins_total", "result", "success")
	}
	return s.issueTokens(ctx, user, s.startSession(ctx, user.ID))
}

// registerFailure cuenta el fallo y devuelve true si la cuenta queda bloqueada.
// Ademas reporta a `security` y, en el ultimo escalon, pide la notificacion (R5).
func (s *IdentityService) registerFailure(ctx context.Context, userID string) bool {
	block, locked := time.Duration(0), false
	if s.attempts != nil {
		current, err := s.attempts.CurrentFailures(ctx, userID)
		if err != nil && s.reporter != nil {
			s.reporter.Defect(ctx, "failure count failed", observability.Wrap(err, "current failures"))
		}
		block, locked = s.lockout.BlockFor(current + 1)
		_, until, err := s.attempts.RegisterFailure(ctx, userID, block)
		if err != nil && s.reporter != nil {
			s.reporter.Defect(ctx, "failure register failed", observability.Wrap(err, "register failure"))
			return false
		}
		if until != nil && until.After(time.Now()) {
			locked = true
		}
		if s.lockout.NotifiesAt(current+1) && s.sessions != nil {
			_ = s.sessions.WriteOutboxEvent(ctx, "pp.identity.notification.requested.v1", userID, "",
				notificationPayload(userID, "ACCOUNT_LOCKED"))
		}
	}
	s.reportLoginFailed(ctx, userID, ipFromContext(ctx))
	return locked
}

// reportLoginFailed reporta el fallo a `security` (F05.5: bloqueo por IP).
func (s *IdentityService) reportLoginFailed(ctx context.Context, userID, ip string) {
	if s.security == nil {
		return
	}
	if err := s.security.ReportLoginFailed(ctx, userID, ip); err != nil && s.reporter != nil {
		s.reporter.Defect(ctx, "security report failed", observability.Wrap(err, "report login failed"))
	}
}

// notificationPayload es la solicitud de correo provisional (SPEC §6; el mensaje
// notifications.SendRequest se agrega en F20.2).
func notificationPayload(userID, reason string) []byte {
	b, _ := json.Marshal(map[string]any{"user_id": userID, "event": reason})
	return b
}

// ipFromContext lee la IP del llamador de los metadatos (F09.2 la poblará).
func ipFromContext(ctx context.Context) string { return tenancy.IPFromContext(ctx) }

// ValidateAccessToken verifica el access token (R9): ademas de la firma, la
// sesion no puede estar revocada. La cache TTL <= 15 s evita consultar la base
// en cada request sin dejar tokens revocados validos mas de ese plazo.
func (s *IdentityService) ValidateAccessToken(ctx context.Context, accessToken string) (*Claims, error) {
	claims, err := s.tokens.VerifyAccessToken(accessToken)
	if err != nil {
		return nil, err
	}
	if s.sessions != nil && claims.SessionID != "" {
		if err := s.assertSessionAlive(ctx, claims.SessionID); err != nil {
			return nil, err
		}
	}
	return &Claims{UserID: claims.UserID, TenantID: claims.TenantID, Role: claims.Role, SessionID: claims.SessionID}, nil
}

func (s *IdentityService) assertSessionAlive(ctx context.Context, sessionID string) error {
	if s.revoked.isRevoked(sessionID) {
		return domain.ErrSessionRevoked
	}
	if s.revoked.freshAlive(sessionID) {
		return nil // vista viva hace menos del TTL
	}
	session, err := s.sessions.SessionByID(ctx, sessionID)
	if err != nil {
		return err
	}
	if session.Revoked() {
		s.revoked.markRevoked(sessionID)
		return domain.ErrSessionRevoked
	}
	s.revoked.markAlive(sessionID)
	return nil
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

// Refresh rota el refresh token (R8): cada uso emite uno nuevo e invalida el
// anterior. Presentar uno ya usado revoca la familia completa, publica
// SessionRevoked y reporta TOKEN_REUSE a `security`.
func (s *IdentityService) Refresh(ctx context.Context, refreshToken string) (*AuthResult, error) {
	claims, err := s.tokens.VerifyRefreshToken(refreshToken)
	if err != nil {
		return reject("TOKEN_INVALID", "refresh token invalido o expirado"), nil
	}
	if s.sessions == nil || claims.SessionID == "" {
		user, err := s.users.FindByID(ctx, claims.UserID)
		if err != nil {
			return reject("NOT_FOUND", "usuario no encontrado"), nil
		}
		return s.issueTokens(ctx, user, claims.SessionID)
	}

	sessionID, reused, err := s.sessions.ConsumeRefreshToken(ctx, hashToken(refreshToken))
	if err != nil {
		if errors.Is(err, domain.ErrRefreshTokenUnknown) {
			return reject("TOKEN_INVALID", "refresh token invalido o expirado"), nil
		}
		if s.reporter != nil {
			s.reporter.Defect(ctx, "refresh consumption failed", observability.Wrap(err, "consume refresh token"))
		}
		return internal(), nil
	}
	if reused {
		return s.handleReuse(ctx, claims, sessionID), nil
	}

	// Primera rotacion: la sesion sigue viva y el token consumido ya no sirve.
	session, err := s.sessions.SessionByID(ctx, sessionID)
	if err != nil || session.Revoked() {
		return reject("SESSION_REVOKED", "la sesion fue revocada"), nil
	}
	user, err := s.users.FindByID(ctx, session.UserID)
	if err != nil {
		return reject("NOT_FOUND", "usuario no encontrado"), nil
	}
	return s.issueTokens(ctx, user, sessionID)
}

// handleReuse aplica R8: revoca la familia, publica el evento y reporta a security.
func (s *IdentityService) handleReuse(ctx context.Context, claims *auth.Claims, sessionID string) *AuthResult {
	if err := s.sessions.RevokeSession(ctx, sessionID, domain.RevokedReasonReuse); err != nil && s.reporter != nil {
		s.reporter.Defect(ctx, "session revocation failed", observability.Wrap(err, "revoke session"))
	}
	s.revoked.markRevoked(sessionID)
	// ADR 0012: el evento se escribe en el outbox junto con el efecto.
	_ = s.sessions.WriteOutboxEvent(ctx, "pp.identity.session.revoked.v1", sessionID, claims.TenantID,
		sessionRevokedPayload(claims.UserID, []string{sessionID}, domain.RevokedReasonReuse))
	if s.security != nil {
		if err := s.security.ReportTokenReuse(ctx, claims.UserID, ""); err != nil && s.reporter != nil {
			s.reporter.Defect(ctx, "security report failed", observability.Wrap(err, "report token reuse"))
		}
	}
	if s.metrics != nil {
		s.metrics.Inc("pp_session_reuse_total", "reason", domain.RevokedReasonReuse)
	}
	return reject("SESSION_REVOKED", "la sesion fue revocada por seguridad")
}

// sessionRevokedPayload serializa el evento SessionRevoked (identity.proto §6).
// El envelope canonico llegara con el relay del outbox (F08.5); hoy JSON.
func sessionRevokedPayload(userID string, sessionIDs []string, reason string) []byte {
	b, _ := json.Marshal(map[string]any{
		"user_id":     userID,
		"session_ids": sessionIDs,
		"reason":      reason,
	})
	return b
}

func (s *IdentityService) issueTokens(ctx context.Context, user *domain.User, sessionID string) (*AuthResult, error) {
	access, err := s.tokens.IssueAccessToken(sessionID, user.ID, user.TenantID, user.Role)
	if err != nil {
		if s.reporter != nil {
			s.reporter.Defect(ctx, "access token issuance failed", observability.Wrap(err, "issue access token"))
		}
		return internal(), nil
	}
	refresh, err := s.tokens.IssueRefreshToken(sessionID, user.ID, user.TenantID, user.Role)
	if err != nil {
		if s.reporter != nil {
			s.reporter.Defect(ctx, "refresh token issuance failed", observability.Wrap(err, "issue refresh token"))
		}
		return internal(), nil
	}
	// El refresh se guarda solo como hash (R8).
	if s.sessions != nil && sessionID != "" {
		if err := s.sessions.IssueRefreshToken(ctx, sessionID, user.ID, hashToken(refresh), time.Now().UTC().Add(30*24*time.Hour)); err != nil && s.reporter != nil {
			s.reporter.Defect(ctx, "refresh token registration failed", observability.Wrap(err, "register refresh token"))
		}
	}
	return &AuthResult{
		Success: true, AccessToken: access, RefreshToken: refresh,
		UserID: user.ID, TenantID: user.TenantID, Role: user.Role, SessionID: sessionID,
	}, nil
}

// hashToken es el sha256 del refresh: la base nunca guarda el valor util.
func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
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
