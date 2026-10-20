package events

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"google.golang.org/protobuf/proto"

	"plentypay/catalog/internal/observability"
	"plentypay/catalog/internal/pb"
)

// Consumidores durables de catalog (SPEC §6): proyecciones de estado del negocio (R4) y de
// existencias (R5). Ack solo después de aplicar el efecto en la base (ADR 0012).
const (
	SubjectTenantStatus  = "pp.identity.tenant.status_changed.v1"
	SubjectStockChanged  = "pp.inventory.stock.changed.v1"
	TenantStatusConsumer = "catalog-tenant-status"
	StockConsumer        = "catalog-stock"
)

// TenantHandler aplica un cambio de estado de negocio.
type TenantHandler func(ctx context.Context, eventID, tenantID string, status int16) (bool, error)

// StockHandler aplica una existencia.
type StockHandler func(ctx context.Context, eventID, tenantID, productID, warehouseID string, available int64) (bool, error)

// DecodeTenantStatus lee el sobre de identity.
func DecodeTenantStatus(data []byte) (eventID, tenantID string, status int16, err error) {
	var env pb.EventEnvelope
	if err = proto.Unmarshal(data, &env); err != nil {
		return "", "", 0, fmt.Errorf("decode envelope: %w", err)
	}
	var m pb.TenantStatusChanged
	if err = env.GetPayload().UnmarshalTo(&m); err != nil {
		return "", "", 0, fmt.Errorf("decode TenantStatusChanged: %w", err)
	}
	return env.GetEventId(), m.GetTenantId(), int16(m.GetStatus()), nil
}

// DecodeStock lee el sobre de inventory.
func DecodeStock(data []byte) (eventID string, m *pb.StockChanged, err error) {
	var env pb.EventEnvelope
	if err = proto.Unmarshal(data, &env); err != nil {
		return "", nil, fmt.Errorf("decode envelope: %w", err)
	}
	m = &pb.StockChanged{}
	if err = env.GetPayload().UnmarshalTo(m); err != nil {
		return "", nil, fmt.Errorf("decode StockChanged: %w", err)
	}
	return env.GetEventId(), m, nil
}

func (r *Relay) consume(ctx context.Context, stream, durable, subject string, apply func(*nats.Msg) error) error {
	sub, err := r.js.PullSubscribe(subject, durable, nats.BindStream(stream), nats.DeliverAll(),
		nats.AckExplicit(), nats.AckWait(30*time.Second), nats.MaxDeliver(-1))
	if err != nil {
		return fmt.Errorf("subscribe %s: %w", durable, err)
	}
	defer func() {
		if err := sub.Unsubscribe(); err != nil && !errors.Is(err, nats.ErrConnectionClosed) {
			r.reporter.Dependency(ctx, "unsubscribe failed", "event-bus", err)
		}
	}()
	for ctx.Err() == nil {
		msgs, err := sub.Fetch(50, nats.MaxWait(2*time.Second))
		if err != nil {
			if errors.Is(err, nats.ErrTimeout) || errors.Is(err, context.DeadlineExceeded) || ctx.Err() != nil {
				continue
			}
			r.reporter.Dependency(ctx, "fetch events failed", "event-bus", observability.Wrap(err, durable))
			time.Sleep(2 * time.Second)
			continue
		}
		for _, m := range msgs {
			if err := apply(m); err != nil {
				var bad *badEvent
				if errors.As(err, &bad) {
					// Ilegible para siempre: defecto registrado y ack (queda en el stream para análisis).
					r.reporter.Defect(ctx, "undecodable event", observability.Wrap(bad.err, durable))
					r.ack(ctx, m)
					continue
				}
				r.reporter.Dependency(ctx, "apply event failed", "postgres-db", observability.Wrap(err, durable))
				if nerr := m.NakWithDelay(5 * time.Second); nerr != nil {
					r.reporter.Dependency(ctx, "nak failed", "event-bus", nerr)
				}
				continue
			}
			r.metrics.Inc("pp_catalog_events_total", "consumer", durable)
			r.ack(ctx, m)
		}
	}
	return nil
}

type badEvent struct{ err error }

func (b *badEvent) Error() string { return b.err.Error() }

func (r *Relay) ack(ctx context.Context, m *nats.Msg) {
	if err := m.Ack(); err != nil {
		r.reporter.Dependency(ctx, "ack failed", "event-bus", err)
	}
}

// ConsumeTenantStatus proyecta el estado de los negocios (R4).
func (r *Relay) ConsumeTenantStatus(ctx context.Context, handle TenantHandler) error {
	return r.consume(ctx, "PP_IDENTITY", TenantStatusConsumer, SubjectTenantStatus, func(m *nats.Msg) error {
		id, tenant, st, err := DecodeTenantStatus(m.Data)
		if err != nil {
			return &badEvent{err}
		}
		_, err = handle(ctx, id, tenant, st)
		return err
	})
}

// ConsumeStock proyecta las existencias (R5).
func (r *Relay) ConsumeStock(ctx context.Context, handle StockHandler) error {
	return r.consume(ctx, "PP_COMMERCE", StockConsumer, SubjectStockChanged, func(m *nats.Msg) error {
		id, s, err := DecodeStock(m.Data)
		if err != nil {
			return &badEvent{err}
		}
		_, err = handle(ctx, id, s.GetTenantId(), s.GetProductId(), s.GetWarehouseId(), s.GetAvailableMilli())
		return err
	})
}
