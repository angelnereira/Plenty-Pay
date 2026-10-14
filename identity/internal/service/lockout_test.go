package service_test

import (
	"context"
	"testing"
	"time"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/service"
)

// fakeLockoutStore implementa store.LoginAttemptStore en memoria con la misma
// semantica de bloqueo progresivo que la version PostgreSQL.
type fakeLockoutStore struct {
	failures int
	blocked  *time.Time
	notified bool
}

func (f *fakeLockoutStore) RegisterFailure(_ context.Context, _ string, block time.Duration) (int, *time.Time, error) {
	f.failures++
	if block > 0 {
		until := time.Now().UTC().Add(block)
		f.blocked = &until
	}
	return f.failures, f.blocked, nil
}

func (f *fakeLockoutStore) ResetFailures(_ context.Context, _ string) error {
	f.failures = 0
	f.blocked = nil
	return nil
}

func (f *fakeLockoutStore) CurrentFailures(_ context.Context, _ string) (int, error) {
	return f.failures, nil
}

func (f *fakeLockoutStore) BlockedUntil(_ context.Context, _ string) (*time.Time, error) {
	if f.blocked != nil && f.blocked.After(time.Now()) {
		return f.blocked, nil
	}
	return nil, nil
}

func loginService(t *testing.T) (*service.IdentityService, *fakeLockoutStore, *fakeSessionStore) {
	t.Helper()
	svc, ss, _ := serviceWithSessions(t)
	la := &fakeLockoutStore{}
	svc.WithLockout(la)
	return svc, la, ss
}

func attemptLogin(t *testing.T, svc *service.IdentityService, email, password string) *service.AuthResult {
	t.Helper()
	res, err := svc.Login(context.Background(), email, password)
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	return res
}

// La politica del SPEC §5 R5: 5 -> 1 min, 10 -> 15 min, 20 -> 24 h.
func TestR5_DefaultPolicySteps(t *testing.T) {
	casos := []struct {
		failures int
		block    time.Duration
	}{
		{0, 0}, {4, 0}, {5, time.Minute}, {9, time.Minute},
		{10, 15 * time.Minute}, {19, 15 * time.Minute},
		{20, 24 * time.Hour}, {50, 24 * time.Hour},
	}
	for _, c := range casos {
		got, locked := domain.DefaultLockoutPolicy.BlockFor(c.failures)
		if locked != (c.block > 0) {
			t.Errorf("%d fallos: locked=%v, se esperaba %v", c.failures, locked, c.block > 0)
		}
		if got != c.block {
			t.Errorf("%d fallos: bloqueo %v, se esperaba %v", c.failures, got, c.block)
		}
	}
}

// R5: 5 fallos bloquean 1 min y el 6.º intento (aun con la clave correcta)
// devuelve ACCOUNT_LOCKED (prueba de aceptacion 2 del SPEC §11).
func TestR5_SixthCorrectAttemptIsLocked(t *testing.T) {
	svc, la, _ := loginService(t)
	email := "bloqueo@example.com"
	register(t, svc, email)

	for i := 0; i < 5; i++ {
		res := attemptLogin(t, svc, email, "clave-incorrecta-larga")
		if res.Success {
			t.Fatalf("intento %d con clave incorrecta no deberia entrar", i+1)
		}
	}
	if la.failures != 5 {
		t.Fatalf("se esperaban 5 fallos contados, llegaron %d", la.failures)
	}
	// El sexto intento con la clave CORRECTA sigue bloqueado.
	res := attemptLogin(t, svc, email, "una-clave-muy-larga")
	if res.Success || res.Reason != "ACCOUNT_LOCKED" {
		t.Fatalf("el 6.o intento correcto deberia estar bloqueado, llego %+v", res)
	}
}

// R5: un login exitoso reinicia la cuenta.
func TestR5_SuccessResetsFailures(t *testing.T) {
	svc, la, _ := loginService(t)
	email := "reset@example.com"
	register(t, svc, email)

	for i := 0; i < 3; i++ {
		attemptLogin(t, svc, email, "clave-incorrecta-larga")
	}
	if la.failures != 3 {
		t.Fatalf("se esperaban 3 fallos, llegaron %d", la.failures)
	}
	res := attemptLogin(t, svc, email, "una-clave-muy-larga")
	if !res.Success {
		t.Fatalf("login correcto fallido: %+v", res)
	}
	if la.failures != 0 || la.blocked != nil {
		t.Fatalf("el exito deberia reiniciar la cuenta: failures=%d blocked=%v", la.failures, la.blocked)
	}
}

// R5: cada fallo se reporta a security (F05.5 bloquea por IP).
func TestR5_FailuresReportedToSecurity(t *testing.T) {
	svc, _, sec := serviceWithSessions(t)
	svc.WithLockout(&fakeLockoutStore{})
	register(t, svc, "reporte@example.com")

	attemptLogin(t, svc, "reporte@example.com", "clave-incorrecta-larga")
	// Correo inexistente: tambien se reporta (subject desconocido).
	attemptLogin(t, svc, "no-existe@example.com", "clave-incorrecta-larga")

	sec.mu.Lock()
	defer sec.mu.Unlock()
	if len(sec.hits) != 2 {
		t.Fatalf("se esperaban 2 reportes LOGIN_FAILED a security, llegaron %d (%v)", len(sec.hits), sec.hits)
	}
}

// R5: al alcanzar el ultimo escalon se pide la notificacion a la persona
// (evento en el outbox; el mensaje notifications.SendRequest llega en F20.2).
func TestR5_TopStepRequestsNotification(t *testing.T) {
	svc, la, ss := loginService(t)
	register(t, svc, "notif@example.com")

	// Falsificar el contador para llegar al escalon de 20 sin 20 logins.
	la.failures = 19
	attemptLogin(t, svc, "notif@example.com", "clave-incorrecta-larga")

	ss.mu.Lock()
	defer ss.mu.Unlock()
	if len(ss.outbox) == 0 {
		t.Fatal("se esperaba la solicitud de notificacion en el outbox")
	}
	if ss.outbox[len(ss.outbox)-1] != "pp.identity.notification.requested.v1" {
		t.Fatalf("subject inesperado: %v", ss.outbox)
	}
}
