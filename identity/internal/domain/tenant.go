package domain

import (
	"errors"
	"strings"
	"time"
)

// Estados de tenant (enum TenantStatus del .proto).
const (
	TenantPendingReview = "PENDING_REVIEW"
	TenantActive        = "ACTIVE"
	TenantSuspended     = "SUSPENDED"
	TenantRejected      = "REJECTED"
)

// Errores del dominio de tenants, perfiles y capacidades.
var (
	ErrTenantNotFound      = errors.New("tenant no encontrado")
	ErrTenantAlreadyExists = errors.New("el usuario ya tiene un negocio")
	ErrTaxIDTaken          = errors.New("el RUC ya está registrado")
	ErrInvalidTaxID        = errors.New("RUC inválido")
	ErrInvalidTransition   = errors.New("transición de estado inválida")
	ErrVerticalNotFound    = errors.New("vertical comercial no encontrada")
	ErrPlanLimitReached    = errors.New("límite del plan alcanzado")
	ErrCapabilityDisabled  = errors.New("capacidad desactivada para este negocio")
	ErrCapabilityGated     = errors.New("capacidad sujeta a validación legal pendiente")
	ErrUnknownCapability   = errors.New("capacidad desconocida")
	ErrUnknownTrait        = errors.New("rasgo operativo desconocido")
	ErrTooManyVerticals    = errors.New("se permiten hasta 2 verticales secundarias distintas de la principal")
)

// CapabilityState representa el estado de una capacidad en un comercio (R21).
type CapabilityState struct {
	Capability string
	Enabled    bool
	Source     string // VERTICAL | TRAIT | MANUAL | PLAN
}

// Tenant es el negocio (comercio) de PlentyPay.
type Tenant struct {
	ID                 string
	LegalName          string
	TradeName          string
	TaxID              string
	DV                 string
	Status             string
	Country            string
	ReviewNotes        string
	OwnerID            string
	PrimaryVertical    string
	SecondaryVerticals []string
	TraitOverrides     map[string]bool
	PlanCode           string
	Version            int32
	BranchName         string // Nombre inicial de la sucursal matriz 0000 en el alta
	Capabilities       []CapabilityState
	CreatedAt          time.Time
	Documents          []string
}

// NormalizeTaxId quita espacios y pasa a mayúsculas (R17: único sin distinguir).
func NormalizeTaxId(taxID string) string {
	return strings.ToUpper(strings.TrimSpace(taxID))
}

// ValidateTaxId comprueba el formato del RUC panameño: 2 letras + 8 dígitos
// (p. ej. "155612345-2-2023" o la forma simple "8-1-1234"). R17 exige además DV
// válido, pero el algoritmo de DV se implementa en F08.6: aquí solo formato y
// presencia de DV cuando aplica.
func ValidateTaxId(taxID, dv string) error {
	clean := strings.ReplaceAll(NormalizeTaxId(taxID), "-", "")
	if len(clean) < 5 {
		return ErrInvalidTaxID
	}
	// Debe contener al menos 5 dígitos y empezar por letra o dígito.
	digits := 0
	for _, r := range clean {
		switch {
		case r >= '0' && r <= '9':
			digits++
		case r >= 'A' && r <= 'Z':
		default:
			return ErrInvalidTaxID
		}
	}
	if digits < 5 || digits > 15 {
		return ErrInvalidTaxID
	}
	if dv != "" && len([]rune(dv)) > 3 {
		return ErrInvalidTaxID
	}
	return nil
}

// NextStatus aplica la máquina de estados del dominio (dominio-model.md §3.3):
//
//	PENDING_REVIEW --approve--> ACTIVE
//	PENDING_REVIEW --reject---> REJECTED
//	ACTIVE         --reject---> SUSPENDED   (suspensión)
//	SUSPENDED      --approve--> ACTIVE       (reactivación)
//
// Cualquier otra transición (incluidas las que salen de REJECTED, que es
// terminal) devuelve ErrInvalidTransition.
func NextStatus(current string, approve bool) (string, error) {
	switch current {
	case TenantPendingReview:
		if approve {
			return TenantActive, nil
		}
		return TenantRejected, nil
	case TenantSuspended:
		if approve {
			return TenantActive, nil
		}
		return "", ErrInvalidTransition
	case TenantActive:
		if approve {
			return "", ErrInvalidTransition // ya está activo
		}
		return TenantSuspended, nil
	default:
		return "", ErrInvalidTransition
	}
}
