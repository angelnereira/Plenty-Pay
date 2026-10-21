package domain

import (
	"net/mail"
	"strings"
	"time"
)

// Tipos de identificación del receptor (fiscal_invoicing.proto Taxpayer.tax_id_type).
const (
	TaxIDRUCJuridico = "RUC_JURIDICO"
	TaxIDRUCNatural  = "RUC_NATURAL"
	TaxIDCedula      = "CEDULA"
	TaxIDPasaporte   = "PASAPORTE"
	TaxIDExtranjero  = "EXTRANJERO"
)

// Taxpayer es un contribuyente frecuente del negocio (SPEC §3 taxpayers).
type Taxpayer struct {
	ID         string
	TenantID   string
	TaxIDType  string
	TaxID      string
	CheckDigit string
	LegalName  string
	Email      string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// Normalize deja el receptor en el formato que se guarda (N-FMT-05/06, N-FMT-14 correo en minúsculas).
func (t Taxpayer) Normalize() Taxpayer {
	t.TaxIDType = strings.ToUpper(strings.TrimSpace(t.TaxIDType))
	t.TaxID = strings.ToUpper(strings.TrimSpace(t.TaxID))
	t.CheckDigit = strings.TrimSpace(t.CheckDigit)
	t.LegalName = strings.TrimSpace(t.LegalName)
	t.Email = strings.ToLower(strings.TrimSpace(t.Email))
	return t
}

// Validate aplica N-FIS-07: un RUC exige RUC + DV con formato válido; una cédula, N-FMT-05; un
// pasaporte o una identificación extranjera, un valor de hasta 30 caracteres.
func (t Taxpayer) Validate() error {
	switch t.TaxIDType {
	case TaxIDRUCJuridico, TaxIDRUCNatural:
		if !ValidRUCFormat(t.TaxID, t.CheckDigit) {
			return ErrInvalidRUC
		}
	case TaxIDCedula:
		if !ValidCedula(t.TaxID) {
			return ErrInvalidTaxpayer
		}
	case TaxIDPasaporte, TaxIDExtranjero:
		if n := len(t.TaxID); n == 0 || n > 30 {
			return ErrInvalidTaxpayer
		}
	default:
		return ErrInvalidTaxpayer
	}
	if n := len([]rune(t.LegalName)); n == 0 || n > 200 {
		return ErrInvalidTaxpayer
	}
	if t.Email != "" {
		if a, err := mail.ParseAddress(t.Email); err != nil || a.Address != t.Email {
			return ErrInvalidTaxpayer
		}
	}
	return nil
}
