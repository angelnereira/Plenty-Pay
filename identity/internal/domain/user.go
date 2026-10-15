// Package domain tiene los tipos y reglas puras de identity. No importa pb,
// SQL, gRPC ni red (go-standards.md seccion 2): aqui vive lo verificable con
// pruebas unitarias, sin base de datos.
package domain

import (
	"errors"
	"strings"
	"time"
)

// Errores tipados del dominio. Los traduce server a status.Error con el
// `reason` estable (grpc-conventions.md seccion 4).
var (
	ErrUserNotFound = errors.New("usuario no encontrado")
	ErrEmailTaken   = errors.New("el correo ya está registrado")
	ErrInvalidEmail = errors.New("correo invalido")
	ErrWeakPassword = errors.New("la contrasena debe tener entre 12 y 128 caracteres")
)

// Constantes de las reglas R1 y R2 del SPEC de identity.
const (
	maxEmailChars    = 254
	minPasswordChars = 12
	maxPasswordChars = 128
)

// ConsentRecord es la evidencia de una aceptacion (N-DAT-02): quien (el usuario
// que lo contiene), para que finalidad, con que version del texto, cuando, por
// que canal y desde que dispositivo. No se borra: revocar agrega Granted=false.
type ConsentRecord struct {
	Purpose     string
	TextVersion string
	Granted     bool
	RecordedAt  time.Time
	Channel     string
	Device      string
}

// User tal como lo guarda identity. La contrasena SIEMPRE llega ya hasheada;
// este paquete nunca ve texto plano.
type User struct {
	ID           string
	Email        string
	PasswordHash string
	FullName     string
	Role         string // valor del enum UserRole del .proto, como string
	TenantID     string
	Consents     []ConsentRecord
}

// NormalizeEmail aplica R1: recorta espacios y pasa a minusculas. El dominio
// compara sin distinguir mayusculas; el store guarda la forma normalizada en
// columna propia con unique.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// ValidateEmail comprueba R1: patron simple y longitud <= 254 sobre el correo
// ya normalizado. Devuelve ErrInvalidEmail si no cumple.
func ValidateEmail(normalizedEmail string) error {
	if normalizedEmail == "" || len(normalizedEmail) > maxEmailChars {
		return ErrInvalidEmail
	}
	at := strings.Index(normalizedEmail, "@")
	if at <= 0 || at == len(normalizedEmail)-1 {
		return ErrInvalidEmail
	}
	domain := normalizedEmail[at+1:]
	if !strings.Contains(domain, ".") || strings.HasPrefix(domain, ".") || strings.HasSuffix(domain, ".") {
		return ErrInvalidEmail
	}
	return nil
}

// ValidatePassword comprueba R2: entre 12 y 128 caracteres (contando runes,
// no bytes: una persona puede usar acentos o emojis).
func ValidatePassword(password string) error {
	n := len([]rune(password))
	if n < minPasswordChars || n > maxPasswordChars {
		return ErrWeakPassword
	}
	return nil
}
