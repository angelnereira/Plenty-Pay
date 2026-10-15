package auth

import (
	"errors"
	"testing"
	"time"
)

func TestStepUp_HappyPathSingleUse(t *testing.T) {
	mgr := NewStepUpManager()
	now := time.Now().UTC()
	mgr.now = func() time.Time { return now }

	chID, _ := mgr.IssueChallenge("usr-1", "payout.confirm", 50000, "USD")
	token, _, err := mgr.VerifyChallenge(chID, []byte("{}"))
	if err != nil {
		t.Fatalf("VerifyChallenge: %v", err)
	}
	if len(token) == 0 {
		t.Fatal("token no debe estar vacío")
	}

	// 1er consumo -> válido
	valid, reason := mgr.ConsumeToken(token, "usr-1", "payout.confirm", 50000, "USD")
	if !valid || reason != "" {
		t.Fatalf("primer consumo debe ser válido, obtuve valid=%v reason=%s", valid, reason)
	}

	// 2do consumo -> ALREADY_USED
	valid, reason = mgr.ConsumeToken(token, "usr-1", "payout.confirm", 50000, "USD")
	if valid || reason != "ALREADY_USED" {
		t.Fatalf("segundo consumo debe fallar con ALREADY_USED, obtuve valid=%v reason=%s", valid, reason)
	}
}

func TestStepUp_Mismatch(t *testing.T) {
	mgr := NewStepUpManager()
	chID, _ := mgr.IssueChallenge("usr-1", "payment.high_amount", 100000, "USD")
	token, _, err := mgr.VerifyChallenge(chID, []byte("{}"))
	if err != nil {
		t.Fatal(err)
	}

	// Monto distinto -> MISMATCH
	valid, reason := mgr.ConsumeToken(token, "usr-1", "payment.high_amount", 99999, "USD")
	if valid || reason != "MISMATCH" {
		t.Fatalf("esperaba MISMATCH por monto distinto, obtuve %s", reason)
	}

	// Operación distinta -> MISMATCH
	valid, reason = mgr.ConsumeToken(token, "usr-1", "otra.operacion", 100000, "USD")
	if valid || reason != "MISMATCH" {
		t.Fatalf("esperaba MISMATCH por operacion distinta, obtuve %s", reason)
	}

	// Usuario distinto -> MISMATCH
	valid, reason = mgr.ConsumeToken(token, "usr-2", "payment.high_amount", 100000, "USD")
	if valid || reason != "MISMATCH" {
		t.Fatalf("esperaba MISMATCH por usuario distinto, obtuve %s", reason)
	}
}

func TestStepUp_ExpiredAndNotFound(t *testing.T) {
	mgr := NewStepUpManager()
	currentTime := time.Now().UTC()
	mgr.now = func() time.Time { return currentTime }

	chID, _ := mgr.IssueChallenge("usr-1", "op", 100, "USD")
	token, _, err := mgr.VerifyChallenge(chID, []byte("{}"))
	if err != nil {
		t.Fatal(err)
	}

	// Avanzar reloj 6 minutos (TTL = 5 min)
	currentTime = currentTime.Add(6 * time.Minute)

	valid, reason := mgr.ConsumeToken(token, "usr-1", "op", 100, "USD")
	if valid || reason != "EXPIRED" {
		t.Fatalf("esperaba EXPIRED, obtuve %s", reason)
	}

	// Token inexistente
	valid, reason = mgr.ConsumeToken("no-existe", "usr-1", "op", 100, "USD")
	if valid || reason != "NOT_FOUND" {
		t.Fatalf("esperaba NOT_FOUND, obtuve %s", reason)
	}

	// Reto inexistente
	_, _, err = mgr.VerifyChallenge("challenge-inexistente", []byte("{}"))
	if !errors.Is(err, ErrChallengeNotFound) {
		t.Fatalf("esperaba ErrChallengeNotFound, obtuve %v", err)
	}
}
