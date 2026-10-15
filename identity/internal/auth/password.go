package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// Costo 12: más alto que el default de bcrypt (10) porque esto es el guardián de un sistema
// financiero. El costo extra de CPU en login es aceptable; abaratar el hash no lo es.
// (docs/standards/security-standards.md §2)
const bcryptCost = 12

// bcrypt solo consume 72 bytes, pero la política permite contraseñas de hasta 128 caracteres
// (security-standards.md §2, identity/SPEC.md R2), y un carácter no es un byte. La derivación
// estándar (NIST SP 800-63B §5.1.1.2, igual que Django) es resumir con SHA-256 y codificar en
// base64 antes de bcrypt: se mantiene bcrypt costo 12 y no se pierde longitud útil.
// schemeSHA256Bcrypt declara la derivación en el propio hash (security-standards.md §2:
// "el hash guarda su algoritmo"), de modo que migrar a argon2id no rompa las contraseñas vigentes.
// El separador es ":" porque el hash de bcrypt ya empieza por "$".
const schemeSHA256Bcrypt = "sha256-bcrypt:"

// derive es la contraseña que realmente ve bcrypt. No es secreta: transforma, no oculta.
func derive(plain string) []byte {
	sum := sha256.Sum256([]byte(plain))
	return []byte(base64.StdEncoding.EncodeToString(sum[:]))
}

func HashPassword(plain string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword(derive(plain), bcryptCost)
	if err != nil {
		return "", err
	}
	return schemeSHA256Bcrypt + string(hash), nil
}

// VerifyPassword compara en tiempo constante (bcrypt.CompareHashAndPassword).
func VerifyPassword(plain, hash string) bool {
	if !strings.HasPrefix(hash, schemeSHA256Bcrypt) {
		return false // esquema desconocido o hash mal formado: se rechaza en lugar de adivinar
	}
	return bcrypt.CompareHashAndPassword([]byte(strings.TrimPrefix(hash, schemeSHA256Bcrypt)), derive(plain)) == nil
}

// DummyHash es un hash bcrypt valido de una contrasena cualquiera: se usa para
// que el login de un correo inexistente gaste el mismo tiempo que uno real
// (R4: anti-enumeracion por tiempo).
const DummyHash = "sha256-bcrypt:$2a$12$C6UzMDM.H6dfI/f/IKcEe.nIVfXFwFrLLu9Ug5wPQ08lJXRzHnK6u"
