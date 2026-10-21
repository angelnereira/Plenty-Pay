package domain

import (
	"errors"
	"testing"
)

func demoProfile() Profile {
	return Profile{RUC: "2588017-1-831938", DV: "20", LegalName: "Café La Esquina, S.A.", BranchCode: "0000",
		PointOfSaleCode: "001", PACProvider: ProviderSimulator, CheckoutPreference: PrefAlwaysFiscal, Environment: EnvDemo}
}

// N-FMT-06: jurídica rollo-folio-asiento, natural = cédula (N-FMT-05), extranjero NT; DV de 2 dígitos.
func TestN_FMT_06_RUCFormat(t *testing.T) {
	for _, ok := range [][2]string{{"2588017-1-831938", "20"}, {"8-926-1601", "05"}, {"PE-12-345", "11"}, {"NT-12345", "01"}} {
		if !ValidRUCFormat(ok[0], ok[1]) {
			t.Fatalf("%v es válido", ok)
		}
	}
	for _, bad := range [][2]string{{"2588017-1-831938", "2"}, {"2588017-1-831938", "AB"}, {"8-926", "05"}, {"8926 1601", "05"}, {"", "05"}} {
		if ValidRUCFormat(bad[0], bad[1]) {
			t.Fatalf("%v no es válido", bad)
		}
	}
}

func TestProfile_Validate(t *testing.T) {
	if err := demoProfile().Validate(); err != nil {
		t.Fatalf("perfil DEMO válido: %v", err)
	}
	p := demoProfile()
	p.DV = "2"
	if !errors.Is(p.Validate(), ErrInvalidRUC) {
		t.Fatal("DV de un dígito")
	}
	p = demoProfile()
	p.CheckoutPreference = PrefAutoThreshold
	if !errors.Is(p.Validate(), ErrInvalidRequest) {
		t.Fatal("AUTO_THRESHOLD exige umbral")
	}
	p = demoProfile()
	p.PACProvider = "hka"
	if !errors.Is(p.Validate(), ErrInvalidRequest) {
		t.Fatal("DEMO solo usa el simulador")
	}
}

// R9: producción exige un PAC real, que aún no existe (Q-11).
func TestR9_ProdRequiresRealPAC(t *testing.T) {
	p := demoProfile()
	p.Environment = EnvProd
	if !errors.Is(p.Validate(), ErrPacNotConfigured) {
		t.Fatal("PROD sin PAC real")
	}
}

// domain-model §8.8 / N-FIS-04: decisión de documento según la preferencia del negocio.
func TestN_FIS_04_DocumentPolicy(t *testing.T) {
	threshold := int64(5000)
	auto := demoProfile()
	auto.CheckoutPreference, auto.AutoThresholdMinor = PrefAutoThreshold, &threshold
	cases := []struct {
		p                Profile
		total            int64
		requests, hasTax bool
		doc              int
		ask              bool
	}{
		{demoProfile(), 100, false, false, DocFiscalInvoice, false},
		{func() Profile { p := demoProfile(); p.CheckoutPreference = PrefInternalOnly; return p }(), 100000, false, false, DocInternalReceipt, false},
		{func() Profile { p := demoProfile(); p.CheckoutPreference = PrefAskAlways; return p }(), 100, false, false, DocFiscalInvoice, true},
		{auto, 3000, false, false, DocInternalReceipt, false}, // aceptación 4: 30.00 → recibo
		{auto, 8000, false, false, DocFiscalInvoice, false},   // aceptación 4: 80.00 → factura
		{auto, 5000, false, false, DocFiscalInvoice, false},   // igual al umbral → factura
		{auto, 3000, true, false, DocFiscalInvoice, false},
		{auto, 3000, false, true, DocFiscalInvoice, false},
	}
	for i, c := range cases {
		d := EvaluatePolicy(c.p, c.total, c.requests, c.hasTax)
		if d.DocType != c.doc || d.NeedsCustomerDecision != c.ask || d.AppliedPreference != c.p.CheckoutPreference {
			t.Fatalf("caso %d: %+v", i, d)
		}
	}
}

// N-FIS-07: receptor según su tipo de identificación.
func TestN_FIS_07_TaxpayerValidation(t *testing.T) {
	ok := []Taxpayer{
		{TaxIDType: TaxIDRUCJuridico, TaxID: "2588017-1-831938", CheckDigit: "20", LegalName: "Distribuidora, S.A."},
		{TaxIDType: TaxIDCedula, TaxID: "8-926-1601", LegalName: "Ana Pérez", Email: "ana@example.com"},
		{TaxIDType: TaxIDPasaporte, TaxID: "X1234567", LegalName: "John Doe"},
	}
	for _, tp := range ok {
		if err := tp.Normalize().Validate(); err != nil {
			t.Fatalf("%+v: %v", tp, err)
		}
	}
	bad := map[Taxpayer]error{
		{TaxIDType: TaxIDRUCJuridico, TaxID: "2588017-1-831938", LegalName: "Sin DV"}:          ErrInvalidRUC,
		{TaxIDType: TaxIDCedula, TaxID: "99-1-1", LegalName: "Provincia inexistente"}:          ErrInvalidTaxpayer,
		{TaxIDType: "NIT", TaxID: "123", LegalName: "Tipo desconocido"}:                        ErrInvalidTaxpayer,
		{TaxIDType: TaxIDCedula, TaxID: "8-926-1601", LegalName: "Ana", Email: "no-es-correo"}: ErrInvalidTaxpayer,
		{TaxIDType: TaxIDCedula, TaxID: "8-926-1601"}:                                          ErrInvalidTaxpayer,
	}
	for tp, want := range bad {
		if err := tp.Normalize().Validate(); !errors.Is(err, want) {
			t.Fatalf("%+v: %v, se esperaba %v", tp, err, want)
		}
	}
}
