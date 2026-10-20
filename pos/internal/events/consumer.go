package events

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"google.golang.org/protobuf/proto"

	"plentypay/pos/internal/observability"
	"plentypay/pos/internal/pb"
	"plentypay/pos/internal/store"
)

// Consumidor durable de cobros (SPEC §6): los medios de billetera de una venta se marcan cobrados
// cuando payments-core publica el cobro con `reference = {sale, <sale_id>}`.
const (
	PaymentsStream   = "PP_PAYMENTS"
	PaymentsConsumer = "pos-payments"
	paymentsFilter   = "pp.payments.payment.>"
	subjectCaptured  = "pp.payments.payment.captured.v1"
	subjectFailed    = "pp.payments.payment.failed.v1"
)

// PaymentHandler aplica un cobro; devuelve true si cambió una venta.
type PaymentHandler func(ctx context.Context, e store.PaymentEvent) (bool, error)

// ErrSkip: el mensaje no es para pos (otra referencia, otro evento); se confirma sin efecto.
var ErrSkip = errors.New("event not addressed to pos")

// DecodePayment convierte el sobre en un PaymentEvent de venta.
func DecodePayment(subject string, data []byte) (store.PaymentEvent, error) {
	var env pb.EventEnvelope
	if err := proto.Unmarshal(data, &env); err != nil {
		return store.PaymentEvent{}, fmt.Errorf("decode envelope: %w", err)
	}
	switch subject {
	case subjectCaptured:
		var m pb.PaymentCaptured
		if err := env.GetPayload().UnmarshalTo(&m); err != nil {
			return store.PaymentEvent{}, fmt.Errorf("decode PaymentCaptured: %w", err)
		}
		if m.GetReference().GetType() != "sale" || m.GetReference().GetId() == "" {
			return store.PaymentEvent{}, ErrSkip
		}
		return store.PaymentEvent{EventID: env.GetEventId(), TenantID: m.GetTenantId(), SaleID: m.GetReference().GetId(),
			IntentID: m.GetPaymentIntentId(), Amount: m.GetGross().GetAmountMinor(), Captured: true}, nil
	case subjectFailed:
		var m pb.PaymentFailed
		if err := env.GetPayload().UnmarshalTo(&m); err != nil {
			return store.PaymentEvent{}, fmt.Errorf("decode PaymentFailed: %w", err)
		}
		if m.GetReference().GetType() != "sale" || m.GetReference().GetId() == "" {
			return store.PaymentEvent{}, ErrSkip
		}
		return store.PaymentEvent{EventID: env.GetEventId(), TenantID: m.GetTenantId(), SaleID: m.GetReference().GetId(),
			IntentID: m.GetPaymentIntentId(), Captured: false}, nil
	}
	return store.PaymentEvent{}, ErrSkip
}

// ConsumePayments lee lotes del consumidor durable. Confirma (ack) solo después de aplicar el
// efecto en la base (ADR 0012); un fallo deja el mensaje para reentrega.
func (r *Relay) ConsumePayments(ctx context.Context, handle PaymentHandler) error {
	sub, err := r.js.PullSubscribe(paymentsFilter, PaymentsConsumer, nats.BindStream(PaymentsStream),
		nats.DeliverAll(), nats.AckExplicit(), nats.AckWait(30*time.Second), nats.MaxDeliver(-1))
	if err != nil {
		return fmt.Errorf("subscribe %s: %w", PaymentsConsumer, err)
	}
	defer func() {
		if err := sub.Unsubscribe(); err != nil && !errors.Is(err, nats.ErrConnectionClosed) {
			r.reporter.Dependency(ctx, "unsubscribe payments consumer failed", "event-bus", err)
		}
	}()
	for ctx.Err() == nil {
		msgs, err := sub.Fetch(20, nats.MaxWait(2*time.Second))
		if err != nil {
			if errors.Is(err, nats.ErrTimeout) || errors.Is(err, context.DeadlineExceeded) {
				continue
			}
			if ctx.Err() != nil {
				return nil
			}
			r.reporter.Dependency(ctx, "fetch payments failed", "event-bus", observability.Wrap(err, "fetch"))
			time.Sleep(2 * time.Second)
			continue
		}
		for _, m := range msgs {
			e, derr := DecodePayment(m.Subject, m.Data)
			if errors.Is(derr, ErrSkip) {
				r.ack(ctx, m)
				continue
			}
			if derr != nil {
				// Un sobre ilegible nunca será legible: se registra como defecto y se confirma para
				// no bloquear la cola (queda en el stream para análisis).
				r.reporter.Defect(ctx, "undecodable payment event", observability.Wrap(derr, "decode payment"))
				r.ack(ctx, m)
				continue
			}
			if _, herr := handle(ctx, e); herr != nil {
				r.reporter.Dependency(ctx, "apply payment event failed", "postgres-db", observability.Wrap(herr, "apply payment"))
				if nerr := m.NakWithDelay(5 * time.Second); nerr != nil {
					r.reporter.Dependency(ctx, "nak payment event failed", "event-bus", nerr)
				}
				continue
			}
			r.metrics.Inc("pp_pos_payment_events_total", "subject", m.Subject)
			r.ack(ctx, m)
		}
	}
	return nil
}

func (r *Relay) ack(ctx context.Context, m *nats.Msg) {
	if err := m.Ack(); err != nil {
		r.reporter.Dependency(ctx, "ack payment event failed", "event-bus", err)
	}
}
