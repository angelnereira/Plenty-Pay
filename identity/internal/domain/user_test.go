package domain_test

import (
	"strings"
	"testing"

	"plentypay/identity/internal/domain"
)

// R1: el correo se normaliza (recorta y minusculas).
func TestR1_NormalizeEmail(t *testing.T) {
	casos := map[string]string{
		"  Ana@Example.COM  ": "ana@example.com",
		"a@b.co":              "a@b.co",
		"":                    "",
	}
	for in, want := range casos {
		if got := domain.NormalizeEmail(in); got != want {
			t.Errorf("NormalizeEmail(%q) = %q, se esperaba %q", in, got, want)
		}
	}
}

// R1: correos sin @, sin dominio o demasiado largos se rechazan.
func TestR1_ValidateEmail(t *testing.T) {
	validos := []string{"ana@example.com", "a.b+c@sub.dominio.co"}
	for _, e := range validos {
		if err := domain.ValidateEmail(e); err != nil {
			t.Errorf("ValidateEmail(%q) = %v, se esperaba valido", e, err)
		}
	}
	invalidos := []string{"", "sin-arroba", "@example.com", "ana@", "ana@example", "ana@.com", "ana@example."}
	for _, e := range invalidos {
		if err := domain.ValidateEmail(e); err == nil {
			t.Errorf("ValidateEmail(%q) paso como valido", e)
		}
	}
	// Limite de 254 caracteres (R1).
	if err := domain.ValidateEmail(strings.Repeat("a", 250) + "@example.com"); err == nil {
		t.Error("un correo de mas de 254 caracteres deberia rechazarse")
	}
}

// R2: entre 12 y 128 caracteres contando runes (no bytes).
func TestR2_ValidatePassword(t *testing.T) {
	if err := domain.ValidatePassword(strings.Repeat("a", 12)); err != nil {
		t.Errorf("12 caracteres deberia ser valido: %v", err)
	}
	if err := domain.ValidatePassword(strings.Repeat("a", 128)); err != nil {
		t.Errorf("128 caracteres deberia ser valido: %v", err)
	}
	if err := domain.ValidatePassword(strings.Repeat("a", 11)); err == nil {
		t.Error("11 caracteres deberia rechazarse")
	}
	if err := domain.ValidatePassword(strings.Repeat("a", 129)); err == nil {
		t.Error("129 caracteres deberia rechazarse")
	}
	// Runes multibyte: 12 acentos son 12 caracteres, no 24 bytes.
	if err := domain.ValidatePassword(strings.Repeat("á", 12)); err != nil {
		t.Errorf("12 runes multibyte deberian ser validos: %v", err)
	}
}
