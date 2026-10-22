// Package events publica el outbox de pos en JetStream (ADR 0012): al menos una vez, en orden
// de creación, con Nats-Msg-Id = event_id para que JetStream descarte los duplicados.
package events

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/nats-io/nats.go"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/pos/internal/observability"
	"plentypay/pos/internal/pb"
	"plentypay/pos/internal/store"
)

// Producer es el nombre del contenedor en el sobre.
const Producer = "pos"

// SubjectSalePaid (events-and-messaging.md §7): lo consumen analytics-bi, notifications y fiscal.
const SubjectSalePaid = "pp.pos.sale.paid.v1"

// SubjectSaleRefunded (events-and-messaging.md §7, F17.9): lo consume analytics-bi.
const SubjectSaleRefunded = "pp.pos.sale.refunded.v1"

// typeURLs: el mensaje proto que viaja en cada subject.
var typeURLs = map[string]string{
	SubjectSalePaid:     "type.googleapis.com/plentypay.pos.v1.SalePaid",
	SubjectSaleRefunded: "type.googleapis.com/plentypay.pos.v1.SaleRefunded",
}

// Outbox es lo que el relay necesita del store.
type Outbox interface {
	OutboxPending(ctx context.Context, limit int) ([]store.OutboxEvent, error)
	OutboxMarkPublished(ctx context.Context, id string, at time.Time) error
}

// eventType: "pp.catalog.product.changed.v1" → "catalog.product.changed".
func eventType(subject string) string {
	return strings.TrimSuffix(strings.TrimPrefix(subject, "pp."), ".v1")
}

// Envelope serializa la fila del outbox en el sobre canónico (events.proto EventEnvelope).
func Envelope(e store.OutboxEvent) ([]byte, error) {
	typeURL, ok := typeURLs[e.Subject]
	if !ok {
		return nil, fmt.Errorf("subject sin tipo registrado: %s", e.Subject)
	}
	env := &pb.EventEnvelope{
		EventId:       e.ID,
		EventType:     eventType(e.Subject),
		SchemaVersion: 1,
		Producer:      Producer,
		TenantId:      e.TenantID,
		AggregateId:   e.AggregateID,
		OccurredAt:    timestamppb.New(e.CreatedAt),
		Payload:       &anypb.Any{TypeUrl: typeURL, Value: e.Payload},
	}
	b, err := proto.Marshal(env)
	if err != nil {
		return nil, fmt.Errorf("marshal envelope: %w", err)
	}
	return b, nil
}

// Relay publica pendientes cada 500 ms.
type Relay struct {
	outbox   Outbox
	nc       *nats.Conn
	js       nats.JetStreamContext
	logger   *slog.Logger
	reporter *observability.Reporter
	metrics  *observability.Metrics
	now      func() time.Time
}

// NewRelay conecta con NATS con las credenciales del servicio.
func NewRelay(outbox Outbox, url, user, pass string, logger *slog.Logger, reporter *observability.Reporter,
	metrics *observability.Metrics, now func() time.Time) (*Relay, error) {
	opts := []nats.Option{nats.Name(Producer + "-outbox-relay"), nats.MaxReconnects(-1), nats.ReconnectWait(2 * time.Second)}
	if user != "" {
		opts = append(opts, nats.UserInfo(user, pass))
	}
	nc, err := nats.Connect(url, opts...)
	if err != nil {
		return nil, fmt.Errorf("connect nats: %w", err)
	}
	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("jetstream context: %w", err)
	}
	return &Relay{outbox: outbox, nc: nc, js: js, logger: logger, reporter: reporter, metrics: metrics, now: now}, nil
}

// Close cierra la conexión.
func (r *Relay) Close() { r.nc.Close() }

// Run publica hasta que se cancele el contexto; cada fallo se registra una vez y se reintenta.
func (r *Relay) Run(ctx context.Context) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := r.PublishOnce(ctx); err != nil {
				r.reporter.Dependency(ctx, "outbox relay iteration failed", "event-bus", err)
			}
		}
	}
}

// PublishOnce publica un lote; se detiene en el primer fallo para conservar el orden.
func (r *Relay) PublishOnce(ctx context.Context) (int, error) {
	pending, err := r.outbox.OutboxPending(ctx, 100)
	if err != nil {
		return 0, observability.Wrap(err, "read outbox")
	}
	n := 0
	for _, e := range pending {
		b, err := Envelope(e)
		if err != nil {
			return n, observability.Wrap(err, "build envelope")
		}
		if _, err := r.js.Publish(e.Subject, b, nats.MsgId(e.ID), nats.Context(ctx)); err != nil {
			return n, observability.Wrap(err, "publish event")
		}
		if err := r.outbox.OutboxMarkPublished(ctx, e.ID, r.now()); err != nil {
			return n, observability.Wrap(err, "mark published")
		}
		r.metrics.Inc("pp_outbox_published_total", "subject", e.Subject)
		n++
	}
	return n, nil
}
