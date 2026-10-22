package domain

import (
	"errors"
	"strings"
	"unicode/utf8"
)

// Errores de devolución (F17.9, R9).
var (
	ErrExceedsSoldQty = errors.New("refund exceeds sold quantity")
	ErrNotRefundable  = errors.New("sale is not refundable")
)

// RefundLineRequest es lo que el cajero pide devolver de una línea.
type RefundLineRequest struct {
	LineID   string
	QtyMilli int64
}

// RefundLine es la parte devuelta de una línea con su monto.
type RefundLine struct {
	LineID          string
	ProductID       string
	QtyMilli        int64
	AmountMinor     int64
	TracksInventory bool
}

// RefundTender es lo que se reintegra por un medio de pago de la venta.
type RefundTender struct {
	TenderID        string
	Rail            int16
	AmountMinor     int64
	PaymentIntentID string
}

// Refund es una devolución planificada y aplicada a la venta.
type Refund struct {
	ID          string
	Lines       []RefundLine
	Tenders     []RefundTender
	TotalMinor  int64
	Reason      string
	Restock     bool
	CashMinor   int64 // parte en efectivo: sale de la caja que devuelve
	WalletMinor int64 // parte en saldo PlentyPay: la reintegra payments-core
}

// PlanRefund aplica R9 a la venta y la deja actualizada:
//   - solo una venta pagada o devuelta en parte;
//   - por línea, nunca más de lo vendido menos lo ya devuelto (EXCEEDS_SOLD_QTY);
//   - el monto es proporcional, half_up(total de la línea × cantidad / vendida); la última
//     unidad pendiente toma el resto exacto para que la suma de devoluciones sea el total;
//   - el reintegro se reparte por medio en orden inverso al pago (el último medio primero) sin
//     pasar lo cobrado por cada uno.
func (s *Sale) PlanRefund(reqs []RefundLineRequest, reason string, restock bool) (Refund, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" || utf8.RuneCountInString(reason) > 300 {
		return Refund{}, ErrReasonRequired
	}
	if s.Status != Paid && s.Status != PartiallyRefunded {
		return Refund{}, ErrNotRefundable
	}
	if len(reqs) == 0 || len(reqs) > 200 {
		return Refund{}, ErrInvalidLine
	}
	idx := map[string]int{}
	for i, l := range s.Lines {
		idx[l.ID] = i
	}
	r := Refund{Reason: reason, Restock: restock}
	seen := map[string]bool{}
	for _, q := range reqs {
		i, ok := idx[q.LineID]
		if !ok || seen[q.LineID] || q.QtyMilli <= 0 {
			return Refund{}, ErrInvalidLine
		}
		seen[q.LineID] = true
		l := &s.Lines[i]
		pending := l.QtyMilli - l.RefundedMilli
		if q.QtyMilli > pending {
			return Refund{}, ErrExceedsSoldQty
		}
		var amount int64
		if q.QtyMilli == pending {
			amount = l.LineTotalMinor - l.RefundedMinor
		} else {
			var err error
			if amount, err = HalfUp(l.LineTotalMinor, q.QtyMilli, l.QtyMilli); err != nil {
				return Refund{}, err
			}
		}
		l.RefundedMilli += q.QtyMilli
		l.RefundedMinor += amount
		r.Lines = append(r.Lines, RefundLine{LineID: l.ID, ProductID: l.ProductID, QtyMilli: q.QtyMilli,
			AmountMinor: amount, TracksInventory: l.TracksInventory})
		r.TotalMinor += amount
	}
	rest := r.TotalMinor
	for i := len(s.Tenders) - 1; i >= 0 && rest > 0; i-- {
		t := &s.Tenders[i]
		if t.Status != TenderCaptured {
			continue
		}
		take := min(t.AmountMinor-t.RefundedMinor, rest)
		if take <= 0 {
			continue
		}
		t.RefundedMinor += take
		rest -= take
		r.Tenders = append(r.Tenders, RefundTender{TenderID: t.ID, Rail: t.Rail, AmountMinor: take,
			PaymentIntentID: t.PaymentIntentID})
		switch t.Rail {
		case RailCash:
			r.CashMinor += take
		default:
			r.WalletMinor += take
		}
	}
	if rest != 0 {
		return Refund{}, ErrTendersMismatch // lo devuelto supera lo cobrado: no debería ocurrir
	}
	s.Status = Refunded
	for _, l := range s.Lines {
		if l.RefundedMilli < l.QtyMilli {
			s.Status = PartiallyRefunded
			break
		}
	}
	return r, nil
}

// RefundedMinor es lo devuelto de la venta (Σ de sus líneas): se guarda en las líneas, nunca
// aparte, para que no pueda desincronizarse.
func (s Sale) RefundedMinor() int64 {
	var n int64
	for _, l := range s.Lines {
		n += l.RefundedMinor
	}
	return n
}
