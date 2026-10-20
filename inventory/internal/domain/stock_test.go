package domain

import (
	"errors"
	"testing"
	"time"
)

func TestSPEC4_MovementSignAndReason(t *testing.T) {
	bad := []Movement{
		{Type: Receipt, DeltaMilli: -1000},
		{Type: Sale, DeltaMilli: 1000},
		{Type: WriteOff, DeltaMilli: -1000}, // sin motivo
		{Type: Adjustment, DeltaMilli: 500}, // sin motivo
		{Type: Receipt, DeltaMilli: 0},      // cero
		{Type: MovementType(99), DeltaMilli: 1, Reason: "x"},
	}
	for _, m := range bad {
		if m.Validate() == nil {
			t.Errorf("aceptado: %+v", m)
		}
	}
	good := []Movement{
		{Type: Receipt, DeltaMilli: 12000},
		{Type: Sale, DeltaMilli: -2000},
		{Type: Adjustment, DeltaMilli: -1000, Reason: "conteo físico"},
		{Type: WriteOff, DeltaMilli: -1000, Reason: "vencido"},
		{Type: Return, DeltaMilli: 1000},
	}
	for _, m := range good {
		if err := m.Validate(); err != nil {
			t.Errorf("%+v: %v", m, err)
		}
	}
}

func TestSPEC4_SaleAndReturnOnlyFromSellingServices(t *testing.T) {
	sale := Movement{Type: Sale, DeltaMilli: -1000}
	if !errors.Is(sale.AllowedFor("api-gateway"), ErrServiceOnly) {
		t.Fatal("una persona no registra ventas a mano")
	}
	if err := sale.AllowedFor("pos"); err != nil {
		t.Fatal(err)
	}
	if err := (Movement{Type: Adjustment}).AllowedFor("api-gateway"); err != nil {
		t.Fatal(err)
	}
}

func TestR2_AvailableCannotGoNegativeExceptForSales(t *testing.T) {
	l := Level{OnHandMilli: 3000, ReservedMilli: 1000}
	if !errors.Is(l.Apply(Movement{Type: WriteOff, DeltaMilli: -2500}), ErrOutOfStock) {
		t.Fatal("ajuste dejó available negativo")
	}
	if l.OnHandMilli != 3000 {
		t.Fatal("un movimiento rechazado no cambia la existencia")
	}
	if err := l.Apply(Movement{Type: Sale, DeltaMilli: -5000}); err != nil {
		t.Fatalf("la venta física se registra aunque quede negativo: %v", err)
	}
	if l.OnHandMilli != -2000 || !l.IsLow() {
		t.Fatalf("%+v", l)
	}
}

func TestR7_StockLowAtMostOncePerDay(t *testing.T) {
	now := time.Date(2026, 10, 20, 15, 0, 0, 0, time.UTC)
	l := Level{OnHandMilli: 2000, ReorderPointMilli: 5000}
	if !l.ShouldNotifyLow(now) {
		t.Fatal("bajo el punto de reorden debe avisar")
	}
	l.LowNotifiedOn = now.Add(-2 * time.Hour)
	if l.ShouldNotifyLow(now) {
		t.Fatal("ya avisó hoy")
	}
	if !l.ShouldNotifyLow(now.Add(24 * time.Hour)) {
		t.Fatal("al día siguiente vuelve a avisar")
	}
	if (Level{OnHandMilli: 9000, ReorderPointMilli: 5000}).ShouldNotifyLow(now) {
		t.Fatal("sobre el punto no avisa")
	}
}

func TestR4_ReservationsAreAllOrNothingAndBounded(t *testing.T) {
	if (Reservation{}).Validate() == nil {
		t.Fatal("sin líneas")
	}
	dup := Reservation{Lines: []ReservationLine{{ProductID: "p", QtyMilli: 1}, {ProductID: "p", QtyMilli: 1}}}
	if dup.Validate() == nil {
		t.Fatal("producto repetido")
	}
	l := Level{OnHandMilli: 5000, ReservedMilli: 1000}
	if !errors.Is(l.Reserve(5000, false), ErrOutOfStock) {
		t.Fatal("reservar más de lo disponible")
	}
	if err := l.Reserve(4000, false); err != nil || l.Available() != 0 {
		t.Fatalf("%v %+v", err, l)
	}
	l.Unreserve(4000)
	if l.Available() != 4000 {
		t.Fatalf("%+v", l)
	}
}
