package simulator

import (
	"context"
	"errors"
	"strings"
	"testing"

	"plentypay/fiscal-invoicing/internal/pac"
)

// R9: el simulador nunca produce un CUFE que pueda confundirse con uno de la DGI.
func TestR9_SimulatorMarksDemoDocuments(t *testing.T) {
	s := New()
	d := pac.Document{TenantID: "t", IssuerRUC: "2588017-1-831938", DocType: 1, PointOfSaleCode: "001", Number: 7}
	r, err := s.Send(context.Background(), nil, d)
	if err != nil || !r.Accepted || !strings.HasPrefix(r.CUFE, Prefix) || !strings.HasPrefix(r.QR, QRNotice) {
		t.Fatalf("%+v %v", r, err)
	}
	again, _ := s.Send(context.Background(), nil, d)
	if again.CUFE != r.CUFE {
		t.Fatal("el CUFE simulado es determinista para el mismo número")
	}
	d.Number = 8
	if other, _ := s.Send(context.Background(), nil, d); other.CUFE == r.CUFE {
		t.Fatal("otro número, otro CUFE")
	}
}

// R10: el doble de pruebas simula timeout y rechazo.
func TestR10_SimulatorTransientAndReject(t *testing.T) {
	s := New()
	s.FailNext(2)
	for i := 0; i < 2; i++ {
		if _, err := s.Send(context.Background(), nil, pac.Document{}); !errors.Is(err, pac.ErrTransient) {
			t.Fatalf("intento %d: %v", i, err)
		}
	}
	if r, err := s.Send(context.Background(), nil, pac.Document{}); err != nil || !r.Accepted {
		t.Fatalf("luego acepta: %+v %v", r, err)
	}
	s.RejectWith("RUC del receptor inválido")
	if r, err := s.Send(context.Background(), nil, pac.Document{}); err != nil || r.Accepted || r.RejectionReason == "" {
		t.Fatalf("rechazo: %+v %v", r, err)
	}
}
