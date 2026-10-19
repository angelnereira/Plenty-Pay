package domain

// Money en centavos (ADR 0013). Nunca float.
type Money struct {
	AmountMinor int64
	Currency    string
}

func (m Money) Add(o Money) (Money, error) {
	if m.Currency != o.Currency {
		return Money{}, ErrCurrencyMismatch
	}
	return Money{AmountMinor: m.AmountMinor + o.AmountMinor, Currency: m.Currency}, nil
}

func HalfUp(valueMinor int64, bps uint32) int64 {
	// (v * bps + 5000) / 10000
	return (valueMinor*int64(bps) + 5000) / 10000
}
