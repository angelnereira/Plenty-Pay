package domain

import (
	"errors"
	"fmt"
)

// Reasons del contenedor; el texto viaja al cliente traducido desde el glosario.
var (
	ErrBelowMinimumWage  = errors.New("BELOW_MINIMUM_WAGE")
	ErrInvalidEmployee   = errors.New("INVALID_EMPLOYEE")
	ErrCiphertextMissing = errors.New("CIPHERTEXT_MISSING")
)

// PayType y PayFrequency salen de docs/glossary.md §1.
const (
	PayTypeSalary = "SALARY"
	PayTypeHourly = "HOURLY"

	PayFrequencyWeekly      = "WEEKLY"
	PayFrequencyBiweekly    = "BIWEEKLY"
	PayFrequencySemimonthly = "SEMIMONTHLY"
	PayFrequencyMonthly     = "MONTHLY"
)

// Employee (F19.1). La cédula solo existe como ciphertext + versión de clave:
// nunca en claro, nunca devuelta completa (N-DAT-04, SPEC §4).
type Employee struct {
	ID                    string
	TenantID              string
	UserID                string
	FullName              string
	NationalIDCiphertext  []byte
	NationalIDKeyVersion  string
	Position              string
	PayType               string
	BaseSalaryMinor       int64
	HourlyRateMinor       int64
	PayFrequency          string
	GeofenceID            string
	HasGeofence           bool
	Active                bool
	LegalParamsVersionTag string
}

func (e Employee) Validate() error {
	if e.TenantID == "" || e.FullName == "" {
		return ErrInvalidEmployee
	}
	switch e.PayType {
	case PayTypeSalary:
		if e.BaseSalaryMinor <= 0 {
			return ErrInvalidEmployee
		}
	case PayTypeHourly:
		if e.HourlyRateMinor <= 0 {
			return ErrInvalidEmployee
		}
	default:
		return ErrInvalidEmployee
	}
	switch e.PayFrequency {
	case PayFrequencyWeekly, PayFrequencyBiweekly, PayFrequencySemimonthly, PayFrequencyMonthly:
	default:
		return ErrInvalidEmployee
	}
	return nil
}

// ValidateSalaryLegal comprueba el salario mínimo vigente recibido como parámetro
// (AGENTS.md §2.13: ningún valor legal en código; el mínimo llega en minimumWageMinor
// con la versión del parámetro legal, no como constante).
func (e Employee) ValidateSalaryLegal(minimumWageMinor int64) error {
	if e.PayType != PayTypeSalary {
		return nil
	}
	if e.BaseSalaryMinor < minimumWageMinor {
		return fmt.Errorf("%w: below minimum wage (%s)", ErrBelowMinimumWage, e.LegalParamsVersionTag)
	}
	return nil
}

// View sin cédula: lo único que sale del contenedor (SPEC §4).
type EmployeeView struct {
	ID           string
	FullName     string
	Position     string
	PayType      string
	PayFrequency string
	Active       bool
}

func (e Employee) View() EmployeeView {
	return EmployeeView{
		ID:           e.ID,
		FullName:     e.FullName,
		Position:     e.Position,
		PayType:      e.PayType,
		PayFrequency: e.PayFrequency,
		Active:       e.Active,
	}
}
