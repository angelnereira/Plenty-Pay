package events

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/nats-io/nats.go"

	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/store"
)

// Relay publica el outbox en JetStream (ADR 0012, events-and-messaging.md §4).
// Garantía: al menos una vez, orden por entidad, sin pérdida.
type Relay struct {
	tenants store.TenantStore
	nc      *nats.Conn
	js      nats.JetStreamContext
	logger  *slog.Logger
	metrics *observability.Metrics
	batch   int
	every   time.Duration
}

// NewRelay conecta con NATS (credenciales del servicio en el entorno).
func NewRelay(ctx context.Context, tenants store.TenantStore, url, user, pass string, logger *slog.Logger, metrics *observability.Metrics) (*Relay, error) {
	opts := []nats.Option{
		nats.Name("identity-outbox-relay"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2 * time.Second),
	}
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
	return &Relay{
		tenants: tenants, nc: nc, js: js, logger: logger, metrics: metrics,
		batch: 100, every: 500 * time.Millisecond,
	}, nil
}

// Close cierra la conexion (apagado ordenado).
func (r *Relay) Close() { r.nc.Close() }

// Run publica pendientes hasta que el contexto se cancele.
func (r *Relay) Run(ctx context.Context) error {
	ticker := time.NewTicker(r.every)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if _, err := r.PublishOnce(ctx); err != nil {
				r.logger.Error("outbox relay iteration failed", "err", err.Error())
			}
		}
	}
}

// PublishOnce publica un lote y devuelve cuantos eventos salieron. Las pruebas
// L2 la usan directamente para verificar el exactamente-uno-por-transicion.
func (r *Relay) PublishOnce(ctx context.Context) (int, error) {
	pending, err := r.tenants.OutboxPending(ctx, r.batch)
	if err != nil {
		return 0, err
	}
	published := 0
	for _, e := range pending {
		env, err := BuildEnvelope(e, TraceIDFromContext(ctx))
		if err != nil {
			if errors.Is(err, errUnknownEvent) {
				// Sin publicador todavia: la fila sigue pendiente (no se pierde)
				// y el lote continua con el resto.
				r.logger.Warn("outbox event without publisher, left pending", "event_type", e.EventType, "event_id", e.ID)
				continue
			}
			return published, err
		}
		// Nats-Msg-Id = event_id: si el ack se perdio y reintentamos,
		// JetStream descarta el duplicado (dedupe de 2 min del stream).
		if _, err := r.js.Publish(env.Subject, env.Bytes, nats.MsgId(env.MessageID)); err != nil {
			return published, fmt.Errorf("publish %s: %w", env.MessageID, err)
		}
		if err := r.tenants.OutboxMarkPublished(ctx, e.ID); err != nil {
			return published, err
		}
		published++
		if r.metrics != nil {
			r.metrics.Inc("pp_outbox_published_total", "event_type", env.Subject)
		}
	}
	return published, nil
}

// errRelayStopped permite a las pruebas detener el bucle limpiamente.
var errRelayStopped = errors.New("relay detenido")
