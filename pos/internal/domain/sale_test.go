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
	if err := pending.Void("  error de digitación "); err != nil || pending.Status != Voided ||
		pending.VoidReason != "error de digitación" {
		t.Fatal(err, pending.VoidReason)
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

// F17.4 · domain-model §8.9: OPEN ↔ PARKED; una estacionada no se edita ni se cobra; repetir la
// transición es un reintento (ErrNoChange), no un error.
func TestR13_ParkAndResumeTransitions(t *testing.T) {
	at := time.Date(2026, 10, 21, 15, 0, 0, 0, time.UTC)
	empty := Sale{Status: Open}
	if !errors.Is(empty.Park("", at), ErrEmptySale) {
		t.Fatal("no se estaciona una venta vacía")
	}
	s := saleOf(t, priced(t, 1000, 1000, 700))
	long := "Cliente con carrito lleno que fue a buscar la leche deslactosada y el pan"
	if !errors.Is(s.Park(long, at), ErrInvalidLabel) {
		t.Fatal("nota de más de 60 caracteres")
	}
	if err := s.Park("  Señora del carrito azul ", at); err != nil || s.Status != Parked ||
		s.ParkLabel != "Señora del carrito azul" || !s.ParkedAt.Equal(at) {
		t.Fatalf("%v %+v", err, s)
	}
	if !errors.Is(s.Park("otra", at), ErrNoChange) || s.ParkLabel != "Señora del carrito azul" {
		t.Fatal("estacionar dos veces es un reintento sin cambios")
	}
	if !errors.Is(s.Editable(), ErrInvalidTransition) {
		t.Fatal("una estacionada no se edita")
	}
	if !errors.Is(s.PrepareCheckout([]Tender{{Rail: RailCash, AmountMinor: 1000}}), ErrInvalidTransition) {
		t.Fatal("una estacionada no se cobra sin retomarla (auditoría D3)")
	}
	if err := s.Resume(); err != nil || s.Status != Open {
		t.Fatalf("%v %v", err, s.Status)
	}
	if !errors.Is(s.Resume(), ErrNoChange) {
		t.Fatal("retomar una abierta es un reintento")
	}
	if err := s.PrepareCheckout([]Tender{{Rail: RailCash, AmountMinor: 1000}}); err != nil || s.Status != Paid {
		t.Fatalf("retomada se cobra: %v %v", err, s.Status)
	}
	if !errors.Is(s.Park("", at), ErrInvalidTransition) || !errors.Is(s.Resume(), ErrInvalidTransition) {
		t.Fatal("una pagada no se estaciona ni se retoma")
	}
}

func paidSale(t *testing.T) Sale {
	t.Helper()
	a := priced(t, 1000, 3000, 700) // 3 × 10.00 = 30.00
	a.ID = "a"
	b := priced(t, 999, 1000, 0) // 9.99
	b.ID = "b"
	s := saleOf(t, a, b)
	if err := s.PrepareCheckout([]Tender{{Rail: RailCash, AmountMinor: 2000}, {Rail: RailWallet, AmountMinor: 1999}}); err != nil {
		t.Fatal(err)
	}
	s.CaptureTender("i", 1999)
	if s.Status != Paid {
		t.Fatalf("estado %v", s.Status)
	}
	for i := range s.Tenders {
		s.Tenders[i].ID = string(rune('x' + i))
	}
	return s
}

// R9 (F17.9): ≤ vendido − devuelto; monto proporcional con el resto exacto en la última unidad;
// reintegro empezando por el último medio de pago.
func TestR9_RefundQuantitiesAmountsAndTenderOrder(t *testing.T) {
	s := paidSale(t)
	if _, err := s.PlanRefund([]RefundLineRequest{{LineID: "a", QtyMilli: 1000}}, "", false); !errors.Is(err, ErrReasonRequired) {
		t.Fatal("motivo obligatorio")
	}
	r, err := s.PlanRefund([]RefundLineRequest{{LineID: "a", QtyMilli: 1000}}, "Defectuoso", true)
	if err != nil {
		t.Fatal(err)
	}
	// 1 de 3 a 30.00 → 10.00; sale de la billetera (último medio) primero.
	if r.TotalMinor != 1000 || r.WalletMinor != 1000 || r.CashMinor != 0 || s.Status != PartiallyRefunded {
		t.Fatalf("%+v %v", r, s.Status)
	}
	if _, err := s.PlanRefund([]RefundLineRequest{{LineID: "a", QtyMilli: 2001}}, "Cambio", false); !errors.Is(err, ErrExceedsSoldQty) {
		t.Fatalf("más de lo pendiente: %v", err)
	}
	r, err = s.PlanRefund([]RefundLineRequest{{LineID: "a", QtyMilli: 2000}, {LineID: "b", QtyMilli: 1000}}, "Cambio", false)
	if err != nil {
		t.Fatal(err)
	}
	// Resto exacto: 30.00 − 10.00 = 20.00 y 9.99; billetera le quedaban 9.99, el resto en efectivo.
	if r.TotalMinor != 2999 || r.WalletMinor != 999 || r.CashMinor != 2000 || s.Status != Refunded || s.RefundedMinor() != 3999 {
		t.Fatalf("%+v %v %d", r, s.Status, s.RefundedMinor())
	}
	if _, err := s.PlanRefund([]RefundLineRequest{{LineID: "b", QtyMilli: 1}}, "x", false); !errors.Is(err, ErrNotRefundable) {
		t.Fatal("una venta ya devuelta no admite más")
	}
}

// R9: tres devoluciones de 1 unidad de 3 a 10.01 suman exactamente 10.01 (la última toma el resto).
func TestR9_ProportionalRefundsAddUpToTheLineTotal(t *testing.T) {
	l := priced(t, 1001, 1000, 700)
	l.ID, l.QtyMilli, l.LineTotalMinor = "a", 3000, 1001
	s := saleOf(t, l)
	s.Status = Paid
	s.Tenders = []Tender{{ID: "t", Rail: RailCash, AmountMinor: 1001, Status: TenderCaptured}}
	var sum int64
	for i := 0; i < 3; i++ {
		r, err := s.PlanRefund([]RefundLineRequest{{LineID: "a", QtyMilli: 1000}}, "x", false)
		if err != nil {
			t.Fatal(err)
		}
		sum += r.TotalMinor
	}
	if sum != 1001 || s.Status != Refunded {
		t.Fatalf("suma %d estado %v", sum, s.Status)
	}
}
