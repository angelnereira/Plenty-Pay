package domain

import (
	"errors"
	"strings"
	"testing"
)

// R10 · F16.12: lo dañado es parte de lo recibido (0 ≤ dañado ≤ recibido) y se acumula por línea.
func TestR10_DamagedIsPartOfReceived(t *testing.T) {
	o := PurchaseOrder{Status: POSent, Lines: []POLine{{ProductID: "p", OrderedMilli: 10_000}}}
	for _, bad := range []Received{
		{ProductID: "p", ReceivedMilli: 2000, DamagedMilli: 2001},
		{ProductID: "p", ReceivedMilli: 2000, DamagedMilli: -1},
	} {
		if err := o.Receive([]Received{bad}); !errors.Is(err, ErrInvalidOrder) {
			t.Fatalf("%+v: %v", bad, err)
		}
	}
	if err := o.Receive([]Received{{ProductID: "p", ReceivedMilli: 6000, DamagedMilli: 1000}}); err != nil {
		t.Fatal(err)
	}
	if err := o.Receive([]Received{{ProductID: "p", ReceivedMilli: 1000, DamagedMilli: 1000}}); err != nil {
		t.Fatal(err)
	}
	l := o.Lines[0]
	if l.ReceivedMilli != 7000 || l.DamagedMilli != 2000 || l.ShortMilli() != 3000 || o.Status != POPartial {
		t.Fatalf("línea %+v estado %v", l, o.Status)
	}
}

// R10: «Cerrar con faltante» solo desde PARTIALLY_RECEIVED, con motivo de 1 a 300 caracteres; final.
func TestR10_CloseShortTransitionsAndReason(t *testing.T) {
	if !POPartial.CanChangeTo(POClosedShort) {
		t.Fatal("PARTIALLY_RECEIVED → CLOSED_SHORT")
	}
	for _, from := range []POStatus{PODraft, POSent, POReceived, POCancelled, POClosedShort} {
		if from.CanChangeTo(POClosedShort) {
			t.Fatalf("%v → CLOSED_SHORT no se permite", from)
		}
	}
	for _, to := range []POStatus{PODraft, POSent, POPartial, POReceived, POCancelled} {
		if POClosedShort.CanChangeTo(to) || POClosedShort.Receivable() {
			t.Fatalf("CLOSED_SHORT es final (%v)", to)
		}
	}
	if _, err := CloseReason("   "); !errors.Is(err, ErrCloseReasonRequired) {
		t.Fatal("sin motivo")
	}
	if _, err := CloseReason(strings.Repeat("a", 301)); !errors.Is(err, ErrCloseReasonRequired) {
		t.Fatal("motivo de 301")
	}
	if r, err := CloseReason("  el proveedor no tiene más  "); err != nil || r != "el proveedor no tiene más" {
		t.Fatalf("%q %v", r, err)
	}
}

// R10: lo que llega dañado se aparta aunque lo disponible no alcance (venta física que dejó
// negativo, R2, o reservas): el disponible queda igual que antes de recibir.
func TestR10_DamagedOnArrivalIsBlockedDespiteReservations(t *testing.T) {
	l := Level{OnHandMilli: -1000, ReservedMilli: 1000} // disponible −2
	if err := l.Apply(Movement{Type: Receipt, DeltaMilli: 3000}); err != nil {
		t.Fatal(err)
	}
	if err := l.Apply(Movement{Type: Block, DeltaMilli: 3000, Reason: "x"}); !errors.Is(err, ErrOutOfStock) {
		t.Fatalf("un bloqueo normal no toma lo reservado: %v", err)
	}
	if err := l.Apply(Movement{Type: Block, DeltaMilli: 3000, Reason: "dañado en recepción", OnArrival: true}); err != nil {
		t.Fatal(err)
	}
	if l.OnHandMilli != 2000 || l.BlockedMilli != 3000 || l.Available() != -2000 {
		t.Fatalf("%+v disponible %d", l, l.Available())
	}
}
