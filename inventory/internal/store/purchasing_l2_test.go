//go:build l2

package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/service"
)

func supplier(t *testing.T, s *service.Inventory, tenant string, lead int) domain.Supplier {
	t.Helper()
	sup, err := s.UpsertSupplier(context.Background(), person(tenant), domain.Supplier{Name: "Distribuidora Uno",
		TaxID: "2588017-1-831938", CheckDigit: "20", LeadTimeDays: lead}, key())
	if err != nil {
		t.Fatal(err)
	}
	return sup
}

// F16.5 y domain-model §8.12: borrador → enviada → recibida en parte → recibida; cada recepción
// genera RECEIPT en la bodega de la orden en la misma transacción, y es idempotente.
func TestL2_F16_5_PurchaseOrderLifecycle(t *testing.T) {
	ctx := context.Background()
	s := svc(t)
	tenant, a, b := id(), id(), id()
	c := person(tenant)
	sup := supplier(t, s, tenant, 5)
	k := key()
	draft := domain.PurchaseOrder{SupplierID: sup.ID, Lines: []domain.POLine{
		{ProductID: a, OrderedMilli: 10_000, UnitCostMinor: 150}, {ProductID: b, OrderedMilli: 2_000, UnitCostMinor: 1_000}}}
	po, err := s.CreatePurchaseOrder(ctx, c, draft, k)
	if err != nil || po.Status != domain.PODraft || po.TotalMinor != 1500+2000 || po.SupplierName != "Distribuidora Uno" || len(po.Lines) != 2 {
		t.Fatalf("borrador: %v %+v", err, po)
	}
	again, err := s.CreatePurchaseOrder(ctx, c, draft, k)
	if err != nil || again.ID != po.ID {
		t.Fatalf("misma clave = misma orden: %v %+v", err, again)
	}
	other := draft
	other.Lines = []domain.POLine{{ProductID: a, OrderedMilli: 1_000, UnitCostMinor: 150}}
	if _, err := s.CreatePurchaseOrder(ctx, c, other, k); !errors.Is(err, domain.ErrKeyReused) {
		t.Fatalf("misma clave con otro contenido: %v", err)
	}
	if _, err := s.ReceiveGoods(ctx, c, po.ID, key(), "", []domain.Received{{ProductID: a, ReceivedMilli: 1_000}}); !errors.Is(err, domain.ErrPOTransition) {
		t.Fatalf("un borrador no recibe: %v", err)
	}
	if po, err = s.UpdatePurchaseOrderStatus(ctx, tenant, po.ID, domain.POSent); err != nil || po.Status != domain.POSent {
		t.Fatalf("enviar: %v %+v", err, po)
	}
	rk := key()
	po, err = s.ReceiveGoods(ctx, c, po.ID, rk, "F-001", []domain.Received{{ProductID: a, ReceivedMilli: 4_000}})
	if err != nil || po.Status != domain.POPartial || po.Lines[0].ReceivedMilli+po.Lines[1].ReceivedMilli != 4_000 {
		t.Fatalf("recepción parcial: %v %+v", err, po)
	}
	if _, err := s.ReceiveGoods(ctx, c, po.ID, rk, "F-001", []domain.Received{{ProductID: a, ReceivedMilli: 4_000}}); err != nil {
		t.Fatalf("reintento: %v", err)
	}
	if onHand(t, s, tenant, a) != 4_000 {
		t.Fatalf("el reintento no suma dos veces: %d", onHand(t, s, tenant, a))
	}
	if _, err := s.ReceiveGoods(ctx, c, po.ID, key(), "", []domain.Received{{ProductID: a, ReceivedMilli: 7_000}}); !errors.Is(err, domain.ErrOverReceipt) {
		t.Fatalf("exceso: %v", err)
	}
	if onHand(t, s, tenant, a) != 4_000 {
		t.Fatal("una recepción rechazada no mueve existencias")
	}
	po, err = s.ReceiveGoods(ctx, c, po.ID, key(), "F-002", []domain.Received{{ProductID: a, ReceivedMilli: 6_000}, {ProductID: b, ReceivedMilli: 2_000}})
	if err != nil || po.Status != domain.POReceived {
		t.Fatalf("recepción total: %v %+v", err, po)
	}
	if onHand(t, s, tenant, b) != 2_000 {
		t.Fatal("RECEIPT de la segunda línea")
	}
	if n := count(t, tenant, `SELECT count(*) FROM movements WHERE reference_type = 'purchase_order' AND reference_id = $1`, po.ID); n != 3 {
		t.Fatalf("movimientos RECEIPT con la referencia de la orden: %d", n)
	}
	if _, err := s.UpdatePurchaseOrderStatus(ctx, tenant, po.ID, domain.POCancelled); !errors.Is(err, domain.ErrPOTransition) {
		t.Fatalf("una orden recibida no se cancela: %v", err)
	}
	list, _, err := s.ListPurchaseOrders(ctx, tenant, domain.POReceived, "", 10)
	if err != nil || len(list) != 1 {
		t.Fatalf("lista por estado: %v %d", err, len(list))
	}
	// RLS: otro negocio no ve la orden.
	if _, err := s.GetPurchaseOrder(ctx, id(), po.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("RLS: %v", err)
	}
}

// R6: con 2 unidades vendidas por día durante 28 días y 10 disponibles, el proveedor de la última
// orden (plazo 5) da 5 días de cobertura < 12 → pedir 2 × 19 − 10 − en tránsito.
func TestL2_R6_ReorderSuggestions(t *testing.T) {
	ctx := context.Background()
	tenant, p := id(), id()
	now := time.Now().UTC()
	s := svc(t)
	receive(t, s, tenant, p, 66_000)
	for d := 28; d >= 1; d-- {
		at := now.Add(-time.Duration(d) * 24 * time.Hour)
		day := service.New(open(t), products{}, func() time.Time { return at }, service.NewUUIDv7)
		if _, err := day.AdjustStock(ctx, pos(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: p,
			DeltaMilli: -2_000, Type: domain.Sale, ReferenceType: "sale", ReferenceID: id()}); err != nil {
			t.Fatal(err)
		}
	}
	if onHand(t, s, tenant, p) != 10_000 {
		t.Fatalf("existencias: %d", onHand(t, s, tenant, p))
	}
	sup := supplier(t, s, tenant, 5)
	po, err := s.CreatePurchaseOrder(ctx, person(tenant), domain.PurchaseOrder{SupplierID: sup.ID,
		Lines: []domain.POLine{{ProductID: p, OrderedMilli: 6_000, UnitCostMinor: 100}}}, key())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpdatePurchaseOrderStatus(ctx, tenant, po.ID, domain.POSent); err != nil {
		t.Fatal(err)
	}
	list, rows, err := s.ReorderSuggestions(ctx, tenant, "")
	if err != nil || len(list) != 1 {
		t.Fatalf("%v %+v", err, list)
	}
	g := list[0]
	if g.VelocityMilli != 2_000 || g.DaysOfCover != 5 || g.InTransitMilli != 6_000 || g.LeadTimeDays != 5 ||
		g.SuggestedMilli != 2_000*19-10_000-6_000 || g.ABC != "A" {
		t.Fatalf("%+v", g)
	}
	if r := rows[g.WarehouseID+"/"+g.ProductID]; r.SupplierName != "Distribuidora Uno" {
		t.Fatalf("proveedor habitual: %+v", r)
	}
}
