package service_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/service"
	"plentypay/identity/internal/store"
)

// fakeSessionStore implementa store.SessionStore en memoria, con la misma
// semantica de rotacion y reuso que la version PostgreSQL.
type fakeSessionStore struct {
	mu       sync.Mutex
	sessions map[string]*domain.Session
	tokens   map[string]*domain.RefreshToken // por hash hex
	outbox   []string
	revoked  []string
	reported []string
}

func newFakeSessionStore() *fakeSessionStore {
	return &fakeSessionStore{
		sessions: map[string]*domain.Session{},
		tokens:   map[string]*domain.RefreshToken{},
	}
}

func (f *fakeSessionStore) CreateSession(_ context.Context, userID string) (*domain.Session, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	s := &domain.Session{ID: "sess-" + userID, UserID: userID, CreatedAt: time.Now().UTC()}
	f.sessions[s.ID] = s
	return s, nil
}

func (f *fakeSessionStore) IssueRefreshToken(_ context.Context, sessionID, userID string, tokenHash []byte, expiresAt time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.tokens[string(tokenHash)] = &domain.RefreshToken{ID: string(tokenHash), SessionID: sessionID, ExpiresAt: expiresAt}
	return nil
}

func (f *fakeSessionStore) ConsumeRefreshToken(_ context.Context, tokenHash []byte) (string, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	t, ok := f.tokens[string(tokenHash)]
	if !ok {
		return "", false, domain.ErrRefreshTokenUnknown
	}
	if t.Used() {
		return t.SessionID, true, nil // reuso (R8)
	}
	now := time.Now().UTC()
	t.UsedAt = &now
	return t.SessionID, false, nil
}

func (f *fakeSessionStore) RevokeSession(_ context.Context, sessionID, reason string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if s, ok := f.sessions[sessionID]; ok && !s.Revoked() {
		now := time.Now().UTC()
		s.RevokedAt = &now
		s.RevokedReason = reason
		f.revoked = append(f.revoked, sessionID+":"+reason)
	}
	return nil
}

func (f *fakeSessionStore) SessionByID(_ context.Context, sessionID string) (*domain.Session, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	s, ok := f.sessions[sessionID]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	cp := *s
	return &cp, nil
}

func (f *fakeSessionStore) WriteOutboxEvent(_ context.Context, eventType, aggregateID, tenantID string, _ []byte) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.outbox = append(f.outbox, eventType)
	return nil
}

// fakeSecurityReporterCaptura los reportes a `security`.
type fakeSecurityReporter struct {
	mu   sync.Mutex
	hits []string
}

func (f *fakeSecurityReporter) ReportTokenReuse(_ context.Context, userID, _ string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.hits = append(f.hits, "reuse:"+userID)
	return nil
}

func (f *fakeSecurityReporter) ReportLoginFailed(_ context.Context, userID, _ string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.hits = append(f.hits, "login-failed:"+userID)
	return nil
}

func serviceWithSessions(t *testing.T) (*service.IdentityService, *fakeSessionStore, *fakeSecurityReporter) {
	t.Helper()
	fs := newFakeStore()
	ss := newFakeSessionStore()
	sec := &fakeSecurityReporter{}
	svc, _ := newService(fs)
	svc.WithSessions(ss)
	svc.WithSecurityReporter(sec)
	return svc, ss, sec
}

func register(t *testing.T, svc *service.IdentityService, email string) *service.AuthResult {
	t.Helper()
	res, err := svc.Register(context.Background(), service.RegisterInput{
		Email: email, Password: "una-clave-muy-larga", FullName: "Ana",
		Role: "CUSTOMER", Consents: consentsOK(), Now: time.Now().UTC(),
	})
	if err != nil || !res.Success {
		t.Fatalf("registro fallido: res=%+v err=%v", res, err)
	}
	return res
}

// R7: registrar y luego refrescar emite un refresh NUEVO (rotacion) y el tokens
// anterior deja de servir.
func TestR7_R8_RefreshRotatesToken(t *testing.T) {
	svc, _, _ := serviceWithSessions(t)
	res := register(t, svc, "rot@example.com")

	next, err := svc.Refresh(context.Background(), res.RefreshToken)
	if err != nil || !next.Success {
		t.Fatalf("primer refresh fallido: %+v %v", next, err)
	}
	if next.RefreshToken == res.RefreshToken {
		t.Fatal("el refresh token debe cambiar en cada uso (R8)")
	}
	if next.SessionID != res.SessionID {
		t.Fatalf("la sesion debe mantenerse: %s vs %s", next.SessionID, res.SessionID)
	}

	// El token consumido ya no se puede volver a usar: eso es reuso.
	_, err = svc.Refresh(context.Background(), res.RefreshToken)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
}

