package domain

import (
	"errors"
	"testing"
)

// domain-model §8.12: DRAFT → SENT → (PARTIALLY_)RECEIVED; DRAFT/SENT → CANCELLED.
func TestPO_StateMachine(t *testing.T) {
	ok := [][2]POStatus{{PODraft, POSent}, {PODraft, POCancelled}, {POSent, POCancelled}}
	for _, c := range ok {
		if !c[0].CanChangeTo(c[1]) {
			t.Fatalf("%v → %v debe poder", c[0], c[1])
		}
	}
	bad := [][2]POStatus{{POSent, PODraft}, {POReceived, POCancelled}, {POPartial, POCancelled}, {POCancelled, POSent}, {PODraft, POReceived}}
	for _, c := range bad {
		if c[0].CanChangeTo(c[1]) {
			t.Fatalf("%v → %v no debe poder", c[0], c[1])
		}
	}
	if PODraft.Receivable() || !POSent.Receivable() || !POPartial.Receivable() || POReceived.Receivable() {
		t.Fatal("solo una orden enviada recibe mercancía")
	}
}

// ADR 0013: el total sale de enteros con half-up por línea.
func TestPO_TotalAndValidation(t *testing.T) {
	o := PurchaseOrder{SupplierID: "s", Lines: []POLine{
		{ProductID: "a", OrderedMilli: 2500, UnitCostMinor: 333}, // 2,5 × 3,33 = 8,325 → 8,33
		{ProductID: "b", OrderedMilli: 1000, UnitCostMinor: 1250},
	}}
	if err := o.Prepare(); err != nil || o.TotalMinor != 833+1250 {
		t.Fatalf("%v %d", err, o.TotalMinor)
	}
	for name, lines := range map[string][]POLine{
		"sin líneas":     nil,
		"repetida":       {{ProductID: "a", OrderedMilli: 1}, {ProductID: "a", OrderedMilli: 1}},
		"cantidad cero":  {{ProductID: "a"}},
		"costo negativo": {{ProductID: "a", OrderedMilli: 1, UnitCostMinor: -1}},
		"producto vacío": {{OrderedMilli: 1}},
	} {
		x := PurchaseOrder{SupplierID: "s", Lines: lines}
		if !errors.Is(x.Prepare(), ErrInvalidOrder) {
			t.Fatalf("%s", name)
		}
	}
}

// S-INV-06: la recepción suma sin pasar lo pedido y deja la orden recibida o recibida en parte.
func TestPO_Receive(t *testing.T) {
	o := PurchaseOrder{SupplierID: "s", Status: POSent, Lines: []POLine{
		{ProductID: "a", OrderedMilli: 10000}, {ProductID: "b", OrderedMilli: 2000},
	}}
	if err := o.Receive([]Received{{ProductID: "a", ReceivedMilli: 4000}}); err != nil || o.Status != POPartial || o.Lines[0].ReceivedMilli != 4000 {
		t.Fatalf("%v %+v", err, o)
	}
	if err := o.Receive([]Received{{ProductID: "a", ReceivedMilli: 7000}}); !errors.Is(err, ErrOverReceipt) {
		t.Fatalf("exceso: %v", err)
	}
	if err := o.Receive([]Received{{ProductID: "c", ReceivedMilli: 1}}); !errors.Is(err, ErrNotInOrder) {
		t.Fatalf("fuera de la orden: %v", err)
	}
	if err := o.Receive([]Received{{ProductID: "a", ReceivedMilli: 6000}, {ProductID: "b", ReceivedMilli: 2000}}); err != nil || o.Status != POReceived {
		t.Fatalf("%v %+v", err, o)
	}
	draft := PurchaseOrder{Status: PODraft, Lines: []POLine{{ProductID: "a", OrderedMilli: 1}}}
	if !errors.Is(draft.Receive([]Received{{ProductID: "a", ReceivedMilli: 1}}), ErrPOTransition) {
		t.Fatal("un borrador no recibe")
	}
}

// S-INV-07: proveedor con RUC + DV, correo y teléfono válidos.
func TestSupplier_Validation(t *testing.T) {
	ok := Supplier{Name: " Distribuidora  Uno ", TaxID: "2588017-1-831938", CheckDigit: "20", Email: "Ventas@Uno.com", Phone: "+507 6000-0000"}.Normalize()
	if err := ok.Validate(); err != nil || ok.Name != "Distribuidora Uno" || ok.Email != "ventas@uno.com" || ok.LeadTimeDays != DefaultLeadTimeDays {
		t.Fatalf("%v %+v", err, ok)
	}
	for _, s := range []Supplier{
		{},
		{Name: "X", TaxID: "123"},
		{Name: "X", TaxID: "123", CheckDigit: "1"},
		{Name: "X", Email: "no-es-correo"},
		{Name: "X", Phone: "abc"},
		{Name: "X", LeadTimeDays: 400},
	} {
		if !errors.Is(s.Normalize().Validate(), ErrInvalidSupplier) {
			t.Fatalf("%+v", s)
		}
	}
}
