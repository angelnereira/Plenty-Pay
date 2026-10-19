package domain

import "errors"

var ErrTotalsMismatch = errors.New("totals mismatch")

// SaleTotals for POS (tax included in price).
type SaleTotals struct {
	SubtotalMinor int64 // suma de bases
	TaxMinor      int64 // impuesto incluido
	DiscountMinor int64
	TotalMinor    int64 // lo que paga el cliente
}

// ComputeSaleTotals calcula totales con impuestos incluidos.
// price_minor incluye ITBMS; tax = half_up(price, rate) sobre el neto.
func ComputeSaleTotals(lineBaseMinor []int64, lineTaxRateBps []uint32, discountMinor int64) (SaleTotals, error) {
	if len(lineBaseMinor) != len(lineTaxRateBps) {
		return SaleTotals{}, ErrTotalsMismatch
	}
	var subtotal, tax int64
	for i, base := range lineBaseMinor {
		t := HalfUp(base, lineTaxRateBps[i])
		subtotal += base
		tax += t
	}
	total := subtotal + tax - discountMinor
	if total < 0 {
		return SaleTotals{}, ErrTotalsMismatch
	}
	return SaleTotals{SubtotalMinor: subtotal, TaxMinor: tax, DiscountMinor: discountMinor, TotalMinor: total}, nil
}

func HalfUp(valueMinor int64, bps uint32) int64 {
	return (valueMinor*int64(bps) + 5000) / 10000
}

type CashSession struct {
	ID              string
	TenantID        string
	RegisterID      string
	OpenedBy        string
	Status          string
	OpeningFloatMinor int64
	ExpectedCashMinor int64
	CountedCashMinor  int64
	DifferenceMinor   int64
}

func (c *CashSession) Open() {
	c.Status = "OPEN"
}

func (c *CashSession) Close(counted int64) {
	c.Status = "CLOSED"
	c.CountedCashMinor = counted
	c.DifferenceMinor = counted - c.ExpectedCashMinor
}

func (c CashSession) IsOpen() bool {
	return c.Status == "OPEN"
}

type Sale struct {
	ID       string
	TenantID string
	Status   string
	Parked   bool
	Label    string
}

func (s *Sale) Park(label string) {
	s.Parked = true
	s.Label = label
	s.Status = "PARKED"
}

func (s *Sale) Resume() {
	s.Parked = false
	s.Status = "DRAFT"
}

type Tender struct {
	Kind   string // CASH, WALLET, CARD, QR, CREDIT, POINTS
	Amount int64
}

type Checkout struct {
	SaleID  string
	Tenders []Tender
	Total   int64
}

func (c Checkout) Validate() error {
	var paid int64
	for _, t := range c.Tenders {
		if t.Amount <= 0 {
			return errors.New("invalid tender amount")
		}
		paid += t.Amount
	}
	if paid != c.Total {
		return errors.New("tender total mismatch")
	}
	return nil
}

type CustomerCredit struct {
	CustomerID string
	TenantID   string
	BalanceMinor int64
}

func (c *CustomerCredit) Charge(amount int64) {
	c.BalanceMinor += amount
}

func (c *CustomerCredit) Pay(amount int64) bool {
	if c.BalanceMinor < amount {
		return false
	}
	c.BalanceMinor -= amount
	return true
}
