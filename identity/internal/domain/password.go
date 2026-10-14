package domain

import "errors"

// Errores del dominio de contrasenas (F08.7).
var (
	ErrResetTokenUnknown = errors.New("token de recuperacion desconocido")
	ErrResetTokenUsed    = errors.New("el token de recuperacion ya fue usado")
	ErrResetTokenExpired = errors.New("el token de recuperacion vencio")
	ErrSamePassword      = errors.New("la contrasena nueva debe ser distinta a la actual")
)
