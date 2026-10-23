package service

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"time"

	"google.golang.org/protobuf/proto"

	"plentypay/pos/internal/client"
	"plentypay/pos/internal/domain"
	"plentypay/pos/internal/events"
	"plentypay/pos/internal/pb"
	"plentypay/pos/internal/store"
)

// StepUpOperation es la operación de confirmación fuerte de una devolución (security-standards
// §4.1, ADR 0023).
const StepUpOperation = "pos.sale.void"

// Errores de la confirmación fuerte.
var (
	ErrStepUpRequired = errors.New("step-up required")
	ErrStepUpInvalid  = errors.New("step-up invalid")
)

// StepUp consume tokens de confirmación fuerte (identity).
type StepUp interface {
	ConsumeStepUp(ctx context.Context, w client.Who, token, operation string, amountMinor int64, currency string) (string, error)
}

// Refunder reintegra cobros al saldo PlentyPay (payments-core).
type Refunder interface {
	Refund(ctx context.Context, w client.Who, intentID, key, reason string, amountMinor int64) (client.RefundOutcome, string, error)
}

// RefundStore es lo que las devoluciones usan de la persistencia.
type RefundStore interface {
	RefundByKey(ctx context.Context, tenantID, key string, hash []byte) (*store.RefundRow, domain.Sale, error)
	Refund(ctx context.Context, in store.RefundInput) (store.RefundRow, domain.Sale, error)
	ClaimRefundTasks(ctx context.Context, limit int, now time.Time) ([]store.RefundTask, error)
	FinishRefundTask(ctx context.Context, t store.RefundTask, failed bool, cause string, now time.Time) error
	RetryRefundTask(ctx context.Context, t store.RefundTask, cause string, next time.Time) error
	RefundsOfSale(ctx context.Context, tenantID, saleID string) ([]store.RefundRow, error)
}

// UseRefunds conecta lo que las devoluciones necesitan además del resto del servicio.
func (p *Pos) UseRefunds(rs RefundStore, stepUp StepUp, refunder Refunder) {
	p.refunds, p.stepUp, p.refunder = rs, stepUp, refunder
}

// RefundRequest es lo que pide el cajero (S-POS-08).
type RefundRequest struct {
	SaleID      string
	Lines       []domain.RefundLineRequest
	Reason      string
	Restock     bool
	Key         string
	StepUpToken string
}

