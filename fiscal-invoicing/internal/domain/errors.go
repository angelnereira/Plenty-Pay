// Package domain tiene las reglas puras de la facturación electrónica (fiscal-invoicing/SPEC.md §5):
// sin E/S, sin reloj propio, sin dependencias de infraestructura.
package domain

import "errors"

// Errores esperables; el servidor los traduce a código gRPC y `reason` (docs/glossary.md §7.3).
var (
	ErrNotFound          = errors.New("documento o registro no encontrado")
	ErrProfileMissing    = errors.New("el negocio no tiene perfil fiscal")
	ErrInvalidRUC        = errors.New("RUC o DV con formato inválido")
	ErrInvalidTaxpayer   = errors.New("datos del receptor inválidos")
	ErrTotalsMismatch    = errors.New("los totales no cuadran")
	ErrInvalidTaxRate    = errors.New("tasa de ITBMS fuera de las vigentes")
	ErrPacNotConfigured  = errors.New("no hay un PAC real configurado para el entorno de producción")
	ErrInvalidRequest    = errors.New("solicitud inválida")
	ErrPermissionDenied  = errors.New("sin permiso")
	ErrNoTenant          = errors.New("la operación requiere un negocio")
	ErrStepUpRequired    = errors.New("requiere confirmación fuerte")
	ErrStepUpInvalid     = errors.New("confirmación fuerte inválida")
	ErrDependency        = errors.New("dependencia no disponible")
	ErrIdempotencyReused = errors.New("clave de idempotencia reutilizada con otro contenido")
)
