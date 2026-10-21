package domain

import (
	"errors"
	"slices"
	"testing"
	"time"
)

// R27: el catálogo de security-standards.md §4.1 — nivel 2 con PASSKEY o PIN, nivel 3 con PASSWORD.
func TestR27_CatalogLevelsAndMethods(t *testing.T) {
	for _, op := range []string{OpPaymentsIntentCreate, OpPaymentsRefund, OpWalletTransfer, OpPosSaleVoid,
		OpPayrollRunPay, OpSettlementDestinationUpdate, OpRoleUpsert, OpPasswordChange, OpPasskeyRevoke} {
		p, err := PolicyFor(op, false)
		if err != nil || p.Level != 2 || !slices.Equal(p.Methods, []string{MethodPasskey, MethodPIN}) {
			t.Fatalf("%s: %+v %v", op, p, err)
		}
		if p.Allows(MethodPassword) {
			t.Fatalf("%s: la contraseña solo vale en nivel 3", op)
		}
	}
	if p, _ := PolicyFor(OpPinSet, true); p.Level != 3 || p.Allows(MethodPIN) || !p.Allows(MethodPassword) {
		t.Fatalf("identity.pin.set: %+v", p)
	}
	if p, _ := PolicyFor(OpPasskeyRegister, false); p.Level != 3 || !slices.Equal(p.Methods, []string{MethodPassword}) {
		t.Fatalf("primera passkey: %+v", p)
	}
	if p, _ := PolicyFor(OpPasskeyRegister, true); p.Level != 2 || !p.Allows(MethodPasskey) || !p.Allows(MethodPIN) {
		t.Fatalf("passkey adicional: %+v", p)
	}
	if _, err := PolicyFor("payout.confirm", false); !errors.Is(err, ErrUnknownOperation) {
		t.Fatalf("operación desconocida: %v", err)
	}
}

// R28: el PIN son exactamente 6 dígitos ASCII.
func TestR28_ValidatePIN(t *testing.T) {
	for _, ok := range []string{"000000", "482915"} {
		if ValidatePIN(ok) != nil {
			t.Fatalf("%q es válido", ok)
		}
	}
	for _, bad := range []string{"", "12345", "1234567", " 12345", "12-456", "١٢٣٤٥٦"} {
		if !errors.Is(ValidatePIN(bad), ErrPinFormat) {
			t.Fatalf("%q no es válido", bad)
		}
	}
}

// R28: tres fallos bloquean LockFor; un bloqueo vencido reinicia el contador.
func TestR28_PinStateAfterFailure(t *testing.T) {
	p := PinPolicy{MaxAttempts: 3, LockFor: 5 * time.Minute}
	now := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	s := PinState{}
	for i := 1; i <= 2; i++ {
		s = s.AfterFailure(p, now)
		if s.FailedAttempts != i || s.LockedAt(now) || s.AttemptsRemaining(p, now) != 3-i {
			t.Fatalf("fallo %d: %+v", i, s)
		}
	}
	s = s.AfterFailure(p, now)
	if !s.LockedAt(now) || !s.LockedUntil.Equal(now.Add(5*time.Minute)) || s.AttemptsRemaining(p, now) != 0 {
		t.Fatalf("el tercer fallo bloquea: %+v", s)
	}
	later := now.Add(5 * time.Minute)
	if s.LockedAt(later) || s.AttemptsRemaining(p, later) != 3 {
		t.Fatalf("vencido el bloqueo vuelve a haber 3 intentos: %+v", s)
	}
	s = s.AfterFailure(p, later)
	if s.FailedAttempts != 1 || s.LockedUntil != nil {
		t.Fatalf("tras un bloqueo vencido el contador empieza de nuevo: %+v", s)
	}
}
