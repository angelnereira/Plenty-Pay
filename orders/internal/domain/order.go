// Package domain contiene las reglas puras de orders (SPEC §5, domain-model §8.10): estados del
// pedido y de sus sub-pedidos, límites del carrito y totales. Sin E/S, sin pb, sin SQL.
package domain

import (
	"errors"
	"math/big"
	"time"
)

// Errores tipados; server los traduce a `reason`.
var (
	ErrNotFound            = errors.New("not found")
	ErrInvalidTransition   = errors.New("invalid state transition")
	ErrCartLimit           = errors.New("cart limit")
	ErrListingUnavailable  = errors.New("listing unavailable")
	ErrPriceChanged        = errors.New("price changed")
	ErrQuoteExpired        = errors.New("quote expired")
	ErrOutOfStock          = errors.New("out of stock")
	ErrDeliveryUnavailable = errors.New("delivery not available yet")
	ErrDeadlinePassed      = errors.New("acceptance deadline passed")
	ErrReasonRequired      = errors.New("reason required")
	ErrEmptyCart           = errors.New("cart is empty")
	ErrInvalidQty          = errors.New("invalid quantity")
	ErrOverflow            = errors.New("amount overflow")
	ErrPickupCode          = errors.New("pickup code mismatch")
)

// Límites del carrito (SPEC §4).
const (
	MaxCartLines     = 50
	MaxCartMerchants = 10
	MaxQtyMilli      = 1_000_000 // 1000 unidades por línea
)

// OrderStatus (orders.proto OrderStatus).
type OrderStatus int16

const (
	OrderPendingPayment     OrderStatus = 1
	OrderPaid               OrderStatus = 2
	OrderPartiallyFulfilled OrderStatus = 3
	OrderCompleted          OrderStatus = 4
	OrderCancelled          OrderStatus = 5
	OrderRefunded           OrderStatus = 6
)

// SubStatus (orders.proto SubOrderStatus).
type SubStatus int16

const (
	SubPendingPayment     SubStatus = 1
	SubAwaitingAcceptance SubStatus = 2
	SubAccepted           SubStatus = 3
	SubReady              SubStatus = 4
	SubInDelivery         SubStatus = 5
	SubCompleted          SubStatus = 6
	SubRejected           SubStatus = 7
	SubCancelled          SubStatus = 8
)

var subTransitions = map[SubStatus][]SubStatus{
	SubPendingPayment:     {SubAwaitingAcceptance, SubCancelled},
	SubAwaitingAcceptance: {SubAccepted, SubRejected, SubCancelled},
	SubAccepted:           {SubReady, SubRejected},
	SubReady:              {SubInDelivery, SubCompleted, SubRejected},
	SubInDelivery:         {SubCompleted, SubCancelled},
}

// CanTransition aplica domain-model §8.10 a un sub-pedido.
func (s SubStatus) CanTransition(to SubStatus) bool {
	for _, t := range subTransitions[s] {
		if t == to {
			return true
		}
	}
	return false
}

// Terminal: no cambia más.
func (s SubStatus) Terminal() bool { return s == SubCompleted || s == SubRejected || s == SubCancelled }

// Lost: el comercio no entregó (rechazado o cancelado): su split se reembolsa.
func (s SubStatus) Lost() bool { return s == SubRejected || s == SubCancelled }

// Derive calcula el estado del pedido desde sus sub-pedidos (R8).
func Derive(paid bool, subs []SubStatus) OrderStatus {
	if !paid {
		for _, s := range subs {
			if s == SubCancelled {
				return OrderCancelled
			}
		}
		return OrderPendingPayment
	}
	lost, done, open := 0, 0, 0
	for _, s := range subs {
		switch {
		case s.Lost():
			lost++
		case s == SubCompleted:
			done++
		default:
			open++
		}
	}
	switch {
	case lost == len(subs):
		return OrderRefunded
	case open == 0:
		return OrderCompleted // todo lo que no se perdió se entregó
	case lost > 0 || done > 0:
		return OrderPartiallyFulfilled
	}
	return OrderPaid
}

// HalfUp calcula round_half_up(a × b / c) sin desbordar (domain-model §4).
func HalfUp(a, b, c int64) (int64, error) {
	if a < 0 || b < 0 || c <= 0 {
		return 0, ErrInvalidQty
	}
	n := new(big.Int).Mul(big.NewInt(a), big.NewInt(b))
	n.Add(n, big.NewInt(c/2))
	n.Quo(n, big.NewInt(c))
	if !n.IsInt64() {
		return 0, ErrOverflow
	}
	return n.Int64(), nil
}

