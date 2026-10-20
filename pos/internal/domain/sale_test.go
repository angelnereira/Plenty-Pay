package domain

import (
	"errors"
	"testing"
	"time"
)

func priced(t *testing.T, price, qty int64, rate int32) Line {
	t.Helper()
	l := Line{ProductID: "p", UnitPriceMinor: price, QtyMilli: qty, TaxRateBps: rate}
	if err := l.Price(); err != nil {
		t.Fatal(err)
	}
	return l
}

func TestHalfUpMatchesDomainModel(t *testing.T) {
	// domain-model §4: half_up(v, bps) = (v·bps + 5000) / 10000 (vector B: 1234 × 250 → 31).
	if v, _ := HalfUp(1234, 250, 10000); v != 31 {
		t.Fatalf("vector B: %d", v)
	}
	if v, _ := HalfUp(31, 700, 10000); v != 2 {
		t.Fatalf("vector B (impuesto): %d", v)
	}
	if _, err := HalfUp(1<<62, 1<<10, 1); !errors.Is(err, ErrOverflow) {
		t.Fatal("desbordamiento no detectado")
	}
}

func TestR2_TaxIsExtractedFromTaxIncludedPrice(t *testing.T) {
	// 10.70 con ITBMS 7 % incluido → base 10.00, impuesto 0.70.
	l := priced(t, 1070, 1000, 700)
	if l.LineTotalMinor != 1070 || l.TaxMinor != 70 {
		t.Fatalf("%+v", l)
	}
	// Exento: sin impuesto.
	if l := priced(t, 500, 2000, 0); l.LineTotalMinor != 1000 || l.TaxMinor != 0 {
		t.Fatalf("%+v", l)
	}
	// 1.5 kg a 3.99/kg = 5.985 → 5.99 (half_up); tax = 5.99 − round(5.99/1.07) = 599 − 560 = 39.
	if l := priced(t, 399, 1500, 700); l.LineTotalMinor != 599 || l.TaxMinor != 39 {
		t.Fatalf("granel: %+v", l)
	}
}

func TestR2_LineValidation(t *testing.T) {
	for _, l := range []Line{
		{UnitPriceMinor: 100, QtyMilli: 0, TaxRateBps: 700},
		{UnitPriceMinor: -1, QtyMilli: 1000, TaxRateBps: 700},
		{UnitPriceMinor: 100, QtyMilli: 1000, DiscountMinor: 101, TaxRateBps: 700},
		{UnitPriceMinor: 100, QtyMilli: MaxQtyMilli + 1, TaxRateBps: 700},
	} {
		if err := l.Price(); !errors.Is(err, ErrInvalidLine) {
			t.Errorf("%+v: %v", l, err)
		}
	}
}

func saleOf(t *testing.T, lines ...Line) Sale {
	s := Sale{Status: Open, Lines: lines}
	if err := s.Recalculate(); err != nil {
		t.Fatal(err)
	}
	return s
}

func TestSPEC11_1_CashPlusWalletWithChange(t *testing.T) {
	// Aceptación 1: 3 artículos, 10.00 en efectivo (entrega 20.00) y el resto con billetera.
	s := saleOf(t, priced(t, 1850, 1000, 700), priced(t, 425, 2000, 700), priced(t, 300, 1000, 0))
	if s.TotalMinor != 3000 {
		t.Fatalf("total %d", s.TotalMinor)
	}
	err := s.PrepareCheckout([]Tender{
		{Rail: RailCash, AmountMinor: 1000, CashTendered: 2000},
		{Rail: RailWallet, AmountMinor: 2000},
	})
	if err != nil {
		t.Fatal(err)
	}
	if s.Status != AwaitingPayment || s.ChangeMinor != 1000 || s.Tenders[0].Status != TenderCaptured {
		t.Fatalf("%+v", s)
	}
	if !s.CaptureTender("intent-1", 2000) || s.Status != Paid {
		t.Fatalf("el cobro de billetera paga la venta: %+v", s)
	}
	if s.CashInSale() != 1000 {
		t.Fatalf("en el cajón quedan 10.00, no lo recibido: %d", s.CashInSale())
	}
}

