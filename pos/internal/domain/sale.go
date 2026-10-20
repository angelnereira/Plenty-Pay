// Package domain contiene las reglas puras de pos (SPEC §5): totales, medios de pago, estados y
// arqueo. Sin E/S, sin pb, sin SQL. Dinero en centavos enteros (ADR 0013); cantidades en milésimas.
package domain

import (
	"errors"
	"math/big"
	"strings"
	"time"
	"unicode/utf8"
)

// Errores tipados; server los traduce a `reason`.
var (
	ErrNotFound          = errors.New("not found")
	ErrSessionOpen       = errors.New("session already open")
	ErrSessionClosed     = errors.New("session closed")
	ErrNotYourSession    = errors.New("session belongs to another cashier")
	ErrSalesPending      = errors.New("sales pending in session")
	ErrInvalidTransition = errors.New("invalid state transition")
	ErrEmptySale         = errors.New("sale has no lines")
	ErrInvalidLine       = errors.New("invalid sale line")
	ErrTendersMismatch   = errors.New("tenders do not match total")
	ErrRailNotSupported  = errors.New("payment rail not supported at the counter")
	ErrInvalidAmount     = errors.New("invalid amount")
	ErrReasonRequired    = errors.New("reason required")
	ErrVersionConflict   = errors.New("version conflict")
	ErrHasCaptured       = errors.New("sale has captured electronic payments")
	ErrOverflow          = errors.New("amount overflow")
	ErrProductInactive   = errors.New("product not sellable")
	ErrKeyReused         = errors.New("idempotency key reused")
)

// Status de una venta (pos.proto SaleStatus).
type Status int16

const (
	Open            Status = 1
	Parked          Status = 2
	AwaitingPayment Status = 3
	Paid            Status = 4
	Voided          Status = 5
)

// Rails (common.PaymentRail) que acepta hoy la caja: efectivo y billetera PlentyPay. Los demás
// esperan a sus PSP (Q-02, Q-03) y responden RAIL_NOT_SUPPORTED.
const (
	RailWallet int16 = 1
	RailCash   int16 = 8
)

// Estados de un medio de pago.
const (
	TenderPending  = "PENDING"
	TenderCaptured = "CAPTURED"
	TenderFailed   = "FAILED"
)

// MaxQtyMilli de una línea (100 000 unidades): tope de cordura contra errores de digitación.
const MaxQtyMilli = 100_000_000

// HalfUp calcula round_half_up(a × b / c) con a, b ≥ 0 y c > 0 sin desbordar (domain-model §4).
func HalfUp(a, b, c int64) (int64, error) {
	if a < 0 || b < 0 || c <= 0 {
		return 0, ErrInvalidAmount
	}
	n := new(big.Int).Mul(big.NewInt(a), big.NewInt(b))
	n.Add(n, big.NewInt(c/2))
	n.Quo(n, big.NewInt(c))
	if !n.IsInt64() {
		return 0, ErrOverflow
	}
	return n.Int64(), nil
}

// Line es una línea de venta con la instantánea del producto (R3 de catalog: un cambio de precio
// posterior no toca esta venta).
type Line struct {
	ID              string
	ProductID       string
	Description     string
	QtyMilli        int64
	UnitPriceMinor  int64
	DiscountMinor   int64
	TaxRateBps      int32
	TracksInventory bool
	LineTotalMinor  int64 // con impuesto incluido
	TaxMinor        int64
}

// Price calcula total e impuesto de la línea (R2): total = precio × qty − descuento; con impuesto
// incluido, tax = total − round_half_up(total × 10000 / (10000 + tasa)).
func (l *Line) Price() error {
	if l.QtyMilli <= 0 || l.QtyMilli > MaxQtyMilli || l.UnitPriceMinor < 0 || l.DiscountMinor < 0 ||
		l.TaxRateBps < 0 || l.TaxRateBps > 10000 {
		return ErrInvalidLine
	}
	gross, err := HalfUp(l.UnitPriceMinor, l.QtyMilli, 1000)
	if err != nil {
		return err
	}
	if l.DiscountMinor > gross {
		return ErrInvalidLine
	}
	l.LineTotalMinor = gross - l.DiscountMinor
	base, err := HalfUp(l.LineTotalMinor, 10000, 10000+int64(l.TaxRateBps))
	if err != nil {
		return err
	}
	l.TaxMinor = l.LineTotalMinor - base
	return nil
}

// Tender es un medio de pago de la venta.
type Tender struct {
	ID              string
	Rail            int16
	AmountMinor     int64
	CashTendered    int64
	ChangeMinor     int64
	PaymentIntentID string
	Status          string
}

// Sale es una venta de mostrador.
type Sale struct {
	ID            string
	TenantID      string
	SessionID     string
	CashierID     string
	Status        Status
	Lines         []Line
	Tenders       []Tender
	SubtotalMinor int64 // sin impuesto
	TaxMinor      int64
	TotalMinor    int64
	ChangeMinor   int64
	Currency      string
	ReceiptNumber int64
	ClientSaleID  string
	NeedsReview   bool
	CreatedAt     time.Time
	UpdatedAt     time.Time
	PaidAt        time.Time
	Version       int32
}

// Recalculate suma las líneas (R2). Las líneas deben venir ya con Price().
func (s *Sale) Recalculate() error {
	var total, tax int64
	for _, l := range s.Lines {
		if l.LineTotalMinor > (1<<62)-total {
			return ErrOverflow
		}
		total += l.LineTotalMinor
		tax += l.TaxMinor
	}
	s.TotalMinor, s.TaxMinor, s.SubtotalMinor = total, tax, total-tax
	return nil
}

// Editable: solo una venta abierta acepta cambios de líneas.
func (s Sale) Editable() error {
	if s.Status != Open {
		return ErrInvalidTransition
	}
	return nil
}

