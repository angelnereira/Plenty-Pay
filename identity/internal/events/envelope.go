// Package events publica el outbox en NATS JetStream (ADR 0012). El relay lee
// las filas sin publicar en orden de creacion, publica con Nats-Msg-Id igual al
// event_id (JetStream deduplica) y marca published_at solo tras el ack.
package events

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/store"
)

// Subjects de los eventos que publica identity (events-and-messaging.md §7).
const (
	SubjectTenantStatusChanged = "pp.identity.tenant.status_changed.v1"
	SubjectSessionRevoked      = "pp.identity.session.revoked.v1"
)

// EventTypeTenantStatusChanged es el event_type del envelope (sin version,
// events.proto §EventEnvelope).
const EventTypeTenantStatusChanged = "identity.tenant.status_changed"

// EventTypeSessionRevoked es el event_type del envelope (events.proto §6).
const EventTypeSessionRevoked = "identity.session.revoked"

// Envelope arma el sobre canónico del evento listo para publicar.
type Envelope struct {
	Subject   string
	MessageID string
	Bytes     []byte
}

// BuildEnvelope convierte una fila del outbox en el sobre del contrato.
func BuildEnvelope(e store.OutboxEvent, traceID string) (Envelope, error) {
	envelope := &pb.EventEnvelope{
		EventId:       e.ID,
		EventType:     EventTypeTenantStatusChanged,
		SchemaVersion: 1,
		Producer:      "identity",
		TenantId:      e.TenantID,
		AggregateId:   e.AggregateID,
		OccurredAt:    timestamppb.New(e.CreatedAt),
		TraceId:       traceID,
	}
	var payload proto.Message
	switch e.EventType {
	case SubjectTenantStatusChanged:
		var msg pb.TenantStatusChanged
		if err := protojsonUnmarshal(e.Payload, &msg); err != nil {
			return Envelope{}, fmt.Errorf("decode tenant status payload: %w", err)
		}
		payload = &msg
		envelope.EventType = EventTypeTenantStatusChanged
	case SubjectSessionRevoked:
		var msg pb.SessionRevoked
		if err := protojsonUnmarshal(e.Payload, &msg); err != nil {
			return Envelope{}, fmt.Errorf("decode session revoked payload: %w", err)
		}
		payload = &msg
		envelope.EventType = EventTypeSessionRevoked
	default:
		return Envelope{}, errUnknownEvent
	}
	any, err := anypb.New(payload)
	if err != nil {
		return Envelope{}, fmt.Errorf("wrap payload: %w", err)
	}
	envelope.Payload = any

	bytes, err := proto.Marshal(envelope)
	if err != nil {
		return Envelope{}, fmt.Errorf("marshal envelope: %w", err)
	}
	return Envelope{Subject: SubjectTenantStatusChanged, MessageID: e.ID, Bytes: bytes}, nil
}

// errUnknownEvent marca los tipos que identity aun no publica (p. ej. la
// solicitud de notificacion provisional de F08.4, que llegara en F20.2): el
// relay los deja pendientes en vez de perderlos.
var errUnknownEvent = errors.New("tipo de evento sin publicador")

// protojsonUnmarshal decodifica el payload JSON almacenado en el outbox.
func protojsonUnmarshal(b []byte, m proto.Message) error {
	if len(strings.TrimSpace(string(b))) == 0 {
		return fmt.Errorf("payload vacio")
	}
	var raw map[string]any
	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}
	// Mapeo explicito: los nombres del outbox coinciden con los del .proto.
	switch msg := m.(type) {
	case *pb.TenantStatusChanged:
		if v, ok := raw["tenant_id"].(string); ok {
			msg.TenantId = v
		}
		if v, ok := raw["status"].(string); ok {
			msg.Status = parseTenantStatus(v)
		}
		if v, ok := raw["previous_status"].(string); ok && v != "" {
			msg.PreviousStatus = parseTenantStatus(v)
		}
	case *pb.SessionRevoked:
		if v, ok := raw["user_id"].(string); ok {
			msg.UserId = v
		}
		if v, ok := raw["reason"].(string); ok {
			msg.Reason = v
		}
		if raw, ok := raw["session_ids"].([]any); ok {
			for _, s := range raw {
				if str, ok := s.(string); ok {
					msg.SessionIds = append(msg.SessionIds, str)
				}
			}
		}
	default:
		return fmt.Errorf("mensaje no soportado: %T", m)
	}
	return nil
}

func parseTenantStatus(v string) pb.TenantStatus {
	if s, ok := pb.TenantStatus_value["TENANT_STATUS_"+v]; ok {
		return pb.TenantStatus(s)
	}
	return pb.TenantStatus_TENANT_STATUS_UNSPECIFIED
}

// TraceIDFromContext propagaria la traza; hoy vacio (OTEL del contenedor la
// inyectara cuando el relay corra dentro del proceso servidor).
func TraceIDFromContext(_ context.Context) string { return "" }

// now es el reloj inyectado en las pruebas.
var now = time.Now
