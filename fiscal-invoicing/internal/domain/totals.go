package domain

// Line es una línea de documento fiscal con sus montos ya calculados por el servidor (R1).
type Line struct {
	Description     string
	CPBSCode        string
	UnitMeasureCode string
	QuantityMilli   int64
	UnitPriceMinor  int64
	DiscountMinor   int64
	TaxRateBps      int64
	BaseMinor       int64 // half_up(qty × precio / 1000) − descuento
	TaxMinor        int64 // half_up(base × tasa / 10000)
	TotalMinor      int64 // base + impuesto
}

// Totals son los totales del documento: Σ total = subtotal + impuesto (R1).
type Totals struct {
	SubtotalMinor int64
	TaxMinor      int64
	TotalMinor    int64
}

// ComputeLines calcula base, impuesto y total de cada línea y los totales del documento. allowed son
// las tasas legal.pa.itbms.* vigentes en la fecha del documento (más 0 = exento); una tasa fuera de
// ellas es ErrInvalidTaxRate (AGENTS.md §2.13: nunca una lista fija en el código).
func ComputeLines(lines []Line, allowed map[int64]bool) ([]Line, Totals, error) {
	if len(lines) == 0 || len(lines) > 500 {
		return nil, Totals{}, ErrInvalidRequest
	}
	out := make([]Line, len(lines))
	var t Totals
	for i, l := range lines {
		// Topes: 1 000 000 unidades y B/. 10 000 000 por unidad; el producto cabe en int64.
		if l.QuantityMilli <= 0 || l.QuantityMilli > 1_000_000_000 || l.UnitPriceMinor < 0 ||
			l.UnitPriceMinor > 1_000_000_000 || l.DiscountMinor < 0 || l.Description == "" {
			return nil, Totals{}, ErrInvalidRequest
		}
		if l.TaxRateBps != 0 && !allowed[l.TaxRateBps] {
			return nil, Totals{}, ErrInvalidTaxRate
		}
		gross, err := HalfUpDiv(l.QuantityMilli*l.UnitPriceMinor, 1000)
		if err != nil {
			return nil, Totals{}, err
		}
		if l.DiscountMinor > gross {
			return nil, Totals{}, ErrTotalsMismatch
		}
		l.BaseMinor = gross - l.DiscountMinor
		if l.TaxMinor, err = HalfUpDiv(l.BaseMinor*l.TaxRateBps, 10000); err != nil {
			return nil, Totals{}, err
		}
		l.TotalMinor = l.BaseMinor + l.TaxMinor
		t.SubtotalMinor += l.BaseMinor
		t.TaxMinor += l.TaxMinor
		t.TotalMinor += l.TotalMinor
		out[i] = l
	}
	if t.TotalMinor != t.SubtotalMinor+t.TaxMinor {
		return nil, Totals{}, ErrTotalsMismatch
	}
	return out, t, nil
}
