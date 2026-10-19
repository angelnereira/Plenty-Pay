package domain

import "errors"

var (
	ErrCurrencyMismatch = errors.New("currency mismatch")
	ErrTotalsMismatch   = errors.New("totals mismatch")
	ErrInvalidTaxRate   = errors.New("invalid tax rate")
)