func refundHash(r RefundRequest) []byte {
	parts := []string{"refund", r.SaleID, strings.TrimSpace(r.Reason), fmt.Sprint(r.Restock)}
	for _, l := range r.Lines {
		parts = append(parts, fmt.Sprintf("%s:%d", l.LineID, l.QtyMilli))
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x1f")))
	return sum[:]
}

// RefundSale devuelve líneas de una venta pagada (F17.9, R9). Valida primero (cantidades, estado,
// motivo) sobre una copia para saber el monto, consume la confirmación fuerte atada a ese monto y
// luego escribe todo en una transacción. Un reintento con la misma clave devuelve lo hecho sin
// pedir otra confirmación.
func (p *Pos) RefundSale(ctx context.Context, a Actor, r RefundRequest) (domain.Sale, store.RefundRow, error) {
	if p.refunds == nil || p.stepUp == nil {
		return domain.Sale{}, store.RefundRow{}, errors.New("refunds not wired")
	}
	if len(r.Key) < 16 || len(r.Key) > 100 {
		return domain.Sale{}, store.RefundRow{}, domain.ErrInvalidAmount
	}
	hash := refundHash(r)
	if prev, sale, err := p.refunds.RefundByKey(ctx, a.TenantID, r.Key, hash); err != nil || prev != nil {
		if prev != nil {
			return sale, *prev, nil
		}
		return domain.Sale{}, store.RefundRow{}, err
	}
	current, err := p.store.GetSale(ctx, a.TenantID, r.SaleID)
	if err != nil {
		return domain.Sale{}, store.RefundRow{}, err
	}
	if err := a.checkBranch(current.BranchID); err != nil { // R15
		return domain.Sale{}, store.RefundRow{}, err
	}
	probe := current
	probe.Lines = append([]domain.Line(nil), current.Lines...)
	probe.Tenders = append([]domain.Tender(nil), current.Tenders...)
	plan, err := probe.PlanRefund(r.Lines, r.Reason, r.Restock)
	if err != nil {
		return domain.Sale{}, store.RefundRow{}, err
	}
	if strings.TrimSpace(r.StepUpToken) == "" {
		return domain.Sale{}, store.RefundRow{}, ErrStepUpRequired
	}
	reason, err := p.stepUp.ConsumeStepUp(ctx, a.who(), r.StepUpToken, StepUpOperation, plan.TotalMinor, current.Currency)
	if err != nil {
		return domain.Sale{}, store.RefundRow{}, err
	}
	if reason != "" {
		return domain.Sale{}, store.RefundRow{}, fmt.Errorf("%w: %s", ErrStepUpInvalid, reason)
	}
	row, sale, err := p.refunds.Refund(ctx, store.RefundInput{TenantID: a.TenantID, SaleID: r.SaleID, CashierID: a.UserID,
		Key: r.Key, Hash: hash, Lines: r.Lines, Reason: r.Reason, Restock: r.Restock, Now: p.now(), NewID: p.newID,
		Events: p.onRefunded})
	return sale, row, err
}

// onRefunded: SaleRefunded al outbox con lo devuelto por línea (monto en line_total).
func (p *Pos) onRefunded(r store.RefundRow, s domain.Sale) ([]store.OutboxEvent, error) {
	msg := &pb.SaleRefunded{SaleId: s.ID, TenantId: s.TenantID, Restock: r.Restock,
		Amount: &pb.Money{AmountMinor: r.TotalMinor, Currency: s.Currency}}
	for _, l := range r.Lines {
		msg.Lines = append(msg.Lines, &pb.SaleLine{LineId: l.LineID, ProductId: l.ProductID, QuantityMilli: l.QtyMilli,
			LineTotal: &pb.Money{AmountMinor: l.AmountMinor, Currency: s.Currency}})
	}
	b, err := proto.Marshal(msg)
	if err != nil {
		return nil, fmt.Errorf("marshal SaleRefunded: %w", err)
	}
	return []store.OutboxEvent{{ID: p.newID(), TenantID: s.TenantID, AggregateID: r.ID,
		Subject: events.SubjectSaleRefunded, Payload: b, CreatedAt: p.now()}}, nil
}

// RefundsOfSale: las devoluciones de una venta.
func (p *Pos) RefundsOfSale(ctx context.Context, a Actor, saleID string) ([]store.RefundRow, error) {
	return p.refunds.RefundsOfSale(ctx, a.TenantID, saleID)
}

// RefundOutcome cuenta lo que hizo una pasada del trabajador de reintegros.
type RefundOutcome struct{ Done, Retried, Failed int }

// DeliverRefunds pide a payments-core los reintegros pendientes. Un fallo pasajero reprograma; un
// rechazo deja la tarea FAILED, la devolución FAILED y la venta para revisión (nunca se da por
// devuelto lo que no se reintegró).
func (p *Pos) DeliverRefunds(ctx context.Context, limit int, report func(store.RefundTask, error)) (RefundOutcome, error) {
	var out RefundOutcome
	if p.refunds == nil || p.refunder == nil {
		return out, nil
	}
	tasks, err := p.refunds.ClaimRefundTasks(ctx, limit, p.now())
	if err != nil {
		return out, err
	}
	for _, t := range tasks {
		res, code, err := p.refunder.Refund(ctx, client.Who{TenantID: t.TenantID, UserID: t.CashierID}, t.PaymentIntentID,
			t.IdempotencyKey, t.Reason, t.AmountMinor)
		switch {
		case err == nil && res == client.RefundDone:
			if ferr := p.refunds.FinishRefundTask(ctx, t, false, "", p.now()); ferr != nil {
				return out, ferr
			}
			out.Done++
		case err == nil && res == client.RefundFailed:
			if ferr := p.refunds.FinishRefundTask(ctx, t, true, code, p.now()); ferr != nil {
				return out, ferr
			}
			report(t, fmt.Errorf("refund rejected: %s", code))
			out.Failed++
		default:
			i := min(max(t.Attempts-1, 0), len(StockBackoff)-1)
			cause := "pending"
			if err != nil {
				cause = err.Error()
			}
			if rerr := p.refunds.RetryRefundTask(ctx, t, cause, p.now().Add(StockBackoff[i])); rerr != nil {
				return out, rerr
			}
			if err != nil {
				report(t, err)
			}
			out.Retried++
		}
	}
	return out, nil
}
