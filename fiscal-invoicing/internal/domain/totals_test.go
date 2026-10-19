package domain

import "testing"

func TestValidateLine_OK(t *testing.T) {
	l := FiscalLine{BaseMinor: 10000, TaxRateBps: 700, TaxMinor: 700, TotalMinor: 10700}
	if err := ValidateLine(l); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestValidateLine_BadTax(t *testing.T) {
	l := FiscalLine{BaseMinor: 10000, TaxRateBps: 700, TaxMinor: 999, TotalMinor: 10999}
	if err := ValidateLine(l); err == nil {
		t.Fatal("expected error")
	}
}

func TestValidateLine_InvalidRate(t *testing.T) {
	l := FiscalLine{BaseMinor: 10000, TaxRateBps: 500, TaxMinor: 500, TotalMinor: 10500}
	if err := ValidateLine(l); err != ErrInvalidTaxRate {
		t.Fatalf("expected ErrInvalidTaxRate, got %v", err)
	}
}

func TestComputeTotals_OK(t *testing.T) {
	lines := []FiscalLine{
		{BaseMinor: 5000, TaxRateBps: 700, TaxMinor: 350, TotalMinor: 5350},
		{BaseMinor: 3000, TaxRateBps: 0, TaxMinor: 0, TotalMinor: 3000},
	}
	tot, err := ComputeTotals(lines)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if tot.SubtotalMinor != 8000 || tot.TaxMinor != 350 || tot.TotalMinor != 8350 {
		t.Fatalf("bad totals: %+v", tot)
	}
}

func TestComputeTotals_Mismatch(t *testing.T) {
	lines := []FiscalLine{
		{BaseMinor: 5000, TaxRateBps: 700, TaxMinor: 350, TotalMinor: 5350},
	}
	// tamper total
	lines[0].TotalMinor = 9999
	if _, err := ComputeTotals(lines); err == nil {
		t.Fatal("expected error")
	}
}

func TestHalfUp(t *testing.T) {
	if HalfUp(10000, 700) != 700 {
		t.Fatalf("got %d", HalfUp(10000, 700))
	}
	if HalfUp(1234, 250) != 31 {
		t.Fatalf("got %d", HalfUp(1234, 250))
	}
}
