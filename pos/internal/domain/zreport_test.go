package domain

import (
	"errors"
	"reflect"
	"testing"
)

func zSale(status Status, total int64, rail int16, lines ...Line) Sale {
	return Sale{Status: status, TotalMinor: total, Lines: lines,
		Tenders: []Tender{{Rail: rail, AmountMinor: total, Status: TenderCaptured}}}
}

// Vector de la ficha F17.3: 2 ventas en efectivo de 1.07 con 7 %, 1 venta con saldo de 2.00 exenta
// y 1 devolución en efectivo de 1.07.
func TestF17_3_ZReportTotalsByRailAndTaxRate(t *testing.T) {
	taxed := Line{TaxRateBps: 700, LineTotalMinor: 107, TaxMinor: 7}
	exempt := Line{TaxRateBps: 0, LineTotalMinor: 200}
	sales := []Sale{
		zSale(Paid, 107, RailCash, taxed),
		zSale(PartiallyRefunded, 107, RailCash, taxed),
		zSale(Paid, 200, RailWallet, exempt),
	}
	got, err := BuildZReport(sales, []ZRefund{{CashMinor: 107}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	want := ZReport{
		Lines: []ZReportLine{
			{"rail:CASH", 214, 2}, {"rail:WALLET", 200, 1}, {"refund:CASH", 107, 1},
			{"taxable:700", 200, 2}, {"tax:700", 14, 2}, {"exempt", 200, 1},
		},
		GrossSalesMinor: 414, RefundsMinor: 107, NetSalesMinor: 307, SalesCount: 3,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("reporte Z:\n got %+v\nwant %+v", got, want)
	}
}

// Anulaciones, entradas y salidas, descuentos, varias tasas en orden, medios no capturados y
// reintegros al saldo que fallaron.
func TestF17_3_ZReportVoidsMovementsDiscountsAndOrder(t *testing.T) {
	mixed := Sale{Status: Paid, TotalMinor: 1500, Lines: []Line{
		{TaxRateBps: 1000, LineTotalMinor: 1100, TaxMinor: 100, DiscountMinor: 50},
		{TaxRateBps: 700, LineTotalMinor: 400, TaxMinor: 26},
	}, Tenders: []Tender{
		{Rail: RailWallet, AmountMinor: 1000, Status: TenderCaptured},
		{Rail: RailCash, AmountMinor: 500, Status: TenderCaptured},
		{Rail: RailWallet, AmountMinor: 1000, Status: TenderFailed},
	}}
	sales := []Sale{mixed, zSale(Voided, 300, RailCash), zSale(Open, 900, RailCash), zSale(Parked, 900, RailCash)}
	refunds := []ZRefund{{WalletMinor: 400}, {WalletMinor: 250, Failed: true}, {CashMinor: 100, WalletMinor: 50}}
	moves := []CashMovement{{Direction: "IN", AmountMinor: 1000}, {Direction: "OUT", AmountMinor: 300}, {Direction: "OUT", AmountMinor: 200}}
	got, err := BuildZReport(sales, refunds, moves)
	if err != nil {
		t.Fatal(err)
	}
	want := []ZReportLine{
		{"rail:CASH", 500, 1}, {"rail:WALLET", 1000, 1}, {"refund:CASH", 100, 1}, {"refund:WALLET", 450, 2},
		{"discounts", 50, 1}, {"taxable:700", 374, 1}, {"tax:700", 26, 1}, {"taxable:1000", 1000, 1}, {"tax:1000", 100, 1},
		{"cash_in", 1000, 1}, {"cash_out", 500, 2}, {"voids", 300, 1},
	}
	if !reflect.DeepEqual(got.Lines, want) {
		t.Fatalf("líneas:\n got %+v\nwant %+v", got.Lines, want)
	}
	if got.GrossSalesMinor != 1500 || got.RefundsMinor != 550 || got.NetSalesMinor != 950 || got.SalesCount != 1 {
		t.Fatalf("totales: %+v", got)
	}
	if empty, err := BuildZReport(nil, nil, nil); err != nil || len(empty.Lines) != 0 || empty.SalesCount != 0 {
		t.Fatalf("sesión sin movimiento: %+v %v", empty, err)
	}
}

func TestF17_3_ZReportOverflowIsRejected(t *testing.T) {
	big := zSale(Paid, 1<<62, RailCash)
	if _, err := BuildZReport([]Sale{big, big, big}, nil, nil); !errors.Is(err, ErrOverflow) {
		t.Fatalf("desborde: %v", err)
	}
}

func TestF17_3_DenominationCountMustMatch(t *testing.T) {
	counts := []CashCount{{2000, 2}, {25, 3}, {100, 0}, {1, 4}}
	total, kept, err := ResolveCounted(0, false, counts, "USD")
	if err != nil || total != 4079 {
		t.Fatalf("Σ denominación × cantidad: %d %v", total, err)
	}
	if !reflect.DeepEqual(kept, []CashCount{{1, 4}, {25, 3}, {2000, 2}}) {
		t.Fatalf("conteo guardado sin ceros y en orden: %+v", kept)
	}
	if total, _, err := ResolveCounted(4079, true, counts, "USD"); err != nil || total != 4079 {
		t.Fatalf("monto que cuadra: %d %v", total, err)
	}
	for name, c := range map[string]struct {
		counted int64
		has     bool
		counts  []CashCount
		cur     string
	}{
		"no cuadra":             {4000, true, counts, "USD"},
		"denominación inválida": {0, false, []CashCount{{200, 1}}, "USD"},
		"cantidad negativa":     {0, false, []CashCount{{100, -1}}, "USD"},
		"denominación repetida": {0, false, []CashCount{{100, 1}, {100, 2}}, "USD"},
		"moneda sin tabla":      {0, false, []CashCount{{100, 1}}, "EUR"},
	} {
		if _, _, err := ResolveCounted(c.counted, c.has, c.counts, c.cur); !errors.Is(err, ErrInvalidCount) {
			t.Fatalf("%s: %v", name, err)
		}
	}
	if total, kept, err := ResolveCounted(1234, true, nil, "USD"); err != nil || total != 1234 || kept != nil {
		t.Fatalf("sin conteo rige el monto: %d %v", total, err)
	}
	if _, _, err := ResolveCounted(-1, true, nil, "USD"); !errors.Is(err, ErrInvalidAmount) {
		t.Fatalf("monto negativo: %v", err)
	}
	if !reflect.DeepEqual(Denominations("PAB"), Denominations("USD")) {
		t.Fatal("PAB y USD comparten denominaciones")
	}
}
