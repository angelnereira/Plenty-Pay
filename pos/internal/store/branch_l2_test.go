//go:build l2

package store_test

import (
	"context"
	"errors"
	"testing"

	"plentypay/pos/internal/client"
	"plentypay/pos/internal/domain"
	"plentypay/pos/internal/service"
	"plentypay/pos/internal/store"
)

type fakeBranches struct {
	list []domain.Branch
	err  error
}

func (f *fakeBranches) ListBranches(context.Context, client.Who) ([]domain.Branch, error) {
	return f.list, f.err
}

func withScope(a service.Actor, raw string) service.Actor {
	sc := domain.ParseBranchScope(raw)
	a.Scope = &sc
	return a
}

// ADR 0018 · R15: la venta copia la sucursal de su sesión; un cajero con alcance a A no abre en B,
// no ve ni opera ventas de B; sin alcance no abre ninguna; con `*` la sucursal se valida en identity.
func TestADR0018_PosBranchOutOfScope(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a, b := id(), id()
	fb := &fakeBranches{list: []domain.Branch{{ID: a, Code: "0000", Active: true}, {ID: b, Code: "0001", Active: true},
		{ID: id(), Code: "0002", Active: false}}}
	w.svc.UseBranches(fb)

	cashierA := withScope(cashier(tenant), a)
	if _, err := w.svc.OpenSession(ctx, cashierA, "CAJA-B1", 0, "USD", b); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("abrir en otra sucursal: %v", err)
	}
	if _, err := w.svc.OpenSession(ctx, cashierA, "CAJA-A1", 0, "USD", ""); !errors.Is(err, domain.ErrBranchRequired) {
		t.Fatalf("una persona elige la sucursal: %v", err)
	}
	ssA, err := w.svc.OpenSession(ctx, cashierA, "CAJA-A1", 0, "USD", a)
	if err != nil || ssA.BranchID != a {
		t.Fatalf("abrir en su sucursal: %+v %v", ssA, err)
	}
	saleA, err := w.svc.CreateSale(ctx, cashierA, ssA.ID, "")
	if err != nil || saleA.BranchID != a {
		t.Fatalf("la venta copia la sucursal de la sesión: %+v %v", saleA, err)
	}

	owner := withScope(cashier(tenant), "*")
	if _, err := w.svc.OpenSession(ctx, owner, "CAJA-X", 0, "USD", id()); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("con * una sucursal ajena se rechaza: %v", err)
	}
	if _, err := w.svc.OpenSession(ctx, owner, "CAJA-X", 0, "USD", fb.list[2].ID); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("con * una sucursal inactiva se rechaza: %v", err)
	}
	ssB, err := w.svc.OpenSession(ctx, owner, "CAJA-B1", 0, "USD", b)
	if err != nil {
		t.Fatal(err)
	}
	saleB, err := w.svc.CreateSale(ctx, owner, ssB.ID, "")
	if err != nil || saleB.BranchID != b {
		t.Fatalf("venta en B: %+v %v", saleB, err)
	}

	// El cajero de A no ve ni opera lo de B.
	if _, err := w.svc.GetSale(ctx, cashierA, saleB.ID); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("leer una venta de B: %v", err)
	}
	if _, err := w.svc.GetSession(ctx, cashierA, ssB.ID); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("leer la sesión de B: %v", err)
	}
	if _, err := w.svc.VoidSale(ctx, cashierA, saleB.ID, "error"); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("anular una venta de B: %v", err)
	}
	if _, err := w.svc.RecordCashMovement(ctx, cashierA, ssB.ID, "OUT", 100, "retiro"); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("mover efectivo de B: %v", err)
	}
	if _, err := w.svc.CloseSession(ctx, cashierA, ssB.ID, amt(0), nil, ""); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("cerrar la caja de B: %v", err)
	}
	list, _, err := w.svc.ListSales(ctx, cashierA, store.SaleFilter{Limit: 50})
	if err != nil || len(list) != 1 || list[0].ID != saleA.ID {
		t.Fatalf("historial solo de su sucursal: %+v %v", list, err)
	}
	if all, _, err := w.svc.ListSales(ctx, owner, store.SaleFilter{Limit: 50}); err != nil || len(all) != 2 {
		t.Fatalf("con * se ven las dos: %d %v", len(all), err)
	}

	// Sin cabecera de alcance: ninguna sucursal.
	none := withScope(cashier(tenant), "")
	if _, err := w.svc.OpenSession(ctx, none, "CAJA-N", 0, "USD", a); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("sin alcance no abre: %v", err)
	}
	if l, _, err := w.svc.ListSales(ctx, none, store.SaleFilter{Limit: 50}); err != nil || len(l) != 0 {
		t.Fatalf("sin alcance no ve ventas: %+v %v", l, err)
	}

	// Sin identity no se puede validar la sucursal con *.
	w.svc.UseBranches(nil)
	if _, err := w.svc.OpenSession(ctx, owner, "CAJA-Y", 0, "USD", a); !errors.Is(err, service.ErrBranchesUnavailable) {
		t.Fatalf("sin identity: %v", err)
	}
}
