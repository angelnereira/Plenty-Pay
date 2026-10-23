package domain

import (
	"errors"
	"strings"
	"testing"
)

// R14 · F17.11: valores por defecto y límites de la configuración de caja.
func TestR14_DefaultsAndValidation(t *testing.T) {
	d := DefaultSettings()
	if err := d.Validate(); err != nil || !d.RailEnabled(RailCash) || !d.RailEnabled(RailWallet) || d.MaxDiscountBps != 0 ||
		d.CheckoutPreference != PrefInternalOnly {
		t.Fatalf("por defecto: %+v %v", d, err)
	}
	bad := []Settings{
		{CheckoutPreference: 0, CashEnabled: true},
		{CheckoutPreference: PrefAutoThreshold, CashEnabled: true},
		{CheckoutPreference: PrefAlwaysFiscal, CashEnabled: false},
		{CheckoutPreference: PrefAlwaysFiscal, CashEnabled: true, EnabledRails: []int16{2}},
		{CheckoutPreference: PrefAlwaysFiscal, CashEnabled: true, MaxDiscountBps: 10001},
		{CheckoutPreference: PrefAlwaysFiscal, CashEnabled: true, MaxDiscountBps: -1},
		{CheckoutPreference: PrefAlwaysFiscal, CashEnabled: true, ReceiptFooter: strings.Repeat("ñ", 201)},
	}
	for _, s := range bad {
		if !errors.Is(s.Normalize().Validate(), ErrInvalidSettings) {
			t.Fatalf("debe rechazar %+v", s)
		}
	}
	ok := Settings{CheckoutPreference: PrefAutoThreshold, AutoThresholdMinor: 5000, CashEnabled: false,
		EnabledRails: []int16{RailWallet, RailWallet}, ReceiptFooter: "  ¡Gracias por su compra!  ", MaxDiscountBps: 1500}.Normalize()
	if err := ok.Validate(); err != nil || len(ok.EnabledRails) != 1 || ok.ReceiptFooter != "¡Gracias por su compra!" {
		t.Fatalf("%+v %v", ok, err)
	}
	if ok.RailEnabled(RailCash) {
		t.Fatal("efectivo apagado")
	}
	if Settings(ok).SameContent(Settings{CheckoutPreference: PrefAutoThreshold, AutoThresholdMinor: 5000,
		EnabledRails: []int16{RailWallet}, ReceiptFooter: "¡Gracias por su compra!", MaxDiscountBps: 1500, Version: 7}) == false {
		t.Fatal("mismo contenido con otra versión")
	}
}

// R3 · F17.11: descuento por línea dentro del tope sobre el bruto; en el borde vale.
func TestR3_DiscountWithinLimit(t *testing.T) {
	s := Settings{MaxDiscountBps: 1000} // 10 %
	cases := []struct {
		qty, price, discount int64
		want                 bool
	}{
		{1000, 2000, 0, true},
		{1000, 2000, 200, true},  // 10 % exacto
		{1000, 2000, 201, false}, // pasa el tope
		{3000, 1000, 300, true},  // 10 % de 30.00
	}
	for i, c := range cases {
		got, err := s.DiscountWithinLimit(Line{QtyMilli: c.qty, UnitPriceMinor: c.price, DiscountMinor: c.discount})
		if err != nil || got != c.want {
			t.Fatalf("caso %d: %v %v", i, got, err)
		}
	}
	// 1.5 kg × 3.99 = 5.99 (half_up); 10 % = 0.599 → 0.59 entra, 0.60 no.
	if ok, _ := s.DiscountWithinLimit(Line{QtyMilli: 1500, UnitPriceMinor: 399, DiscountMinor: 59}); !ok {
		t.Fatal("0.59 de 5.99 entra en 10 %")
	}
	if ok, _ := s.DiscountWithinLimit(Line{QtyMilli: 1500, UnitPriceMinor: 399, DiscountMinor: 60}); ok {
		t.Fatal("0.60 de 5.99 pasa el 10 %")
	}
	if ok, _ := (Settings{}).DiscountWithinLimit(Line{QtyMilli: 1000, UnitPriceMinor: 100, DiscountMinor: 1}); ok {
		t.Fatal("tope 0: cualquier descuento requiere permiso")
	}
}
