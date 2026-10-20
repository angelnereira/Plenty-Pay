package events

import (
	"testing"
	"time"

	"google.golang.org/protobuf/proto"

	"plentypay/catalog/internal/pb"
	"plentypay/catalog/internal/store"
)

func TestADR0012_EnvelopeCarriesTypedPayload(t *testing.T) {
	payload, err := proto.Marshal(&pb.ProductChanged{ProductId: "p1", Name: "Café"})
	if err != nil {
		t.Fatal(err)
	}
	b, err := Envelope(store.OutboxEvent{ID: "e1", TenantID: "t1", AggregateID: "p1",
		Subject: SubjectProductChanged, Payload: payload, CreatedAt: time.Unix(0, 0)})
	if err != nil {
		t.Fatal(err)
	}
	var env pb.EventEnvelope
	if err := proto.Unmarshal(b, &env); err != nil {
		t.Fatal(err)
	}
	if env.GetEventType() != "catalog.product.changed" || env.GetProducer() != "catalog" || env.GetEventId() != "e1" {
		t.Fatalf("%+v", &env)
	}
	var got pb.ProductChanged
	if err := env.GetPayload().UnmarshalTo(&got); err != nil || got.GetName() != "Café" {
		t.Fatalf("payload: %v %+v", err, &got)
	}
	if _, err := Envelope(store.OutboxEvent{Subject: "pp.catalog.unknown.v1"}); err == nil {
		t.Fatal("subject sin tipo debe fallar")
	}
}