// Line es la instantánea de una línea de un sub-pedido (R1).
type Line struct {
	ProductID       string `json:"product_id"`
	Name            string `json:"name"`
	QtyMilli        int64  `json:"qty_milli"`
	UnitPriceMinor  int64  `json:"unit_price_minor"`
	TaxRateBps      int32  `json:"tax_rate_bps"`
	TracksInventory bool   `json:"tracks_inventory"`
	TotalMinor      int64  `json:"total_minor"`
	TaxMinor        int64  `json:"tax_minor"`
}

// Price calcula total e impuesto incluido de la línea (como pos R2).
func (l *Line) Price() error {
	if l.QtyMilli <= 0 || l.QtyMilli > MaxQtyMilli || l.UnitPriceMinor < 0 {
		return ErrInvalidQty
	}
	t, err := HalfUp(l.UnitPriceMinor, l.QtyMilli, 1000)
	if err != nil {
		return err
	}
	base, err := HalfUp(t, 10000, 10000+int64(l.TaxRateBps))
	if err != nil {
		return err
	}
	l.TotalMinor, l.TaxMinor = t, t-base
	return nil
}

// CartItem es un producto del carrito con la instantánea de cuando se agregó.
type CartItem struct {
	ProductID      string
	TenantID       string
	QtyMilli       int64
	UnitPriceMinor int64
	Name           string
	AddedAt        time.Time
}

// CheckCartLimits: ≤ 50 líneas y ≤ 10 comercios.
func CheckCartLimits(items []CartItem) error {
	if len(items) > MaxCartLines {
		return ErrCartLimit
	}
	merchants := map[string]bool{}
	for _, it := range items {
		merchants[it.TenantID] = true
	}
	if len(merchants) > MaxCartMerchants {
		return ErrCartLimit
	}
	return nil
}

// MerchantQuote es la parte de un comercio en una cotización.
type MerchantQuote struct {
	TenantID     string   `json:"tenant_id"`
	MerchantName string   `json:"merchant_name"`
	Lines        []Line   `json:"lines"`
	TotalMinor   int64    `json:"total_minor"`
	TaxMinor     int64    `json:"tax_minor"`
	AllInStock   bool     `json:"all_in_stock"`
	Unavailable  []string `json:"unavailable"`
}

// Quote es la cotización del checkout, vigente unos minutos.
type Quote struct {
	ID         string
	BuyerID    string
	Merchants  []MerchantQuote
	TotalMinor int64
	Currency   string
	ExpiresAt  time.Time
	CreatedAt  time.Time
}

// QuoteTTL: vigencia de una cotización.
const QuoteTTL = 10 * time.Minute

// Sum suma una cotización por comercio y en total.
func (q *Quote) Sum() error {
	var total int64
	for i := range q.Merchants {
		m := &q.Merchants[i]
		var t, tax int64
		m.AllInStock = len(m.Unavailable) == 0
		for _, l := range m.Lines {
			if l.TotalMinor > (1<<62)-t {
				return ErrOverflow
			}
			t += l.TotalMinor
			tax += l.TaxMinor
		}
		m.TotalMinor, m.TaxMinor = t, tax
		total += t
	}
	q.TotalMinor = total
	return nil
}

// SubOrder es la parte de un pedido de un comercio.
type SubOrder struct {
	ID             string
	OrderID        string
	TenantID       string
	BuyerID        string
	Status         SubStatus
	Fulfillment    int16 // 1 DELIVERY · 2 PICKUP
	Lines          []Line
	TotalMinor     int64
	ReservationID  string
	PickupCode     string
	RejectReason   string
	AcceptDeadline time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// Order es el pedido del comprador.
type Order struct {
	ID              string
	BuyerID         string
	Status          OrderStatus
	Currency        string
	TotalMinor      int64
	PaymentIntentID string
	PaymentID       string
	Fulfillment     int16
	IdempotencyKey  string
	Subs            []SubOrder
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// Paid: el cobro se capturó alguna vez.
func (o Order) Paid() bool { return o.PaymentID != "" }

// Recompute deriva el estado del pedido (R8).
func (o *Order) Recompute() {
	subs := make([]SubStatus, 0, len(o.Subs))
	for _, s := range o.Subs {
		subs = append(subs, s.Status)
	}
	o.Status = Derive(o.Paid(), subs)
}

// String del estado de un sub-pedido (para el motivo de un reembolso).
func (s SubStatus) String() string {
	names := map[SubStatus]string{SubPendingPayment: "PENDING_PAYMENT", SubAwaitingAcceptance: "AWAITING_ACCEPTANCE",
		SubAccepted: "ACCEPTED", SubReady: "READY", SubInDelivery: "IN_DELIVERY", SubCompleted: "COMPLETED",
		SubRejected: "REJECTED", SubCancelled: "CANCELLED"}
	return names[s]
}
