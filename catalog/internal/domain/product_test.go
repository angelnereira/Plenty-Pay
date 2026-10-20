package domain

import (
	"errors"
	"testing"
	"time"
)

var rates = TaxRates{0: true, 700: true, 1000: true, 1500: true}

func valid() Product {
	p := Product{SKU: "CAF-250", Barcode: "4006381333931", Name: "Café 250 g", PriceMinor: 1850, TaxRateBps: 700}
	p.Normalize()
	return p
}

func TestR1_SKUAndBarcodeFormat(t *testing.T) {
	cases := map[string]func(*Product){
		"sku vacío":            func(p *Product) { p.SKU = "" },
		"sku con espacios":     func(p *Product) { p.SKU = "CAF 250" },
		"barcode con letras":   func(p *Product) { p.Barcode = "74510A0100018" },
		"barcode mal control":  func(p *Product) { p.Barcode = "4006381333932" },
		"barcode de 10 cifras": func(p *Product) { p.Barcode = "7451000100" },
	}
	for name, mut := range cases {
		p := valid()
		mut(&p)
		if err := p.Validate(rates, true); err == nil {
			t.Errorf("%s: se esperaba error", name)
		}
	}
	p := valid()
	p.Barcode = ""
	if err := p.Validate(rates, true); err != nil {
		t.Fatalf("sin código de barras es válido: %v", err)
	}
}

func TestR1_GTINCheckDigits(t *testing.T) {
	for _, ok := range []string{"96385074", "036000291452", "4006381333931", "10614141000415"} {
		if !ValidBarcode(ok) {
			t.Errorf("%s debería ser válido", ok)
		}
	}
	for _, bad := range []string{"96385075", "036000291453", "4006381333932"} {
		if ValidBarcode(bad) {
			t.Errorf("%s debería ser inválido", bad)
		}
	}
}

func TestR2_PriceIsNonNegativeInteger(t *testing.T) {
	p := valid()
	p.PriceMinor = -1
	if !errors.Is(p.Validate(rates, true), ErrInvalidPrice) {
		t.Fatal("precio negativo aceptado")
	}
	p.PriceMinor = 0
	if err := p.Validate(rates, true); err != nil {
		t.Fatalf("precio 0 (regalo) es válido: %v", err)
	}
}

func TestN_FIS_01_TaxRateMustBeALegalRate(t *testing.T) {
	p := valid()
	p.TaxRateBps = 500
	if !errors.Is(p.Validate(rates, true), ErrInvalidTaxRate) {
		t.Fatal("tasa 5 % no es una tasa de ITBMS")
	}
	p.TaxRateBps = 0
	if err := p.Validate(rates, true); err != nil {
		t.Fatalf("exento (0) es válido: %v", err)
	}
	if !errors.Is(valid().Validate(rates, false), ErrTaxTreatment) {
		t.Fatal("sin tratamiento fiscal explícito debe fallar: el ITBMS no se asume")
	}
}

func TestNormalizeDefaultsUnitAndCurrency(t *testing.T) {
	p := Product{SKU: " A1 ", Name: " Pan ", UnitType: "kg"}
	p.Normalize()
	if p.SKU != "A1" || p.Name != "Pan" || p.UnitType != "KG" || p.Currency != "USD" {
		t.Fatalf("normalización inesperada: %+v", p)
	}
	p.UnitType = "BOX"
	p.TaxRateBps = 700
	if !errors.Is(p.Validate(rates, true), ErrInvalidUnit) {
		t.Fatal("unidad desconocida aceptada")
	}
}

func TestArchiveIsOneWay(t *testing.T) {
	p := valid()
	p.Status, p.Version = StatusActive, 1
	now := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	if err := p.Archive(now); err != nil || p.Status != StatusArchived || p.Version != 2 {
		t.Fatalf("archivar: %v %+v", err, p)
	}
	if !errors.Is(p.Archive(now), ErrInvalidTransition) {
		t.Fatal("archivar dos veces debe fallar")
	}
}

func TestCategoryDepthAtMostFour(t *testing.T) {
	if err := (Category{Name: "Bebidas", Depth: 4}).Validate(); err != nil {
		t.Fatal(err)
	}
	if !errors.Is((Category{Name: "Bebidas", Depth: 5}).Validate(), ErrCategoryDepth) {
		t.Fatal("profundidad 5 aceptada")
	}
	if !errors.Is((Category{Name: " ", Depth: 1}).Validate(), ErrInvalidCategory) {
		t.Fatal("nombre vacío aceptado")
	}
}
