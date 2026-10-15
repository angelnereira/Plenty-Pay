package auth

import (
	"strings"
	"testing"
)

func TestR2_HashPasswordDeclaresItsSchemeAndVerifies(t *testing.T) {
	hash, err := HashPassword("contraseña-larga-123456")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !strings.HasPrefix(hash, schemeSHA256Bcrypt+"$2a$12$") {
		t.Fatalf("el hash debe declarar esquema y costo 12: %q", hash)
	}
	if !VerifyPassword("contraseña-larga-123456", hash) {
		t.Fatal("VerifyPassword rechazó la contraseña correcta")
	}
	if VerifyPassword("otra-contraseña-larga-789", hash) {
		t.Fatal("VerifyPassword aceptó una contraseña incorrecta")
	}
}

// R2 permite hasta 128 caracteres, pero bcrypt solo consume 72 bytes: sin la derivación
// SHA-256 estos casos fallarían con "password length exceeds 72 bytes".
func TestR2_PasswordsOfUpTo128CharactersWork(t *testing.T) {
	for name, plain := range map[string]string{
		"72 bytes exactos":     strings.Repeat("x", 72),
		"128 ascii":            strings.Repeat("x", 128),
		"128 caracteres multi": strings.Repeat("ñ", 128), // 256 bytes
		"128 emojis":           strings.Repeat("😀", 128), // 512 bytes
	} {
		t.Run(name, func(t *testing.T) {
			hash, err := HashPassword(plain)
			if err != nil {
				t.Fatalf("HashPassword: %v", err)
			}
			if !VerifyPassword(plain, hash) {
				t.Fatal("una contraseña dentro de la política debe verificarse")
			}
			if VerifyPassword(plain+"x", hash) {
				t.Fatal("VerifyPassword aceptó una contraseña distinta")
			}
		})
	}
}

func TestVerifyPassword_RejectsMalformedOrUnknownScheme(t *testing.T) {
	correct, err := HashPassword("contraseña-larga-123456")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	bcryptOnly := strings.TrimPrefix(correct, schemeSHA256Bcrypt)
	for name, hash := range map[string]string{
		"sin esquema":   bcryptOnly,
		"esquema ajeno": "argon2id:" + bcryptOnly,
		"vacío":         "",
		"basura":        "no-es-un-hash",
	} {
		t.Run(name, func(t *testing.T) {
			if VerifyPassword("contraseña-larga-123456", hash) {
				t.Fatalf("VerifyPassword aceptó un hash inválido (%q)", hash)
			}
		})
	}
}
