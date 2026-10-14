package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/service"
	"plentypay/identity/internal/store"
)

// fakePasswordStore implementa store.PasswordStore en memoria.
type fakePasswordStore struct {
	resets      map[string]*domain.Invitation // reutiliza expires/used para el test
	changed     map[string]string             // userID -> hash
	keptSession string
	revokeAll   bool
	changedAt   map[string]time.Time
	failConsume error
}

func newFakePasswordStore() *fakePasswordStore {
	return &fakePasswordStore{
		resets:    map[string]*domain.Invitation{},
		changed:   map[string]string{},
		changedAt: map[string]time.Time{},
	}
}

func (f *fakePasswordStore) CreatePasswordReset(_ context.Context, userID string) (string, time.Time, error) {
	token := "reset-" + userID
	f.resets[token] = &domain.Invitation{
		ID: token, Email: userID, ExpiresAt: time.Now().UTC().Add(30 * time.Minute),
	}
	return token, f.resets[token].ExpiresAt, nil
}

func (f *fakePasswordStore) ConsumePasswordReset(_ context.Context, token string) (string, error) {
	if f.failConsume != nil {
		return "", f.failConsume
	}
	inv, ok := f.resets[token]
	if !ok {
		return "", domain.ErrResetTokenUnknown
	}
	if inv.AcceptedAt != nil {
		return "", domain.ErrResetTokenUsed
	}
	if inv.ExpiresAt.Before(time.Now()) {
		return "", domain.ErrResetTokenExpired
	}
	now := time.Now().UTC()
	inv.AcceptedAt = &now
	return inv.Email, nil
}

func (f *fakePasswordStore) ChangePassword(_ context.Context, userID, newHash, keepSessionID string) error {
	f.changed[userID] = newHash
	f.changedAt[userID] = time.Now().UTC()
	f.keptSession = keepSessionID
	if keepSessionID == "" {
		f.revokeAll = true
	}
	return nil
}

func (f *fakePasswordStore) PasswordChangedAt(_ context.Context, userID string) (*time.Time, error) {
	at, ok := f.changedAt[userID]
	if !ok {
		return nil, nil
	}
	return &at, nil
}

func passwordService(t *testing.T) (*service.IdentityService, *fakePasswordStore) {
	t.Helper()
	svc, _, _ := serviceWithSessions(t)
	ps := newFakePasswordStore()
	svc.WithPasswords(ps)
	return svc, ps
}

// R16: cambiar la contrasena conserva la sesion actual y revoca las demas.
func TestR16_ChangePasswordKeepsCurrentSession(t *testing.T) {
	svc, _, ss := passwordServiceWithSessions(t)
	ps := newFakePasswordStore()
	svc.WithPasswords(ps)
	email := "cambio@example.com"
	userID := register(t, svc, email).UserID

	res, err := svc.ChangePassword(context.Background(), userID, "una-clave-muy-larga", "otra-clave-muy-larga-2", "sesion-actual")
	if err != nil || !res.Success {
		t.Fatalf("ChangePassword: %v %+v", err, res)
	}
	if ps.changed[userID] == "" {
		t.Fatal("no se aplico el hash nuevo")
	}
	if ps.keptSession != "sesion-actual" {
		t.Fatalf("la sesion actual deberia conservarse, se guardo %q", ps.keptSession)
	}
	if ps.revokeAll {
		t.Fatal("un cambio voluntario no deberia revocar todas las sesiones")
	}
	// El evento de sesiones revocadas queda en el outbox (ADR 0012).
	ss.mu.Lock()
	defer ss.mu.Unlock()
	if len(ss.outbox) == 0 {
		t.Fatal("se esperaba el evento SessionRevoked en el outbox")
	}
}

// R: la contrasena actual incorrecta no cambia nada.
func TestR16_ChangePassword_WrongCurrent(t *testing.T) {
	svc, _, _ := passwordServiceWithSessions(t)
	ps := newFakePasswordStore()
	svc.WithPasswords(ps)
	email := "clave-mala@example.com"
	userID := register(t, svc, email).UserID

	res, err := svc.ChangePassword(context.Background(), userID, "no-es-la-clave", "otra-clave-muy-larga-2", "")
	if err != nil {
		t.Fatalf("ChangePassword: %v", err)
	}
	if res.Success || res.Reason != "INVALID_CREDENTIALS" {
		t.Fatalf("se esperaba INVALID_CREDENTIALS, llego %+v", res)
	}
	if ps.changed[userID] != "" {
		t.Fatal("no deberia haberse cambiado la contrasena")
	}
}

