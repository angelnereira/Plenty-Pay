package events

import (
	"testing"
	"time"

	"google.golang.org/protobuf/proto"

	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/store"
)

// Cada evento del modelo de acceso se publica en SU subject (no en el de tenant) con el payload
// del contrato decodificado desde el outbox (ADR 0012, ADR 0018).
func TestObs_AccessEventsPublishOnOwnSubject(t *testing.T) {
	cases := []struct {
		subject, eventType, payload string
		msg                         proto.Message
		check                       func(proto.Message) bool
	}{
		{store.EventRoleChanged, EventTypeRoleChanged, `{"tenant_id":"t1","role_id":"r1","version":3,"change":"UPDATED"}`, &pb.RoleChanged{},
			func(m proto.Message) bool {
				r := m.(*pb.RoleChanged)
				return r.RoleId == "r1" && r.Version == 3 && r.Change == "UPDATED"
			}},
		{store.EventMembershipChanged, EventTypeMembershipChanged, `{"tenant_id":"t1","user_id":"u1","change":"SUSPENDED"}`, &pb.MembershipChanged{},
			func(m proto.Message) bool {
				r := m.(*pb.MembershipChanged)
				return r.UserId == "u1" && r.Change == "SUSPENDED"
			}},
		{store.EventCapabilitiesChanged, EventTypeCapabilitiesChanged, `{"tenant_id":"t1","enabled":["pos.tables"],"disabled":["inventory.stock"],"version":2}`, &pb.CapabilitiesChanged{},
			func(m proto.Message) bool {
				r := m.(*pb.CapabilitiesChanged)
				return len(r.Enabled) == 1 && r.Disabled[0] == "inventory.stock" && r.Version == 2
			}},
		{store.EventBranchChanged, EventTypeBranchChanged, `{"tenant_id":"t1","branch_id":"b1","change":"CREATED"}`, &pb.BranchChanged{},
			func(m proto.Message) bool {
				r := m.(*pb.BranchChanged)
				return r.BranchId == "b1" && r.Change == "CREATED"
			}},
	}
	for _, c := range cases {
		env, err := BuildEnvelope(store.OutboxEvent{
			ID: "0b6f8f1e-0000-7000-8000-000000000001", EventType: c.subject, AggregateID: "a1", TenantID: "t1",
			Payload: []byte(c.payload), CreatedAt: time.Now().UTC(),
		}, "trace-1")
		if err != nil {
			t.Fatalf("%s: %v", c.subject, err)
		}
		if env.Subject != c.subject {
			t.Fatalf("subject = %s, se esperaba %s", env.Subject, c.subject)
		}
		var outer pb.EventEnvelope
		if err := proto.Unmarshal(env.Bytes, &outer); err != nil {
			t.Fatalf("envelope: %v", err)
		}
		if outer.GetEventType() != c.eventType || outer.GetTraceId() != "trace-1" {
			t.Fatalf("%s: event_type=%s trace=%s", c.subject, outer.GetEventType(), outer.GetTraceId())
		}
		if err := outer.GetPayload().UnmarshalTo(c.msg); err != nil || !c.check(c.msg) {
			t.Fatalf("%s: payload %v %+v", c.subject, err, c.msg)
		}
	}
}

// Un payload que no corresponde al contrato no se publica a medias: el relay lo deja pendiente.
func TestObs_AccessEventBadPayloadIsRejected(t *testing.T) {
	_, err := BuildEnvelope(store.OutboxEvent{ID: "x", EventType: store.EventRoleChanged, Payload: []byte(`{"version":"tres"}`)}, "")
	if err == nil {
		t.Fatal("un payload inválido debe fallar")
	}
}
