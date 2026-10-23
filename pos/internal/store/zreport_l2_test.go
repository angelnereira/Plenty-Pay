//go:build l2

package store_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"plentypay/pos/internal/domain"
	"plentypay/pos/internal/service"
	"plentypay/pos/internal/store"
)

// F17.3 · R16: al cerrar se guarda el reporte Z con lo ocurrido en la sesión (ventas por medio,
// ITBMS por tasa, exento, devolución, entrada y anulación) y el conteo por denominación; leer la
// sesión lo devuelve igual y un segundo cierre no lo cambia.
func TestL2_F17_3_CloseStoresZReport(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	refunding(t, w)

	cash := openSale(t, w, a, "CAJA-Z1", service.LineInput{ProductID: w.cafe, QtyMilli: 2000})
	cash, err := w.svc.Checkout(ctx, a, cash.ID, []domain.Tender{{Rail: domain.RailCash, AmountMinor: 3700, CashTendered: 4000}})
	if err != nil || cash.Status != domain.Paid {
		t.Fatalf("venta en efectivo: %v %v", err, cash.Status)
	}
	wallet := openSale(t, w, a, "CAJA-Z1", service.LineInput{ProductID: w.servicio, QtyMilli: 1000})
	if _, err := w.svc.Checkout(ctx, a, wallet.ID, []domain.Tender{{Rail: domain.RailWallet, AmountMinor: 300}}); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.HandlePayment(ctx, store.PaymentEvent{EventID: id(), TenantID: tenant, SaleID: wallet.ID, Amount: 300, Captured: true}); err != nil {
		t.Fatal(err)
	}
	voided := openSale(t, w, a, "CAJA-Z1", service.LineInput{ProductID: w.pan, QtyMilli: 1000})
	if _, err := w.svc.VoidSale(ctx, a, voided.ID, "cliente se arrepintió"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := w.svc.RefundSale(ctx, a, refundReq(cash, 1000, key16(), "ok")); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.RecordCashMovement(ctx, a, cash.SessionID, "IN", 1000, "cambio"); err != nil {
		t.Fatal(err)
	}

	// Esperado = 50.00 fondo + 37.00 venta − 18.50 devolución + 10.00 entrada = 78.50.
	counts := []domain.CashCount{{DenominationMinor: 2000, Quantity: 3}, {DenominationMinor: 1000, Quantity: 1}, {DenominationMinor: 500, Quantity: 1}, {DenominationMinor: 100, Quantity: 3}, {DenominationMinor: 25, Quantity: 2}, {DenominationMinor: 1, Quantity: 0}}
	if _, err := w.svc.CloseSession(ctx, a, cash.SessionID, amt(7000), counts, ""); !errors.Is(err, domain.ErrInvalidCount) {
		t.Fatalf("monto que no cuadra con el conteo: %v", err)
	}
	closed, err := w.svc.CloseSession(ctx, a, cash.SessionID, nil, counts, "")
	if err != nil {
		t.Fatal(err)
	}
	if closed.CountedCash != 7850 || closed.DifferenceMinor != 0 {
		t.Fatalf("arqueo: contado %d diferencia %d", closed.CountedCash, closed.DifferenceMinor)
	}
	tax := cash.Lines[0].TaxMinor
	want := domain.ZReport{
		Lines: []domain.ZReportLine{
			{Key: "rail:CASH", AmountMinor: 3700, Count: 1}, {Key: "rail:WALLET", AmountMinor: 300, Count: 1},
			{Key: "refund:CASH", AmountMinor: 1850, Count: 1},
			{Key: "taxable:700", AmountMinor: 3700 - tax, Count: 1}, {Key: "tax:700", AmountMinor: tax, Count: 1},
			{Key: "exempt", AmountMinor: 300, Count: 1}, {Key: "cash_in", AmountMinor: 1000, Count: 1},
			{Key: "voids", AmountMinor: 425, Count: 1},
		},
		GrossSalesMinor: 4000, RefundsMinor: 1850, NetSalesMinor: 2150, SalesCount: 2,
	}
	if closed.ZReport == nil || !reflect.DeepEqual(*closed.ZReport, want) {
		t.Fatalf("reporte Z: got %+v want %+v", closed.ZReport, want)
	}
	wantCounts := []domain.CashCount{{DenominationMinor: 25, Quantity: 2}, {DenominationMinor: 100, Quantity: 3}, {DenominationMinor: 500, Quantity: 1}, {DenominationMinor: 1000, Quantity: 1}, {DenominationMinor: 2000, Quantity: 3}}
	if !reflect.DeepEqual(closed.CountedByDenom, wantCounts) {
		t.Fatalf("conteo guardado: %+v", closed.CountedByDenom)
	}

	read, err := w.svc.GetSession(ctx, a, cash.SessionID)
	if err != nil || read.ZReport == nil || !reflect.DeepEqual(*read.ZReport, want) || !reflect.DeepEqual(read.CountedByDenom, wantCounts) {
		t.Fatalf("leer la sesión cerrada devuelve el reporte guardado: %+v %v", read, err)
	}
	if _, err := w.svc.CloseSession(ctx, a, cash.SessionID, amt(1), nil, ""); !errors.Is(err, domain.ErrSessionClosed) {
		t.Fatalf("segundo cierre: %v", err)
	}
	again, err := w.svc.GetSession(ctx, a, cash.SessionID)
	if err != nil || !reflect.DeepEqual(*again.ZReport, want) || again.CountedCash != 7850 {
		t.Fatalf("el segundo cierre no cambia el reporte: %+v %v", again, err)
	}
}
