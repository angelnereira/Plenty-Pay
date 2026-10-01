// Package password implementa hash y verificación de contraseñas con
// Argon2id (recomendación OWASP para entornos fintech; mandato §13).
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	// Parámetros Argon2id por defecto (línea base OWASP 2024+: m=64MiB, t=3, p=4).
	// En tests se usan parámetros reducidos para velocidad.
	argonTime       uint32 = 3
	argonMemoryKiB  uint32 = 64 * 1024
	argonThreads    uint8  = 4
	argonKeyLen     uint32 = 32
	argonSaltLen    uint32 = 16
	hashEncodingFmt        = "$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s"
)

var ErrInvalidPassword = errors.New("credenciales inválidas")

// PasswordHasher hashea y verifica contraseñas de forma segura.
type PasswordHasher struct {
	time, memory uint32
	threads      uint8
	keyLen       uint32
	saltLen      uint32
}

func NewPasswordHasher() *PasswordHasher {
	return &PasswordHasher{
		time: argonTime, memory: argonMemoryKiB, threads: argonThreads,
		keyLen: argonKeyLen, saltLen: argonSaltLen,
	}
}

// NewTestingHasher usa parámetros reducidos — SOLO para tests (declarado
// explícitamente; nunca en producción).
func NewTestingHasher() *PasswordHasher {
	return &PasswordHasher{
		time: 1, memory: 8 * 1024, threads: 2,
		keyLen: argonKeyLen, saltLen: argonSaltLen,
	}
}

// Hash genera un hash Argon2id con salt aleatorio por contraseña.
// Formato PHC estándar, auto-verificable a futuro.
func (h *PasswordHasher) Hash(password string) (string, error) {
	salt := make([]byte, h.saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generando salt: %w", err)
	}
	key := argon2.IDKey([]byte(password), salt, h.time, h.memory, h.threads, h.keyLen)
	return fmt.Sprintf(hashEncodingFmt,
		argon2.Version, h.memory, h.time, h.threads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

// Verify compara en tiempo constante. Devuelve true solo si coincide.
func (h *PasswordHasher) Verify(password, encodedHash string) bool {
	parts := strings.Split(encodedHash, "$")
	// ["", "argon2id", "v=19", "m=..,t=..,p=..", salt, key]
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false
	}
	var m uint32
	var t uint32
	var p uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &m, &t, &p); err != nil {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false
	}
	got := argon2.IDKey([]byte(password), salt, t, m, p, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1
}