func TestR4_TendersMustSumTheTotal(t *testing.T) {
	s := saleOf(t, priced(t, 1000, 1000, 700))
	if !errors.Is(s.PrepareCheckout([]Tender{{Rail: RailCash, AmountMinor: 900}}), ErrTendersMismatch) {
		t.Fatal("falta dinero")
	}
	if !errors.Is(s.PrepareCheckout([]Tender{{Rail: RailCash, AmountMinor: 1000, CashTendered: 500}}), ErrTendersMismatch) {
		t.Fatal("el efectivo recibido no alcanza")
	}
	if !errors.Is(s.PrepareCheckout([]Tender{{Rail: 4, AmountMinor: 1000}}), ErrRailNotSupported) {
		t.Fatal("tarjeta sin PSP")
	}
	empty := Sale{Status: Open}
	if !errors.Is(empty.PrepareCheckout([]Tender{{Rail: RailCash, AmountMinor: 1}}), ErrEmptySale) {
		t.Fatal("venta vacía")
	}
	if err := s.PrepareCheckout([]Tender{{Rail: RailCash, AmountMinor: 1000}}); err != nil || s.Status != Paid {
		t.Fatalf("efectivo exacto paga al instante: %v %+v", err, s.Status)
	}
}

func TestR7_WalletAmountMismatchNeedsReview(t *testing.T) {
	s := saleOf(t, priced(t, 1000, 1000, 700))
	if err := s.PrepareCheckout([]Tender{{Rail: RailWallet, AmountMinor: 1000}}); err != nil {
		t.Fatal(err)
	}
	if s.CaptureTender("i", 999) || s.Status == Paid || !s.NeedsReview {
		t.Fatalf("un cobro por otro monto no paga la venta: %+v", s)
	}
}

func TestR8_VoidOnlyBeforeElectronicCapture(t *testing.T) {
	s := saleOf(t, priced(t, 1000, 1000, 700))
	if !errors.Is(s.Void(""), ErrReasonRequired) {
		t.Fatal("anular exige motivo")
	}
	if err := s.PrepareCheckout([]Tender{{Rail: RailWallet, AmountMinor: 1000}}); err != nil {
		t.Fatal(err)
	}
	s.CaptureTender("i", 1000)
	if err := s.Void("cliente se arrepintió"); err == nil {
		t.Fatal("una venta pagada se devuelve, no se anula")
	}
	pending := saleOf(t, priced(t, 1000, 1000, 700))
	if err := pending.Void("error de digitación"); err != nil || pending.Status != Voided {
		t.Fatal(err)
	}
}

func TestFailedWalletReopensSale(t *testing.T) {
	s := saleOf(t, priced(t, 1000, 1000, 700))
	if err := s.PrepareCheckout([]Tender{{Rail: RailWallet, AmountMinor: 1000}}); err != nil {
		t.Fatal(err)
	}
	s.FailTender()
	if s.Status != Open || s.Tenders[0].Status != TenderFailed {
		t.Fatalf("%+v", s)
	}
}

func TestSessionCloseDifference(t *testing.T) {
	ss := Session{Status: "OPEN", ExpectedCash: 15000}
	if err := ss.Close(14500, "faltante", time.Unix(0, 0)); err != nil || ss.DifferenceMinor != -500 {
		t.Fatalf("%v %+v", err, ss)
	}
	if !errors.Is(ss.Close(1, "", time.Unix(0, 0)), ErrSessionClosed) {
		t.Fatal("cerrar dos veces")
	}
	if (CashMovement{Direction: "OUT", AmountMinor: 500, Reason: "retiro a caja fuerte"}).Signed() != -500 {
		t.Fatal("salida resta")
	}
	if (CashMovement{Direction: "OUT", AmountMinor: 500}).Validate() == nil {
		t.Fatal("sin motivo")
	}
}
