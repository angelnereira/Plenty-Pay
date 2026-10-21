package domain

import (
	"regexp"
	"strings"
	"time"
)

// Entornos del perfil (fiscal_invoicing.proto FiscalProfile.environment, SPEC R9).
const (
	EnvDemo = "DEMO"
	EnvProd = "PROD"
)

// Adaptadores de PAC (SPEC R10, ADR 0022).
const (
	ProviderSimulator = "simulator"
	ProviderHKA       = "hka"
)

// Supports dice si un adaptador de PAC registrado atiende un entorno (lo arma el registro de pac).
type Supports func(provider, environment string) bool

// CheckoutPreference (domain-model §8.8; mismos números que el enum del contrato).
const (
	PrefAlwaysFiscal  = 1
	PrefInternalOnly  = 2
	PrefAskAlways     = 3
	PrefAutoThreshold = 4
)

// Profile es el perfil fiscal del negocio. RUC, DV y razón social son una copia del alta del negocio
// en identity al configurarlo (no se piden dos veces).
type Profile struct {
	TenantID             string
	RUC                  string
	DV                   string
	LegalName            string
	BranchCode           string
	PointOfSaleCode      string
	PACProvider          string
	PACCredentialsSecret string // nombre del secreto en security, nunca el valor
	CertificateSecretRef string
	CheckoutPreference   int
	AutoThresholdMinor   *int64
	Environment          string
	IdempotencyKey       string // clave de la última configuración (grpc-conventions.md §3)
	UpdatedAt            time.Time
	Version              int
}

var (
	// N-FMT-05: provincia 1–13 o prefijo E, N, PE, PI, AV; tomo; asiento.
	cedulaRe = regexp.MustCompile(`^(?:[1-9]|1[0-3]|E|N|PE|PI|AV)-[0-9]{1,5}-[0-9]{1,6}$`)
	// N-FMT-06: persona jurídica = rollo-folio-asiento del Registro Público.
	juridicaRe = regexp.MustCompile(`^[0-9]{1,9}-[0-9]{1,5}-[0-9]{1,9}$`)
	// N-FMT-06: extranjero con prefijo NT.
	nonResidentRe = regexp.MustCompile(`^NT-[0-9A-Z-]{1,20}$`)
	dvRe          = regexp.MustCompile(`^[0-9]{2}$`)
	branchRe      = regexp.MustCompile(`^[0-9]{4}$`)
	posRe         = regexp.MustCompile(`^[0-9]{3}$`)
)

// ValidRUCFormat aplica el formato de N-FMT-06. El cálculo del DV no se verifica: su algoritmo está
// pendiente (Q-22), igual que en identity R17.
func ValidRUCFormat(ruc, dv string) bool {
	ruc = strings.ToUpper(strings.TrimSpace(ruc))
	if !dvRe.MatchString(dv) {
		return false
	}
	return cedulaRe.MatchString(ruc) || juridicaRe.MatchString(ruc) || nonResidentRe.MatchString(ruc)
}

// ValidCedula aplica N-FMT-05.
func ValidCedula(id string) bool { return cedulaRe.MatchString(strings.ToUpper(strings.TrimSpace(id))) }

// Validate revisa el perfil antes de guardarlo (SPEC §4 ConfigureFiscalProfile, R9, R10).
func (p Profile) Validate(supports Supports) error {
	if !ValidRUCFormat(p.RUC, p.DV) {
		return ErrInvalidRUC
	}
	if n := len([]rune(strings.TrimSpace(p.LegalName))); n == 0 || n > 200 {
		return ErrInvalidRequest
	}
	// La DGI no admite el punto de facturación 000.
	if !branchRe.MatchString(p.BranchCode) || !posRe.MatchString(p.PointOfSaleCode) || p.PointOfSaleCode == "000" {
		return ErrInvalidRequest
	}
	switch p.CheckoutPreference {
	case PrefAlwaysFiscal, PrefInternalOnly, PrefAskAlways:
	case PrefAutoThreshold:
		if p.AutoThresholdMinor == nil || *p.AutoThresholdMinor < 0 {
			return ErrInvalidRequest
		}
	default:
		return ErrInvalidRequest
	}
	switch p.Environment {
	case EnvDemo:
		if supports == nil || !supports(p.PACProvider, EnvDemo) {
			return ErrInvalidRequest
		}
	case EnvProd:
		// R9: producción exige un PAC real habilitado por el operador (FISCAL_PROD_ENABLED).
		if p.PACProvider == ProviderSimulator || supports == nil || !supports(p.PACProvider, EnvProd) {
			return ErrPacNotConfigured
		}
	default:
		return ErrInvalidRequest
	}
	return nil
}
