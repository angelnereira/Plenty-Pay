//go:build l2

package store_test

import (
	"context"
	"errors"
	"sync"
	"testing"

	"plentypay/pos/internal/domain"
	"plentypay/pos/internal/service"
)

func manager(tenant string) service.Actor {
	a := cashier(tenant)
	a.Permissions["pos:settings:manage"] = true
	return a
}

// R14 · F17.11: sin fila rigen los valores por defecto; guardar sube la versión; un reintento con
// el mismo contenido devuelve lo guardado; otro contenido con versión vieja es conflicto; cada
// comercio tiene la suya.
func TestL2_F17_11_SettingsVersionAndDefaults(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	m := manager(tenant)
	got, err := w.svc.Settings(ctx, m)
	if err != nil || got.Version != 0 || !got.CashEnabled || got.CheckoutPreference != domain.PrefInternalOnly {
		t.Fatalf("por defecto: %+v %v", got, err)
	}
	want := domain.Settings{CheckoutPreference: domain.PrefAutoThreshold, AutoThresholdMinor: 5000, CashEnabled: true,
		EnabledRails: []int16{domain.RailWallet}, ReceiptFooter: "Gracias por su compra", MaxDiscountBps: 1000, Version: 0}
	saved, err := w.svc.UpdateSettings(ctx, m, want)
	if err != nil || saved.Version != 1 {
		t.Fatalf("primer guardado: %+v %v", saved, err)
	}
	again, err := w.svc.UpdateSettings(ctx, m, want) // reintento con la versión 0
	if err != nil || again.Version != 1 {
		t.Fatalf("reintento: %+v %v", again, err)
	}
	stale := want
	stale.ReceiptFooter = "otro pie"
	if _, err := w.svc.UpdateSettings(ctx, m, stale); !errors.Is(err, domain.ErrSettingsConflict) {
		t.Fatalf("versión vieja con otro contenido: %v", err)
	}
	stale.Version = 1
	if s, err := w.svc.UpdateSettings(ctx, m, stale); err != nil || s.Version != 2 {
		t.Fatalf("con la versión vigente: %+v %v", s, err)
	}
	read, err := w.svc.Settings(ctx, m)
	if err != nil || read.Version != 2 || read.ReceiptFooter != "otro pie" || read.MaxDiscountBps != 1000 {
		t.Fatalf("leído: %+v %v", read, err)
	}
	if other, err := w.svc.Settings(ctx, manager(id())); err != nil || other.Version != 0 {
		t.Fatalf("otro comercio (RLS): %+v %v", other, err)
	}
	bad := want
	bad.CashEnabled, bad.EnabledRails, bad.Version = false, nil, 2
	if _, err := w.svc.UpdateSettings(ctx, m, bad); !errors.Is(err, domain.ErrInvalidSettings) {
		t.Fatalf("sin medios: %v", err)
	}
}

// R14: dos guardados simultáneos sobre la misma versión → uno gana y el otro es conflicto.
func TestL2_F17_11_ConcurrentSavesOneWins(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	m := manager(tenant)
	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			s := domain.DefaultSettings()
			s.ReceiptFooter = []string{"pie A", "pie B"}[i]
			_, errs[i] = w.svc.UpdateSettings(ctx, m, s)
		}(i)
	}
	wg.Wait()
	ok, conflicts := 0, 0
	for _, e := range errs {
		switch {
		case e == nil:
			ok++
		case errors.Is(e, domain.ErrSettingsConflict):
			conflicts++
		default:
			t.Fatal(e)
		}
	}
	if ok != 1 || conflicts != 1 {
		t.Fatalf("ok=%d conflictos=%d", ok, conflicts)
	}
}

// R14: un medio desactivado se rechaza en el cobro siguiente y el tope de descuento rige al editar
// líneas (R3).
func TestL2_F17_11_ChangeAppliesToNextSale(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	m := manager(tenant)
	a := cashier(tenant)
	s := domain.DefaultSettings()
	s.EnabledRails = nil // solo efectivo
	s.MaxDiscountBps = 1000
	if _, err := w.svc.UpdateSettings(ctx, m, s); err != nil {
		t.Fatal(err)
	}
	sale := openSale(t, w, a, "CAJA-CFG", service.LineInput{ProductID: w.cafe, QtyMilli: 1000})
	if _, err := w.svc.Checkout(ctx, a, sale.ID, []domain.Tender{{Rail: domain.RailWallet, AmountMinor: sale.TotalMinor}}); !errors.Is(err, domain.ErrRailNotSupported) {
		t.Fatalf("saldo PlentyPay desactivado: %v", err)
	}
	// 10 % de 18.50 = 1.85 entra sin permiso; 1.86 no.
	if _, err := w.svc.UpdateSale(ctx, a, sale.ID, sale.Version, []service.LineInput{{ProductID: w.cafe, QtyMilli: 1000, DiscountMinor: 186}}); !errors.Is(err, service.ErrDiscountNotAllowed) {
		t.Fatalf("descuento sobre el tope: %v", err)
	}
	sale, err := w.svc.UpdateSale(ctx, a, sale.ID, sale.Version, []service.LineInput{{ProductID: w.cafe, QtyMilli: 1000, DiscountMinor: 185}})
	if err != nil || sale.TotalMinor != 1665 {
		t.Fatalf("descuento dentro del tope: %+v %v", sale, err)
	}
	if sale, err = w.svc.Checkout(ctx, a, sale.ID, []domain.Tender{{Rail: domain.RailCash, AmountMinor: 1665, CashTendered: 2000}}); err != nil || sale.Status != domain.Paid {
		t.Fatalf("efectivo sigue activo: %+v %v", sale, err)
	}
}
