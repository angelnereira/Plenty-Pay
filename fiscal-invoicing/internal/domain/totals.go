package domain

// Linea de documento fiscal.
type FiscalLine struct {
	BaseMinor int64 // base imponible
	TaxRateBps uint32 // 0, 700, 1000, 1500
	TaxMinor   int64 // impuesto calculado
	TotalMinor int64 // base + tax
}

// Tasas ITBMS permitidas (bps).
var allowedTaxRates = map[uint32]bool{0: true, 700: true, 1000: true, 1500: true}

// ValidateLine verifica que tax_minor = half_up(base, rate) y total = base + tax.
func ValidateLine(l FiscalLine) error {
	if !allowedTaxRates[l.TaxRateBps] {
		return ErrInvalidTaxRate
	}
	expectedTax := HalfUp(l.BaseMinor, l.TaxRateBps)
	if l.TaxMinor != expectedTax {
		return ErrTotalsMismatch
	}
	if l.TotalMinor != l.BaseMinor+l.TaxMinor {
		return ErrTotalsMismatch
	}
	return nil
}

// ValidateTotals verifica que Σ line.total = subtotal + tax.
type DocumentTotals struct {
	SubtotalMinor int64
	TaxMinor      int64
	TotalMinor    int64
}

func ComputeTotals(lines []FiscalLine) (DocumentTotals, error) {
	var subtotal, tax, total int64
	for _, l := range lines {
		if err := ValidateLine(l); err != nil {
			return DocumentTotals{}, err
		}
		subtotal += l.BaseMinor
		tax += l.TaxMinor
		total += l.TotalMinor
	}
	if total != subtotal+tax {
		return DocumentTotals{}, ErrTotalsMismatch
	}
	return DocumentTotals{SubtotalMinor: subtotal, TaxMinor: tax, TotalMinor: total}, nil
}
