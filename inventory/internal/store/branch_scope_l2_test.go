//go:build l2

package store_test

import (
	"context"
	"errors"
	"testing"

	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/service"
)

type fakeBranches struct {
	list []domain.Branch
	err  error
	n    int
}

func (f *fakeBranches) ListBranches(context.Context) ([]domain.Branch, error) {
	f.n++
	return f.list, f.err
}

func scoped(branches ...string) context.Context {
	sc := domain.BranchScope{Branches: map[string]bool{}}
	for _, b := range branches {
		sc.Branches[b] = true
	}
	return service.WithBranchScope(context.Background(), sc)
}

func allScope() context.Context {
	return service.WithBranchScope(context.Background(), domain.BranchScope{All: true})
}

// ADR 0018 · R11 (V3/V7 en bodegas): con alcance a la sucursal A no se ve ni se mueve nada de B;
// la transferencia exige alcance sobre origen y destino; sin alcance no se alcanza ninguna bodega.
func TestADR0018_BranchOutOfScope(t *testing.T) {
	bg, tenant, product := context.Background(), id(), id()
	s := svc(t)
	a, b := id(), id()
	wa, err := s.UpsertWarehouse(bg, tenant, domain.Warehouse{Name: "Sucursal A", BranchID: a})
	if err != nil {
		t.Fatal(err)
	}
	wb, err := s.UpsertWarehouse(bg, tenant, domain.Warehouse{Name: "Sucursal B", BranchID: b})
	if err != nil {
		t.Fatal(err)
	}
	for _, w := range []string{wa.ID, wb.ID} {
		if _, err := s.AdjustStock(bg, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
			WarehouseID: w, DeltaMilli: 5000, Type: domain.Receipt}); err != nil {
			t.Fatal(err)
		}
	}
	ca := scoped(a)
	adj := func(ctx context.Context, w string) error {
		_, err := s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
			WarehouseID: w, DeltaMilli: -1000, Type: domain.WriteOff, Reason: "daño"})
		return err
	}
	if err := adj(ca, wb.ID); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("V3: ajuste en otra sucursal: %v", err)
	}
	if err := adj(ca, wa.ID); err != nil {
		t.Fatalf("ajuste en su sucursal: %v", err)
	}
	if _, _, err := s.TransferStock(ca, person(tenant), key(), product, wa.ID, wb.ID, 1000, "reposición", ""); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("V7: transferir a una sucursal fuera de alcance: %v", err)
	}
	ws, err := s.ListWarehouses(ca, tenant)
	if err != nil || len(ws) != 1 || ws[0].ID != wa.ID {
		t.Fatalf("solo su bodega (la por defecto, sin sucursal, tampoco): %+v %v", ws, err)
	}
	levels, _, err := s.ListStock(ca, tenant, "", false, "", 100)
	if err != nil || len(levels) != 1 || levels[0].WarehouseID != wa.ID {
		t.Fatalf("existencias filtradas: %+v %v", levels, err)
	}
	if l, err := s.GetStock(ca, tenant, product, ""); err != nil || l.OnHandMilli != 4000 {
		t.Fatalf("total solo de su alcance: %+v %v", l, err)
	}
	if _, err := s.GetStock(ca, tenant, product, wb.ID); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("leer una bodega fuera de alcance: %v", err)
	}
	if _, err := s.UpsertWarehouse(ca, tenant, domain.Warehouse{Name: "Nueva en B", BranchID: b}); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("crear bodega en otra sucursal: %v", err)
	}
	if _, err := s.UpsertWarehouse(ca, tenant, domain.Warehouse{Name: "Nueva sin sucursal"}); !errors.Is(err, domain.ErrInvalidWarehouse) {
		t.Fatalf("una persona debe indicar la sucursal: %v", err)
	}
	if _, err := s.UpsertWarehouse(ca, tenant, domain.Warehouse{Name: "Trastienda A", BranchID: a}); err != nil {
		t.Fatalf("crear bodega en su sucursal: %v", err)
	}
	c := person(tenant)
	sup, err := s.UpsertSupplier(bg, c, domain.Supplier{Name: "Distribuidora"}, key())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreatePurchaseOrder(ca, c, domain.PurchaseOrder{SupplierID: sup.ID, WarehouseID: wb.ID,
		Lines: []domain.POLine{{ProductID: product, OrderedMilli: 1000, UnitCostMinor: 100}}}, key()); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("orden de compra para otra sucursal: %v", err)
	}
	if _, err := s.CreatePurchaseOrder(bg, c, domain.PurchaseOrder{SupplierID: sup.ID, WarehouseID: wb.ID,
		Lines: []domain.POLine{{ProductID: product, OrderedMilli: 1000, UnitCostMinor: 100}}}, key()); err != nil {
		t.Fatal(err)
	}
	if orders, _, err := s.ListPurchaseOrders(ca, tenant, 0, "", 50); err != nil || len(orders) != 0 {
		t.Fatalf("órdenes de otra sucursal no se ven: %+v %v", orders, err)
	}
	none := service.WithBranchScope(bg, domain.ParseBranchScope(""))
	if ws, err := s.ListWarehouses(none, tenant); err != nil || len(ws) != 0 {
		t.Fatalf("sin alcance no se ve ninguna bodega: %+v %v", ws, err)
	}
	if err := adj(none, ""); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("sin alcance, ni la bodega por defecto: %v", err)
	}
	// Las llamadas de servicio (pos, orders) no se filtran.
	if _, err := s.AdjustStock(bg, pos(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		WarehouseID: wb.ID, DeltaMilli: -1000, Type: domain.Sale, ReferenceType: "sale", ReferenceID: id()}); err != nil {
		t.Fatalf("pos vende en cualquier bodega: %v", err)
	}
}

