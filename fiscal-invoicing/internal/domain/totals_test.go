package domain

import (
	"errors"
	"testing"
)

var legalRates = map[int64]bool{700: true, 1000: true, 1500: true} // vector de prueba, no el valor legal

// R1: base = half_up(qty × precio / 1000) − descuento; impuesto = half_up(base × tasa / 10000).
func TestR1_ComputeLinesHalfUpAndTotals(t *testing.T) {
	lines, tot, err := ComputeLines([]Line{
		{Description: "Café 250 g", QuantityMilli: 3000, UnitPriceMinor: 1850, TaxRateBps: 700},               // 5550 → 388.5 → 389
		{Description: "Pan", QuantityMilli: 1500, UnitPriceMinor: 333, DiscountMinor: 0, TaxRateBps: 0},       // 499.5 → 500
		{Description: "Licor", QuantityMilli: 1000, UnitPriceMinor: 1005, DiscountMinor: 5, TaxRateBps: 1000}, // 1000 → 100
	}, legalRates)
	if err != nil {
		t.Fatal(err)
	}
	want := []struct{ base, tax, total int64 }{{5550, 389, 5939}, {500, 0, 500}, {1000, 100, 1100}}
	for i, w := range want {
		if lines[i].BaseMinor != w.base || lines[i].TaxMinor != w.tax || lines[i].TotalMinor != w.total {
			t.Fatalf("línea %d: %+v, se esperaba %+v", i, lines[i], w)
		}
	}
	if tot != (Totals{SubtotalMinor: 7050, TaxMinor: 489, TotalMinor: 7539}) {
		t.Fatalf("totales: %+v", tot)
	}
}

// R1 y AGENTS.md §2.13: una tasa que no está entre las vigentes se rechaza; 0 (exento) siempre vale.
func TestR1_RejectsRatesOutsideLegalParameters(t *testing.T) {
	if _, _, err := ComputeLines([]Line{{Description: "x", QuantityMilli: 1000, UnitPriceMinor: 100, TaxRateBps: 800}}, legalRates); !errors.Is(err, ErrInvalidTaxRate) {
		t.Fatalf("tasa 8 %%: %v", err)
	}
	if _, _, err := ComputeLines([]Line{{Description: "x", QuantityMilli: 1000, UnitPriceMinor: 100, TaxRateBps: 700}}, map[int64]bool{}); !errors.Is(err, ErrInvalidTaxRate) {
		t.Fatalf("sin tasas vigentes, solo el exento vale: %v", err)
	}
	if _, _, err := ComputeLines([]Line{{Description: "x", QuantityMilli: 1000, UnitPriceMinor: 100}}, map[int64]bool{}); err != nil {
		t.Fatalf("exento: %v", err)
	}
}

func TestR1_RejectsInvalidLines(t *testing.T) {
	for _, l := range []Line{
		{QuantityMilli: 1000, UnitPriceMinor: 100},                             // sin descripción
		{Description: "x", QuantityMilli: 0, UnitPriceMinor: 100},              // sin cantidad
		{Description: "x", QuantityMilli: 1000, UnitPriceMinor: -1},            // precio negativo
		{Description: "x", QuantityMilli: 1_000_000_001, UnitPriceMinor: 1},    // más de 1 000 000 unidades
		{Description: "x", QuantityMilli: 1000, UnitPriceMinor: 1_000_000_001}, // precio fuera de tope
	} {
		if _, _, err := ComputeLines([]Line{l}, legalRates); !errors.Is(err, ErrInvalidRequest) {
			t.Fatalf("%+v: %v", l, err)
		}
	}
	if _, _, err := ComputeLines([]Line{{Description: "x", QuantityMilli: 1000, UnitPriceMinor: 100, DiscountMinor: 101}}, legalRates); !errors.Is(err, ErrTotalsMismatch) {
		t.Fatalf("descuento mayor que el precio: %v", err)
	}
	if _, _, err := ComputeLines(nil, legalRates); !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("sin líneas: %v", err)
	}
}
