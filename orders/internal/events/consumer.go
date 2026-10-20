package events

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"google.golang.org/protobuf/proto"

	"plentypay/orders/internal/observability"
	"plentypay/orders/internal/pb"
)

// Consumidor durable de cobros (SPEC §6): el pedido se paga o se cancela cuando payments-core
// publica el resultado de su cobro (`reference = {order, <id>}`).
const (
	PaymentsStream   = "PP_PAYMENTS"
	PaymentsConsumer = "orders-payments"
	paymentsFilter   = "pp.payments.payment.>"
)

// PaymentEvent es un cobro resuelto de un pedido.
type PaymentEvent struct {
	EventID   string
	OrderID   string
	PaymentID string
	Captured  bool
}

// ErrSkip: el mensaje no es de un pedido.
var ErrSkip = errors.New("event not addressed to orders")

// DecodePayment convierte el sobre en un PaymentEvent de pedido.
func DecodePayment(subject string, data []byte) (PaymentEvent, error) {
	var env pb.EventEnvelope
	if err := proto.Unmarshal(data, &env); err != nil {
		return PaymentEvent{}, fmt.Errorf("decode envelope: %w", err)
	}
	switch subject {
	case "pp.payments.payment.captured.v1":
		var m pb.PaymentCaptured
		if err := env.GetPayload().UnmarshalTo(&m); err != nil {
			return PaymentEvent{}, fmt.Errorf("decode PaymentCaptured: %w", err)
		}
		if m.GetReference().GetType() != "order" || m.GetReference().GetId() == "" {
			return PaymentEvent{}, ErrSkip
		}
		return PaymentEvent{EventID: env.GetEventId(), OrderID: m.GetReference().GetId(), PaymentID: m.GetPaymentId(), Captured: true}, nil
	case "pp.payments.payment.failed.v1":
		var m pb.PaymentFailed
		if err := env.GetPayload().UnmarshalTo(&m); err != nil {
			return PaymentEvent{}, fmt.Errorf("decode PaymentFailed: %w", err)
		}
		if m.GetReference().GetType() != "order" || m.GetReference().GetId() == "" {
			return PaymentEvent{}, ErrSkip
		}
		return PaymentEvent{EventID: env.GetEventId(), OrderID: m.GetReference().GetId(), PaymentID: m.GetPaymentId()}, nil
	}
	return PaymentEvent{}, ErrSkip
}

// ConsumePayments aplica cada cobro; ack solo después del efecto (ADR 0012).
func (r *Relay) ConsumePayments(ctx context.Context, handle func(context.Context, PaymentEvent) error) error {
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
			if errors.Is(err, nats.ErrTimeout) || errors.Is(err, context.DeadlineExceeded) || ctx.Err() != nil {
				continue
			}
			r.reporter.Dependency(ctx, "fetch payments failed", "event-bus", observability.Wrap(err, "fetch"))
			time.Sleep(2 * time.Second)
			continue
		}
		for _, m := range msgs {
			e, derr := DecodePayment(m.Subject, m.Data)
			switch {
			case errors.Is(derr, ErrSkip):
			case derr != nil:
				r.reporter.Defect(ctx, "undecodable payment event", observability.Wrap(derr, "decode payment"))
			default:
				if herr := handle(ctx, e); herr != nil {
					r.reporter.Dependency(ctx, "apply payment event failed", "postgres-db", observability.Wrap(herr, "apply payment"))
					if nerr := m.NakWithDelay(5 * time.Second); nerr != nil {
						r.reporter.Dependency(ctx, "nak payment event failed", "event-bus", nerr)
					}
					continue
				}
				r.metrics.Inc("pp_orders_payment_events_total", "subject", m.Subject)
			}
			if err := m.Ack(); err != nil {
				r.reporter.Dependency(ctx, "ack payment event failed", "event-bus", err)
			}
		}
	}
	return nil
}