// R: contrasena nueva debil se rechaza antes de tocar nada.
func TestR16_ChangePassword_WeakNew(t *testing.T) {
	svc, _, _ := passwordServiceWithSessions(t)
	ps := newFakePasswordStore()
	svc.WithPasswords(ps)
	email := "debil-nueva@example.com"
	userID := register(t, svc, email).UserID

	res, _ := svc.ChangePassword(context.Background(), userID, "una-clave-muy-larga", "corta", "")
	if res.Success || res.Reason != "WEAK_PASSWORD" {
		t.Fatalf("se esperaba WEAK_PASSWORD, llego %+v", res)
	}
	if ps.changed[userID] != "" {
		t.Fatal("una contrasena debil no deberia aplicarse")
	}
}

// SPEC §4: el reset de un correo inexistente responde igual que uno valido.
func TestR16_RequestPasswordReset_UnknownEmail(t *testing.T) {
	svc, _, _ := passwordServiceWithSessions(t)
	ps := newFakePasswordStore()
	svc.WithPasswords(ps)
	res, err := svc.RequestPasswordReset(context.Background(), "no-existe@example.com")
	if err != nil || !res.Success {
		t.Fatalf("RequestPasswordReset: %v %+v", err, res)
	}
	if len(ps.resets) != 0 {
		t.Fatal("no deberia crearse ningun token para un correo inexistente")
	}
}

// R16: el reset revoca TODAS las sesiones (no hay sesion actual que conservar).
func TestR16_ConfirmPasswordReset_RevokesAllSessions(t *testing.T) {
	svc, _, _ := passwordServiceWithSessions(t)
	ps := newFakePasswordStore()
	svc.WithPasswords(ps)
	register(t, svc, "reset@example.com")
	res, err := svc.RequestPasswordReset(context.Background(), "reset@example.com")
	if err != nil || !res.Success {
		t.Fatalf("RequestPasswordReset: %v %+v", err, res)
	}
	if len(ps.resets) != 1 {
		t.Fatalf("se esperaba 1 token de reset, llegaron %d", len(ps.resets))
	}
	token := ""
	for k := range ps.resets {
		token = k
	}

	out, err := svc.ConfirmPasswordReset(context.Background(), token, "clave-nueva-muy-larga")
	if err != nil || !out.Success {
		t.Fatalf("ConfirmPasswordReset: %v %+v", err, out)
	}
	if !ps.revokeAll {
		t.Fatal("el reset deberia revocar todas las sesiones (R16)")
	}
	if ps.keptSession != "" {
		t.Fatalf("el reset no deberia conservar ninguna sesion, conservo %q", ps.keptSession)
	}

	// Token de un solo uso.
	again, _ := svc.ConfirmPasswordReset(context.Background(), token, "otra-clave-nueva-larga")
	if again.Success || again.Reason != "TOKEN_INVALID" {
		t.Fatalf("el token no deberia reusarse: %+v", again)
	}
}

// El reset vence a los 30 minutos (SPEC §4).
func TestR16_ResetTokenExpiry30Min(t *testing.T) {
	svc, _, _ := passwordServiceWithSessions(t)
	ps := newFakePasswordStore()
	// Token vencido: se falsifica la expiracion.
	ps.failConsume = domain.ErrResetTokenExpired
	res, err := svc.ConfirmPasswordReset(context.Background(), "reset-cualquiera", "clave-nueva-muy-larga")
	if err != nil {
		t.Fatalf("ConfirmPasswordReset: %v", err)
	}
	if res.Success || res.Reason != "TOKEN_INVALID" {
		t.Fatalf("un token vencido deberia ser TOKEN_INVALID, llego %+v", res)
	}
}

// Un token desconocido se rechaza sin revelar detalles.
func TestR16_ConfirmPasswordReset_UnknownToken(t *testing.T) {
	svc, _, _ := passwordServiceWithSessions(t)
	ps := newFakePasswordStore()
	svc.WithPasswords(ps)
	res, _ := svc.ConfirmPasswordReset(context.Background(), "token-inventado", "clave-nueva-muy-larga")
	if res.Success || res.Reason != "TOKEN_INVALID" {
		t.Fatalf("se esperaba TOKEN_INVALID, llego %+v", res)
	}
}

var (
	_                     = errors.Is
	_ store.PasswordStore = (*fakePasswordStore)(nil)
)

// passwordServiceWithSessions devuelve servicio, store de contrasenas ya puesto
// y el store de sesiones (para verificar el outbox).
func passwordServiceWithSessions(t *testing.T) (*service.IdentityService, *fakePasswordStore, *fakeSessionStore) {
	t.Helper()
	svc, ss, _ := serviceWithSessions(t)
	ps := newFakePasswordStore()
	svc.WithPasswords(ps)
	return svc, ps, ss
}