// R11: con alcance `*`, la bodega sin sucursal recibe la Casa Matriz de identity (una vez); si
// identity no responde, la lista sale igual y la asignación espera.
func TestF16_9_MainBranchAssignedByTenantScope(t *testing.T) {
	tenant, main, other := id(), id(), id()
	s := svc(t)
	fb := &fakeBranches{err: errors.New("identity caído")}
	s.UseBranches(fb)
	ws, err := s.ListWarehouses(allScope(), tenant)
	var partial *service.PartialError
	if !errors.As(err, &partial) || len(ws) != 1 || ws[0].BranchID != "" {
		t.Fatalf("identity caído: lista igual y sin asignar: %+v %v", ws, err)
	}
	fb.err = nil
	fb.list = []domain.Branch{{ID: other, Code: "0001", Active: true}, {ID: main, Code: "0000", Active: true}}
	ws, err = s.ListWarehouses(allScope(), tenant)
	if err != nil || len(ws) != 1 || ws[0].BranchID != main {
		t.Fatalf("Casa Matriz asignada: %+v %v", ws, err)
	}
	calls := fb.n
	if _, err := s.ListWarehouses(allScope(), tenant); err != nil || fb.n != calls {
		t.Fatalf("ya asignada: no vuelve a preguntar a identity (%d → %d) %v", calls, fb.n, err)
	}
	if ws, err := s.ListWarehouses(scoped(main), tenant); err != nil || len(ws) != 1 {
		t.Fatalf("quien tiene la Casa Matriz ya la ve: %+v %v", ws, err)
	}
	// Crear con alcance `*`: la sucursal debe existir y estar activa en identity.
	if _, err := s.UpsertWarehouse(allScope(), tenant, domain.Warehouse{Name: "X", BranchID: id()}); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("sucursal ajena: %v", err)
	}
	fb.list = append(fb.list, domain.Branch{ID: id(), Code: "0002", Active: false})
	if _, err := s.UpsertWarehouse(allScope(), tenant, domain.Warehouse{Name: "Inactiva", BranchID: fb.list[2].ID}); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("sucursal inactiva: %v", err)
	}
	if w, err := s.UpsertWarehouse(allScope(), tenant, domain.Warehouse{Name: "Sucursal 0001", BranchID: other}); err != nil || w.BranchID != other {
		t.Fatalf("sucursal válida: %+v %v", w, err)
	}
	s.UseBranches(nil)
	if _, err := s.UpsertWarehouse(allScope(), tenant, domain.Warehouse{Name: "Sin identity", BranchID: other}); !errors.Is(err, service.ErrBranchesUnavailable) {
		t.Fatalf("sin identity no se puede validar: %v", err)
	}
}
