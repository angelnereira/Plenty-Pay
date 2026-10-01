package auth

import (
	"strings"
	"testing"
)

func TestHashVerifyRoundTrip(t *testing.T) {
	h := NewTestingHasher()
	hash, err := h.Hash("s3creta-Correcta!")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if !strings.HasPrefix(hash, "$argon2id$v=") {
		t.Fatalf("formato PHC esperado, got: %s", hash)
	}
	if !h.Verify("s3creta-Correcta!", hash) {
		t.Fatal("la contraseña correcta debe verificar")
	}
	if h.Verify("incorrecta", hash) {
		t.Fatal("la contraseña incorrecta NO debe verificar")
	}
}

func TestHashUniquenessPerCall(t *testing.T) {
	// Salt aleatorio por hash: dos hashes de la misma contraseña difieren.
	h := NewTestingHasher()
	h1, _ := h.Hash("x")
	h2, _ := h.Hash("x")
	if h1 == h2 {
		t.Fatal("el salt por llamada debe producir hashes distintos")
	}
}

func TestVerifyMalformedHashIsFalse(t *testing.T) {
	// Fail secure: hash malformado => false, nunca panic.
	h := NewTestingHasher()
	for _, bad := range []string{"", "bcrypt$...", "argon2id$v=99$m=1,t=1,p=1$xx$yy", "argon2id$v=19$m=1,t=1,p=1$!!!$???"} {
		if h.Verify("x", bad) {
			t.Fatalf("hash malformado no debe verificar: %q", bad)
		}
	}
}
