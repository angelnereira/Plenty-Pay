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

func sentOrder(t *testing.T, s *service.Inventory, c service.Caller, lines ...domain.POLine) domain.PurchaseOrder {
	t.Helper()
	ctx := context.Background()
	sup, err := s.UpsertSupplier(ctx, c, domain.Supplier{Name: "Distribuidora Chiricana"}, key())
	if err != nil {
		t.Fatal(err)
	}
	po, err := s.CreatePurchaseOrder(ctx, c, domain.PurchaseOrder{SupplierID: sup.ID, Lines: lines}, key())
	if err != nil {
		t.Fatal(err)
	}
	if po, err = s.UpdatePurchaseOrderStatus(ctx, c, po.ID, domain.POSent, ""); err != nil {
		t.Fatal(err)
	}
	return po
}

// R10 · F16.12: lo dañado entra bloqueado en la misma transacción (nunca queda disponible, aunque
// haya reservas), queda como incidencia y un reintento no lo repite; con lotes, sale del mismo lote.
func TestL2_R10_DamagedEntersBlockedAndIsAnIssue(t *testing.T) {
	ctx, tenant, prod, lotted := context.Background(), id(), id(), id()
	s := svcWith(t, products{lots: map[string]bool{lotted: true}})
	c := person(tenant)
	receive(t, s, tenant, prod, 2000)
	if _, err := reserve(s, tenant, prod, 2000, 300); err != nil {
		t.Fatal(err)
	}
	po := sentOrder(t, s, c, domain.POLine{ProductID: prod, OrderedMilli: 10_000, UnitCostMinor: 100},
		domain.POLine{ProductID: lotted, OrderedMilli: 4000, UnitCostMinor: 300})

	if _, err := s.ReceiveGoods(ctx, c, po.ID, key(), "", []domain.Received{{ProductID: prod, ReceivedMilli: 1000, DamagedMilli: 1001}}); !errors.Is(err, domain.ErrInvalidOrder) {
		t.Fatalf("dañado mayor que lo recibido: %v", err)
	}
	k := key()
	in := []domain.Received{
		{ProductID: prod, ReceivedMilli: 6000, DamagedMilli: 4000},
		{ProductID: lotted, ReceivedMilli: 4000, DamagedMilli: 1000, LotCode: "L-77", LotExpiresOn: inDays(90)},
	}
	for i := 0; i < 2; i++ {
		if po, err := s.ReceiveGoods(ctx, c, po.ID, k, "F-9", in); err != nil || po.Status != domain.POPartial {
			t.Fatalf("recepción %d: %v %v", i, err, po.Status)
		}
	}
	l := stock(t, s, tenant, prod)
	// 2 previos (reservados) + 6 recibidos de los que 4 llegaron dañados → disponible 2.
	if l.OnHandMilli != 8000 || l.ReservedMilli != 2000 || l.BlockedMilli != 4000 || l.Available() != 2000 {
		t.Fatalf("existencia: %+v disponible %d", l, l.Available())
	}
	lots, _, err := s.ListLots(ctx, tenant, service.LotsRequest{ProductID: lotted})
	if err != nil || len(lots) != 1 || lots[0].OnHandMilli != 4000 || lots[0].BlockedMilli != 1000 {
		t.Fatalf("lote: %+v %v", lots, err)
	}
	if n := count(t, tenant, `SELECT count(*) FROM movements WHERE idempotency_key = $1 AND type = 8`, k); n != 2 {
		t.Fatalf("un BLOCK por línea dañada, sin duplicar en el reintento: %d", n)
	}
	issues, err := open(t).ListIssues(ctx, tenant, po.ID)
	if err != nil || len(issues) != 2 || issues[0].Kind != 1 || issues[0].Reason != "dañado en recepción" {
		t.Fatalf("incidencias: %+v %v", issues, err)
	}
	got, err := s.GetPurchaseOrder(ctx, tenant, po.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range got.Lines {
		want := map[string]int64{prod: 4000, lotted: 1000}[line.ProductID]
		if line.DamagedMilli != want {
			t.Fatalf("dañado de la línea %s: %d (quiero %d)", line.ProductID, line.DamagedMilli, want)
		}
	}
	w, err := s.DefaultWarehouse(ctx, tenant)
	if err != nil {
		t.Fatal(err)
	}
	blocked, err := open(t).SumOfBlocks(ctx, tenant, w.ID, prod)
	if err != nil {
		t.Fatal(err)
	}
	if blocked != 4000 {
		t.Fatalf("R1: bloqueado = Σ BLOCK/UNBLOCK: %d", blocked)
	}
}

// R10: «Cerrar con faltante» exige motivo, solo desde recibida en parte, guarda un faltante por
// línea incompleta, deja de estar en camino y repetirlo no duplica nada.
func TestL2_R10_CloseShortRecordsShortagesOnce(t *testing.T) {
	ctx, tenant, a, b := context.Background(), id(), id(), id()
	s := svc(t)
	c := person(tenant)
	po := sentOrder(t, s, c, domain.POLine{ProductID: a, OrderedMilli: 10_000, UnitCostMinor: 100},
		domain.POLine{ProductID: b, OrderedMilli: 5000, UnitCostMinor: 100})
	if _, err := s.UpdatePurchaseOrderStatus(ctx, c, po.ID, domain.POClosedShort, "no llegó"); !errors.Is(err, domain.ErrPOTransition) {
		t.Fatalf("cerrar una orden sin recibir nada: %v", err)
	}
	if _, err := s.ReceiveGoods(ctx, c, po.ID, key(), "", []domain.Received{
		{ProductID: a, ReceivedMilli: 7000}, {ProductID: b, ReceivedMilli: 5000}}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpdatePurchaseOrderStatus(ctx, c, po.ID, domain.POClosedShort, "  "); !errors.Is(err, domain.ErrCloseReasonRequired) {
		t.Fatalf("sin motivo: %v", err)
	}
	for i := 0; i < 2; i++ {
		got, err := s.UpdatePurchaseOrderStatus(ctx, c, po.ID, domain.POClosedShort, "el proveedor no tiene más")
		if err != nil || got.Status != domain.POClosedShort || got.CloseReason != "el proveedor no tiene más" {
			t.Fatalf("cierre %d: %v %+v", i, err, got)
		}
	}
	issues, err := open(t).ListIssues(ctx, tenant, po.ID)
	if err != nil || len(issues) != 1 || issues[0].ProductID != a || issues[0].Kind != 2 || issues[0].QtyMilli != 3000 {
		t.Fatalf("un faltante de 3 en la línea incompleta: %+v %v", issues, err)
	}
	if _, err := s.ReceiveGoods(ctx, c, po.ID, key(), "", []domain.Received{{ProductID: a, ReceivedMilli: 1000}}); !errors.Is(err, domain.ErrPOTransition) {
		t.Fatalf("una orden cerrada no recibe: %v", err)
	}
	if onHand(t, s, tenant, a) != 7000 {
		t.Fatal("cerrar nunca borra lo recibido")
	}
	// Lo que faltaba deja de contar como en camino (R6).
	rows, err := open(t).ReorderData(ctx, tenant, "", time.Now().UTC(), nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range rows {
		if r.ProductID == a && r.InTransitMilli != 0 {
			t.Fatalf("en camino tras cerrar: %d", r.InTransitMilli)
		}
	}
}
