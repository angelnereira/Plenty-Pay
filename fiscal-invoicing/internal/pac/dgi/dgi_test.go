package dgi

import (
	"errors"
	"testing"
	"time"

	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/pac"
)

const testCUFE = "FE01200002588017-1-831938-2000012026102100000000010010112345678901"

var testClasses = map[int64]string{0: domain.RateExempt, 700: domain.RateStandard, 1000: domain.RateAlcohol, 1500: domain.RateTobacco}

// SampleDoc es una venta de tres líneas (café con descuento al 7 %, cerveza al 10 %, pan exento).
func sampleDoc() pac.Document {
	lines, totals, err := domain.ComputeLines([]domain.Line{
		{Description: "Café americano", QuantityMilli: 3000, UnitPriceMinor: 150, DiscountMinor: 30, TaxRateBps: 700},
		{Description: "Cerveza nacional", QuantityMilli: 2000, UnitPriceMinor: 275, TaxRateBps: 1000},
		{Description: "Pan (exento)", QuantityMilli: 1500, UnitPriceMinor: 99, TaxRateBps: 0},
	}, map[int64]bool{700: true, 1000: true, 1500: true})
	if err != nil {
		panic(err)
	}
	return pac.Document{InvoiceID: "inv-1", TenantID: "t-1", Environment: domain.EnvDemo, IssuerRUC: "2588017-1-831938",
		IssuerDV: "20", BranchCode: "0000", DocType: domain.DocFiscalInvoice, PointOfSaleCode: "001", Number: 42,
		Lines: lines, Totals: totals, Currency: "USD", PaymentMethods: []string{"CASH"}, RateClasses: testClasses,
		IssuedAt: time.Date(2026, 10, 21, 15, 4, 5, 0, time.UTC)}
}

// R1 + ADR 0013: los montos del documento DGI salen exactos de los centavos.
func TestR1_DGIDocumentFromIntegerCents(t *testing.T) {
	g, err := Build(sampleDoc())
	if err != nil {
		t.Fatal(err)
	}
	it := g.Items[0]
	// 3 × 1.50 = 4.50 − 0.30 = 4.20; ITBMS 7 % = 0.294 → 0.29; descuento por unidad 0.10.
	if it.Quantity != "3.000" || it.UnitPrice != "1.50" || it.UnitDiscount != "0.100000" || it.Price != "4.20" ||
		it.Tax != "0.29" || it.Total != "4.49" || it.RateCode != "01" {
		t.Fatalf("línea 1: %+v", it)
	}
	if g.Items[1].RateCode != "02" || g.Items[2].RateCode != "00" || g.Items[2].UnitDiscount != "" {
		t.Fatal("clase de tasa → código DGI")
	}
	// Subtotal 4.20 + 5.50 + 1.49 = 11.19; ITBMS 0.29 + 0.55 = 0.84; total 12.03.
	if g.Totals != (Totals{Net: "11.19", Tax: "0.84", Taxed: "0.84", Total: "12.03", Received: "12.03", AllItems: "12.03", Items: 3}) {
		t.Fatalf("totales: %+v", g.Totals)
	}
	if g.Payment != (Payment{Code: "02", Amount: "12.03"}) || g.Number != "0000000042" || g.DocType != DocInvoice ||
		g.Nature != NatureSale || g.Receiver.Type != ReceiverConsumer || g.Receiver.Country != "PA" {
		t.Fatalf("documento: %+v", g)
	}
}

func TestDGI_UnitDiscountAndFormats(t *testing.T) {
	cases := []struct {
		disc, qty int64
		want      string
	}{{30, 3000, "0.100000"}, {100, 3000, "0.333333"}, {200, 3000, "0.666667"}, {1, 1_000_000_000, "0.000000"}, {999_999_999_999, 1000, "9999999999.990000"}}
	for _, c := range cases {
		if got := UnitDiscount(c.disc, c.qty); got != c.want {
			t.Fatalf("UnitDiscount(%d,%d)=%s, se esperaba %s", c.disc, c.qty, got, c.want)
		}
	}
	if Money(5) != "0.05" || Money(123456) != "1234.56" || Quantity(1500) != "1.500" || PadNumber(7) != "0000000007" {
		t.Fatal("formatos")
	}
}

