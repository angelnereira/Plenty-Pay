// Package domain contiene las reglas puras de catalog (SPEC §5): sin E/S, sin pb, sin SQL.
package domain

import (
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// Errores tipados del dominio; server los traduce a `reason` (grpc-conventions.md §4).
var (
	ErrInvalidName        = errors.New("invalid product name")
	ErrInvalidSKU         = errors.New("invalid sku")
	ErrInvalidBarcode     = errors.New("invalid barcode")
	ErrInvalidPrice       = errors.New("invalid price")
	ErrInvalidCurrency    = errors.New("invalid currency")
	ErrInvalidUnit        = errors.New("invalid unit")
	ErrInvalidTaxRate     = errors.New("tax rate is not a legal ITBMS rate")
	ErrLotsNeedInventory  = errors.New("lots require inventory tracking")
	ErrTaxTreatment       = errors.New("tax treatment missing")
	ErrInvalidDescription = errors.New("invalid description")
	ErrInvalidCategory    = errors.New("invalid category")
	ErrCategoryDepth      = errors.New("category depth exceeded")
	ErrSKUTaken           = errors.New("sku taken")
	ErrBarcodeTaken       = errors.New("barcode taken")
	ErrCategoryTaken      = errors.New("category name taken")
	ErrNotFound           = errors.New("not found")
	ErrInvalidTransition  = errors.New("invalid state transition")
	ErrVersionConflict    = errors.New("version conflict")
)

// Status de un producto (catalog.proto ProductStatus).
type Status int16

const (
	StatusActive   Status = 1
	StatusArchived Status = 2
)

// MaxCategoryDepth: el árbol de categorías tiene a lo sumo 4 niveles (SPEC §4).
const MaxCategoryDepth = 4

// Units admitidas (N-STD: códigos de unidad; la app las presenta en el idioma local).
var Units = map[string]bool{"UNIT": true, "KG": true, "LITER": true, "METER": true}

// Monedas con 2 decimales de ISO 4217 que acepta hoy el catálogo (N-STD-02). Panamá opera en USD;
// PAB es la moneda legal a la par.
var Currencies = map[string]bool{"USD": true, "PAB": true}

var (
	skuPattern     = regexp.MustCompile(`^[A-Za-z0-9._\-/]{1,64}$`)
	barcodePattern = regexp.MustCompile(`^[0-9]{8,14}$`)
)

// Product es un artículo vendible con su variante única (catalog.proto `Product`).
type Product struct {
	ID              string
	TenantID        string
	SKU             string
	Barcode         string
	Name            string
	Description     string
	CategoryID      string
	Brand           string
	UnitType        string
	PriceMinor      int64
	Currency        string
	TaxRateBps      int32
	CPBSCode        string
	ImageObjectKeys []string
	Attributes      map[string]string
	Status          Status
	TracksInventory bool
	TracksLots      bool // F16.4: las entradas exigen lote; solo si TracksInventory
	CreatedBy       string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	Version         int32
	// Listed es solo lectura: la publicación vive en `listings` y cambia con SetListing (R4).
	Listed bool
}

// TaxRates son las tasas de ITBMS vigentes que un producto puede llevar: 0 (exento) y las de
// `legal.pa.itbms.*` en infra-management (AGENTS.md §2.13: nunca constantes en código).
type TaxRates map[int32]bool

// Normalize recorta espacios y aplica los valores por omisión que no son legales (moneda y unidad).
func (p *Product) Normalize() {
	p.SKU = strings.TrimSpace(p.SKU)
	p.Barcode = strings.TrimSpace(p.Barcode)
	p.Name = strings.TrimSpace(p.Name)
	p.Description = strings.TrimSpace(p.Description)
	p.Brand = strings.TrimSpace(p.Brand)
	p.UnitType = strings.ToUpper(strings.TrimSpace(p.UnitType))
	if p.UnitType == "" {
		p.UnitType = "UNIT"
	}
	p.Currency = strings.ToUpper(strings.TrimSpace(p.Currency))
	if p.Currency == "" {
		p.Currency = "USD"
	}
	if p.Attributes == nil {
		p.Attributes = map[string]string{}
	}
	if p.ImageObjectKeys == nil {
		p.ImageObjectKeys = []string{}
	}
}

// Validate aplica R1 (formato de sku y código de barras), R2 (precio entero ≥ 0) y el
// tratamiento fiscal (N-FIS-01: la tasa debe ser una tasa legal vigente). `taxSet` indica si el
// llamador fijó la tasa: el ITBMS nunca se asume.
func (p Product) Validate(rates TaxRates, taxSet bool) error {
	switch {
	case utf8.RuneCountInString(p.Name) < 1 || utf8.RuneCountInString(p.Name) > 200:
		return ErrInvalidName
	case !skuPattern.MatchString(p.SKU):
		return ErrInvalidSKU
	case p.Barcode != "" && !ValidBarcode(p.Barcode):
		return ErrInvalidBarcode
	case p.PriceMinor < 0:
		return ErrInvalidPrice
	case !Currencies[p.Currency]:
		return ErrInvalidCurrency
	case !Units[p.UnitType]:
		return ErrInvalidUnit
	case utf8.RuneCountInString(p.Description) > 4000:
		return ErrInvalidDescription
	case !taxSet:
		return ErrTaxTreatment
	case !rates[p.TaxRateBps]:
		return ErrInvalidTaxRate
	case p.TracksLots && !p.TracksInventory:
		return ErrLotsNeedInventory
	}
	return nil
}

// ValidBarcode valida EAN-8, UPC-A (12), EAN-13 y GTIN-14 con su dígito de control (N-STD: GTIN).
func ValidBarcode(code string) bool {
	if !barcodePattern.MatchString(code) {
		return false
	}
	switch len(code) {
	case 8, 12, 13, 14:
	default:
		return false
	}
	sum := 0
	// Desde el penúltimo dígito hacia la izquierda, pesos 3,1,3,1…
	for i := len(code) - 2; i >= 0; i-- {
		d := int(code[i] - '0')
		if (len(code)-2-i)%2 == 0 {
			d *= 3
		}
		sum += d
	}
	check := (10 - sum%10) % 10
	return check == int(code[len(code)-1]-'0')
}

// Archive pasa el producto a ARCHIVED. Archivar dos veces es un error de transición.
func (p *Product) Archive(now time.Time) error {
	if p.Status != StatusActive {
		return ErrInvalidTransition
	}
	p.Status = StatusArchived
	p.UpdatedAt = now
	p.Version++
	return nil
}

// Category es un nodo del árbol de categorías del comercio.
type Category struct {
	ID        string
	TenantID  string
	ParentID  string
	Name      string
	Depth     int16
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Validate: nombre 1–80 y profundidad ≤ 4.
func (c Category) Validate() error {
	n := utf8.RuneCountInString(strings.TrimSpace(c.Name))
	if n < 1 || n > 80 {
		return ErrInvalidCategory
	}
	if c.Depth < 1 || c.Depth > MaxCategoryDepth {
		return ErrCategoryDepth
	}
	return nil
}
