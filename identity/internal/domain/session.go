package domain

import (
	"errors"
	"time"
)

// Errores del dominio de sesiones (R8, R9).
var (
	ErrRefreshTokenUnknown = errors.New("refresh token desconocido")
	ErrRefreshTokenReuse   = errors.New("refresh token ya utilizado: sesion revocada")
	ErrSessionRevoked      = errors.New("sesion revocada")
)

// Session es una sesion de usuario (un dispositivo/conexion). Revocarla invalida
// todos sus refresh tokens y sus access tokens (R8, R9).
type Session struct {
	ID            string
	UserID        string
	CreatedAt     time.Time
	RevokedAt     *time.Time
	RevokedReason string
}

// Revoked indica si la sesion esta revocada.
func (s *Session) Revoked() bool { return s.RevokedAt != nil }

// RefreshToken es un refresh emitido para una sesion. Se guarda como hash.
type RefreshToken struct {
	ID        string
	SessionID string
	TokenHash []byte
	IssuedAt  time.Time
	UsedAt    *time.Time
	ExpiresAt time.Time
}

// Used indica si el token ya roto (R8).
func (t *RefreshToken) Used() bool { return t.UsedAt != nil }

// RevokedReasonReuse es el reason con el que se revoca una familia al detectar
// reuso de refresh (R8).
const RevokedReasonReuse = "REFRESH_REUSE"