// N-FIS-07 + ADR 0022 §8: receptor según su tipo de identificación.
func TestN_FIS_07_DGIReceiverMapping(t *testing.T) {
	cases := []struct {
		tp            domain.Taxpayer
		kind, contrib string
		wantErr       error
	}{
		{domain.Taxpayer{TaxIDType: domain.TaxIDRUCJuridico, TaxID: "2588017-1-831938", CheckDigit: "20", LegalName: "Distribuidora, S.A.", Address: "Calle 50, Ciudad de Panamá", Location: "8-8-7"},
			ReceiverTaxpayer, TaxpayerLegal, nil},
		{domain.Taxpayer{TaxIDType: domain.TaxIDRUCNatural, TaxID: "8-926-1601", CheckDigit: "05", LegalName: "Ana Pérez", Address: "Vía España 12"},
			ReceiverTaxpayer, TaxpayerNatural, nil},
		{domain.Taxpayer{TaxIDType: domain.TaxIDCedula, TaxID: "8-926-1601", LegalName: "Ana Pérez"}, ReceiverConsumer, TaxpayerNatural, nil},
		{domain.Taxpayer{TaxIDType: domain.TaxIDPasaporte, TaxID: "X1234567", LegalName: "John Doe"}, ReceiverForeign, "", nil},
		{domain.Taxpayer{TaxIDType: domain.TaxIDRUCJuridico, TaxID: "2588017-1-831938", CheckDigit: "20", LegalName: "Sin dirección, S.A."},
			"", "", domain.ErrInvalidTaxpayer},
		{domain.Taxpayer{TaxIDType: domain.TaxIDGobierno, TaxID: "1234567-1-123456", CheckDigit: "01", LegalName: "Ministerio", Address: "Avenida Perú"},
			"", "", domain.ErrInvalidRequest}, // gobierno exige CPBS por línea
	}
	for i, c := range cases {
		d := sampleDoc()
		tp := c.tp
		d.Customer = &tp
		g, err := Build(d)
		if c.wantErr != nil {
			if !errors.Is(err, c.wantErr) {
				t.Fatalf("caso %d: %v, se esperaba %v", i, err, c.wantErr)
			}
			continue
		}
		if err != nil || g.Receiver.Type != c.kind || g.Receiver.TaxpayerKind != c.contrib {
			t.Fatalf("caso %d: %v %+v", i, err, g.Receiver)
		}
	}
}

func TestDGI_RulesIndependentOfThePAC(t *testing.T) {
	for name, mut := range map[string]func(*pac.Document){
		"moneda":           func(d *pac.Document) { d.Currency = "EUR" },
		"varios medios":    func(d *pac.Document) { d.PaymentMethods = []string{"CASH", "CARD"} },
		"medio sin código": func(d *pac.Document) { d.PaymentMethods = []string{"BITCOIN"} },
		"tasa sin clase":   func(d *pac.Document) { d.RateClasses = map[int64]string{0: domain.RateExempt} },
		"nota sin CUFE":    func(d *pac.Document) { d.DocType = domain.DocCreditNote },
		"punto 000":        func(d *pac.Document) { d.PointOfSaleCode = "000" },
	} {
		d := sampleDoc()
		mut(&d)
		if _, err := Build(d); !errors.Is(err, domain.ErrInvalidRequest) {
			t.Fatalf("%s: %v", name, err)
		}
	}
	d := sampleDoc()
	d.DocType, d.RelatedCUFE, d.RelatedIssuedAt = domain.DocCreditNote, testCUFE, d.IssuedAt.Add(-time.Hour)
	g, err := Build(d)
	if err != nil || g.DocType != DocCreditNote || g.Nature != NatureReturn || g.Related == nil || g.Related.CUFE != testCUFE {
		t.Fatalf("nota de crédito: %v %+v", err, g)
	}
	d.DocType = domain.DocDebitNote
	if g, err := Build(d); err != nil || g.DocType != DocDebitNote || g.Nature != NatureSale {
		t.Fatalf("nota de débito: %v %+v", err, g)
	}
	d = sampleDoc()
	d.PaymentMethods = []string{"card"}
	if g, err := Build(d); err != nil || g.Payment.Code != "99" || g.Payment.Description != "Tarjeta" {
		t.Fatalf("tarjeta sin distinguir = otro con descripción: %v %+v", err, g.Payment)
	}
}