// PrepareCheckout valida los medios (R4, R6): Σ montos = total; el efectivo recibido puede
// exceder su monto y el vuelto sale en centavos; solo efectivo y billetera en caja.
func (s *Sale) PrepareCheckout(tenders []Tender) error {
	if s.Status != Open && s.Status != Parked {
		return ErrInvalidTransition
	}
	if len(s.Lines) == 0 || s.TotalMinor <= 0 {
		return ErrEmptySale
	}
	var sum, change int64
	cashSeen := false
	for i := range tenders {
		t := &tenders[i]
		if t.AmountMinor <= 0 {
			return ErrInvalidAmount
		}
		switch t.Rail {
		case RailCash:
			if cashSeen {
				return ErrTendersMismatch
			}
			cashSeen = true
			if t.CashTendered == 0 {
				t.CashTendered = t.AmountMinor
			}
			if t.CashTendered < t.AmountMinor {
				return ErrTendersMismatch
			}
			t.ChangeMinor = t.CashTendered - t.AmountMinor
			change = t.ChangeMinor
			t.Status = TenderCaptured
		case RailWallet:
			t.CashTendered, t.ChangeMinor, t.Status = 0, 0, TenderPending
		default:
			return ErrRailNotSupported
		}
		sum += t.AmountMinor
	}
	if sum != s.TotalMinor {
		return ErrTendersMismatch
	}
	s.Tenders, s.ChangeMinor = tenders, change
	s.Status = AwaitingPayment
	if s.AllCaptured() {
		s.Status = Paid
	}
	return nil
}

// AllCaptured indica si todos los medios quedaron cobrados.
func (s Sale) AllCaptured() bool {
	if len(s.Tenders) == 0 {
		return false
	}
	for _, t := range s.Tenders {
		if t.Status != TenderCaptured {
			return false
		}
	}
	return true
}

// CaptureTender marca cobrado el medio de billetera que coincide con el monto (PaymentCaptured
// con reference sale). Un monto distinto no paga la venta: queda para revisión (R7).
func (s *Sale) CaptureTender(intentID string, amount int64) (matched bool) {
	for i := range s.Tenders {
		t := &s.Tenders[i]
		if t.Rail != RailWallet || t.Status != TenderPending {
			continue
		}
		if t.AmountMinor != amount {
			continue
		}
		t.Status, t.PaymentIntentID = TenderCaptured, intentID
		if s.AllCaptured() {
			s.Status = Paid
		}
		return true
	}
	s.NeedsReview = true
	return false
}

// FailTender: el cobro electrónico falló; la venta vuelve a OPEN para elegir otro medio.
func (s *Sale) FailTender() {
	for i := range s.Tenders {
		if s.Tenders[i].Rail == RailWallet && s.Tenders[i].Status == TenderPending {
			s.Tenders[i].Status = TenderFailed
		}
	}
	if s.Status == AwaitingPayment {
		s.Status = Open
	}
}

// Void anula (R8): solo sin cobros electrónicos capturados.
func (s *Sale) Void(reason string) error {
	if strings.TrimSpace(reason) == "" || utf8.RuneCountInString(reason) > 300 {
		return ErrReasonRequired
	}
	if s.Status == Paid || s.Status == Voided {
		return ErrInvalidTransition
	}
	for _, t := range s.Tenders {
		if t.Rail != RailCash && t.Status == TenderCaptured {
			return ErrHasCaptured
		}
	}
	s.Status = Voided
	return nil
}

// CashInSale: el efectivo que queda en el cajón por una venta pagada (monto, no lo recibido: el
// vuelto sale del cajón).
func (s Sale) CashInSale() int64 {
	var n int64
	for _, t := range s.Tenders {
		if t.Rail == RailCash && t.Status == TenderCaptured {
			n += t.AmountMinor
		}
	}
	return n
}

// Session es una sesión de caja (R1: una abierta por caja).
type Session struct {
	ID              string
	TenantID        string
	TerminalLabel   string
	CashierID       string
	Status          string // OPEN | CLOSED
	OpeningFloat    int64
	ExpectedCash    int64
	CountedCash     int64
	DifferenceMinor int64
	CloseNotes      string
	Currency        string
	OpenedAt        time.Time
	ClosedAt        time.Time
}

// Close calcula la diferencia del arqueo: contado − esperado (con signo).
func (s *Session) Close(counted int64, notes string, at time.Time) error {
	if s.Status != "OPEN" {
		return ErrSessionClosed
	}
	if counted < 0 {
		return ErrInvalidAmount
	}
	s.CountedCash, s.DifferenceMinor = counted, counted-s.ExpectedCash
	s.CloseNotes, s.Status, s.ClosedAt = strings.TrimSpace(notes), "CLOSED", at
	return nil
}

// CashMovement: entrada o salida de efectivo con motivo (R6).
type CashMovement struct {
	ID          string
	SessionID   string
	Direction   string // IN | OUT
	AmountMinor int64
	Reason      string
	CreatedBy   string
	CreatedAt   time.Time
}

// Validate: monto > 0, dirección conocida y motivo.
func (m CashMovement) Validate() error {
	if m.AmountMinor <= 0 {
		return ErrInvalidAmount
	}
	if m.Direction != "IN" && m.Direction != "OUT" {
		return ErrInvalidAmount
	}
	if strings.TrimSpace(m.Reason) == "" || utf8.RuneCountInString(m.Reason) > 300 {
		return ErrReasonRequired
	}
	return nil
}

// Signed devuelve el efecto sobre el efectivo esperado.
func (m CashMovement) Signed() int64 {
	if m.Direction == "OUT" {
		return -m.AmountMinor
	}
	return m.AmountMinor
}
