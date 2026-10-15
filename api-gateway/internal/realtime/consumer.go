package realtime

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"google.golang.org/protobuf/proto"

	"plentypay/api-gateway/internal/pb"
)

// SubjectSessionRevoked es el subject que publica identity (events-and-messaging.md §7).
const SubjectSessionRevoked = "pp.identity.session.revoked.v1"

// StreamSessionEvents es el stream de JetStream donde vive ese subject.
const StreamSessionEvents = "PP_IDENTITY"

// SessionRevokedConsumer escucha SessionRevoked y cierra las conexiones de esas
// sesiones (SPEC §5 R10: <= 5 s).
type SessionRevokedConsumer struct {
	hub  *Hub
	js   nats.JetStreamContext
	sub  *nats.Subscription
	name string
}

// NewSessionRevokedConsumer se suscribe con un consumidor durable y procesa los
// eventos en cuanto llegan.
func NewSessionRevokedConsumer(ctx context.Context, hub *Hub, url, user, pass string) (*SessionRevokedConsumer, error) {
	return NewSessionRevokedConsumerWithName(ctx, hub, url, user, pass, "api-gateway-realtime")
}

// NewSessionRevokedConsumerWithName es como la anterior pero con un nombre de
// consumidor durable explicito (las pruebas lo hacen unico para no competir).
func NewSessionRevokedConsumerWithName(ctx context.Context, hub *Hub, url, user, pass, durable string) (*SessionRevokedConsumer, error) {
	nc, err := nats.Connect(url, nats.UserInfo(user, pass), nats.Name("api-gateway-realtime"))
	if err != nil {
		return nil, fmt.Errorf("connect nats: %w", err)
	}
	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("jetstream: %w", err)
	}
	c := &SessionRevokedConsumer{hub: hub, js: js, name: durable}
	// Durable: si el gateway se cae, retoma desde donde quedo.
	sub, err := js.Subscribe(SubjectSessionRevoked, c.handle, nats.Durable(c.name), nats.ManualAck(),
		nats.AckWait(5*time.Second), nats.MaxDeliver(10), nats.BindStream(StreamSessionEvents))
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("subscribe: %w", err)
	}
	c.sub = sub
	return c, nil
}

// handle cierra las conexioniones de las sesiones revocadas.
func (c *SessionRevokedConsumer) handle(msg *nats.Msg) {
	var envelope pb.EventEnvelope
	if err := protoUnmarshal(msg.Data, &envelope); err != nil {
		_ = msg.Ack() // mensaje ilegible: no se reintenta infinitamente
		return
	}
	var payload pb.SessionRevoked
	if err := envelope.GetPayload().UnmarshalTo(&payload); err != nil {
		_ = msg.Ack()
		return
	}
	// Cierre inmediato (R10 pide <= 5 s).
	c.hub.CloseSessions(payload.GetSessionIds())
	// Si no vinieron ids, se cierra por usuario.
	if len(payload.GetSessionIds()) == 0 && payload.GetUserId() != "" {
		c.hub.CloseUser(payload.GetUserId())
	}
	_ = msg.Ack()
}

// Close cancela la suscripcion.
func (c *SessionRevokedConsumer) Close() {
	if c.sub != nil {
		_ = c.sub.Unsubscribe()
	}
}

// protoUnmarshal decodifica el sobre protobuf del evento.
func protoUnmarshal(b []byte, m *pb.EventEnvelope) error {
	return proto.Unmarshal(b, m)
}