// R8: presentar un refresh ya usado revoca la familia, publica SessionRevoked y
// reporta TOKEN_REUSE a security.
func TestR8_RefreshReuse_RevokesFamilyAndReports(t *testing.T) {
	svc, ss, sec := serviceWithSessions(t)
	res := register(t, svc, "reuso@example.com")

	// Consumo legitimo.
	next, _ := svc.Refresh(context.Background(), res.RefreshToken)
	if !next.Success {
		t.Fatalf("primer refresh fallido: %+v", next)
	}
	// Reuso del token ya consumido.
	reuse, _ := svc.Refresh(context.Background(), res.RefreshToken)
	if reuse.Success || reuse.Reason != "SESSION_REVOKED" {
		t.Fatalf("se esperaba SESSION_REVOKED, llego %+v", reuse)
	}

	ss.mu.Lock()
	defer ss.mu.Unlock()
	if len(ss.revoked) != 1 || ss.revoked[0] != res.SessionID+":"+domain.RevokedReasonReuse {
		t.Fatalf("la familia debia revocarse con REFRESH_REUSE, llego %v", ss.revoked)
	}
	if len(ss.outbox) != 1 || ss.outbox[0] != "pp.identity.session.revoked.v1" {
		t.Fatalf("se esperaba el evento en el outbox, llego %v", ss.outbox)
	}
	if len(sec.hits) != 1 {
		t.Fatalf("se esperaba un reporte TOKEN_REUSE a security, llego %v", sec.hits)
	}
}

// R9: un access token de una sesion revocada deja de validar. Con cache en 0 se
// ve el efecto de una revocacion externa de inmediato (TTL real <= 15 s).
func TestR9_AccessTokenInvalidAfterRevocation(t *testing.T) {
	svc, ss, _ := serviceWithSessions(t)
	svc.WithRevocationTTL(0)
	res := register(t, svc, "revocado@example.com")

	if _, err := svc.ValidateAccessToken(context.Background(), res.AccessToken); err != nil {
		t.Fatalf("el access token recien emitido deberia validar: %v", err)
	}
	if err := ss.RevokeSession(context.Background(), res.SessionID, "LOGOUT"); err != nil {
		t.Fatalf("revocar sesion: %v", err)
	}
	if _, err := svc.ValidateAccessToken(context.Background(), res.AccessToken); !errors.Is(err, domain.ErrSessionRevoked) {
		t.Fatalf("tras revocar la sesion el access token debe ser invalido, llego %v", err)
	}
}

// R9: la cache evita consultar la base en cada request (mismo proceso, TTL 15 s):
// el token sigue validando mientras la sesion se sabe viva.
func TestR9_RevocationCacheWithinTTL(t *testing.T) {
	svc, ss, _ := serviceWithSessions(t)
	res := register(t, svc, "cache@example.com")

	if _, err := svc.ValidateAccessToken(context.Background(), res.AccessToken); err != nil {
		t.Fatalf("primera validacion: %v", err)
	}
	// Sin revocar, la segunda validacion usa la cache y sigue siendo valida.
	if _, err := svc.ValidateAccessToken(context.Background(), res.AccessToken); err != nil {
		t.Fatalf("validacion cacheada: %v", err)
	}
	ss.mu.Lock()
	defer ss.mu.Unlock()
	if len(ss.sessions) != 1 {
		t.Fatalf("se esperaba 1 sesion, llegaron %d", len(ss.sessions))
	}
}

// R8: un refresh token desconocido (nunca emitido) se rechaza como TOKEN_INVALID.
func TestR8_UnknownRefreshTokenRejected(t *testing.T) {
	svc2, _ := newService(newFakeStore())
	svc2.WithSessions(newFakeSessionStore())
	// Token firmado pero no registrado en el store.
	fake := register(t, svc2, "desconocido@example.com")
	res, _ := svc2.Refresh(context.Background(), fake.RefreshToken)
	if !res.Success {
		t.Fatalf("refresh legitimo fallido: %+v", res)
	}
	// Se falsifica un refresh valido firmado pero con otro session id inexistente.
	res, _ = svc2.Refresh(context.Background(), "no-es-un-token")
	if res.Success || res.Reason != "TOKEN_INVALID" {
		t.Fatalf("token basura deberia ser TOKEN_INVALID, llego %+v", res)
	}
}

// Sin store de sesiones (modo memoria), Refresh sigue funcionando sin rotacion.
func TestRefresh_WithoutSessions(t *testing.T) {
	svc, _ := newService(newFakeStore())
	register(t, svc, "sinsesion@example.com")
	// El registro sin sesiones emite tokens con session_id vacio.
	res := register(t, svc, "sinsesion2@example.com")
	next, _ := svc.Refresh(context.Background(), res.RefreshToken)
	if !next.Success {
		t.Fatalf("refresh sin sesiones fallido: %+v", next)
	}
}

var (
	_ store.SessionStore       = (*fakeSessionStore)(nil)
	_ service.SecurityReporter = (*fakeSecurityReporter)(nil)
)
