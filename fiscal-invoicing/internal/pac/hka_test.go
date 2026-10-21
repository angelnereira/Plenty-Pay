package pac

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/angelnereira/hka-sdk/types"
	"github.com/angelnereira/hka-sdk/validate"

	"plentypay/fiscal-invoicing/internal/domain"
)

const testCUFE = "FE01200002588017-1-831938-2000012026102100000000010010112345678901"

var testClasses = map[int64]string{0: domain.RateExempt, 700: domain.RateStandard, 1000: domain.RateAlcohol, 1500: domain.RateTobacco}

func sampleDoc() Document {
	lines, totals, err := domain.ComputeLines([]domain.Line{
		{Description: "Café americano", QuantityMilli: 3000, UnitPriceMinor: 150, DiscountMinor: 30, TaxRateBps: 700},
		{Description: "Cerveza nacional", QuantityMilli: 2000, UnitPriceMinor: 275, TaxRateBps: 1000},
		{Description: "Pan (exento)", QuantityMilli: 1500, UnitPriceMinor: 99, TaxRateBps: 0},
	}, map[int64]bool{700: true, 1000: true, 1500: true})
	if err != nil {
		panic(err)
	}
	return Document{InvoiceID: "inv-1", TenantID: "t-1", Environment: domain.EnvDemo, IssuerRUC: "2588017-1-831938",
		IssuerDV: "20", BranchCode: "0000", DocType: domain.DocFiscalInvoice, PointOfSaleCode: "001", Number: 42,
		Lines: lines, Totals: totals, Currency: "USD", PaymentMethods: []string{"CASH"}, RateClasses: testClasses,
		IssuedAt: time.Date(2026, 10, 21, 15, 4, 5, 0, time.UTC)}
}

// R1 + ADR 0013: los montos de HKA salen exactos de los centavos y pasan la validación del SDK.
func TestR1_HKADocumentFromIntegerCents(t *testing.T) {
	doc, err := BuildHKADocument(sampleDoc())
	if err != nil {
		t.Fatal(err)
	}
	if ve := validate.Document(doc); ve != nil {
		t.Fatalf("el SDK rechaza el documento: %v", ve)
	}
	it := doc.ListaItems[0]
	// 3 × 1.50 = 4.50 − 0.30 = 4.20; ITBMS 7 % = 0.294 → 0.29; descuento por unidad 0.10.
	if it.Cantidad != "3.000" || it.PrecioUnitario != "1.50" || it.PrecioUnitarioDescuento != "0.100000" ||
		it.PrecioItem != "4.20" || it.ValorITBMS != "0.29" || it.ValorTotal != "4.49" || it.TasaITBMS != types.ITBMS7 {
		t.Fatalf("línea 1: %+v", it)
	}
	if doc.ListaItems[1].TasaITBMS != types.ITBMS10 || doc.ListaItems[2].TasaITBMS != types.ITBMSExento {
		t.Fatal("clase de tasa → código DGI")
	}
	if doc.ListaItems[2].PrecioItem != "1.49" || doc.ListaItems[2].PrecioUnitarioDescuento != "" {
		t.Fatalf("línea exenta: %+v", doc.ListaItems[2])
	}
	tot := doc.TotalesSubTotales
	// Subtotal 4.20 + 5.50 + 1.49 = 11.19; ITBMS 0.29 + 0.55 = 0.84; total 12.03.
	if tot.TotalPrecioNeto != "11.19" || tot.TotalITBMS != "0.84" || tot.TotalFactura != "12.03" ||
		tot.TotalTodosItems != "12.03" || tot.NroItems != 3 || tot.ListaFormaPago[0].FormaPagoFact != types.PagoEfectivo ||
		tot.ListaFormaPago[0].ValorCuotaPagada != "12.03" {
		t.Fatalf("totales: %+v", tot)
	}
	dt := doc.DatosTransaccion
	if dt.NumeroDocumentoFiscal != "0000000042" || dt.PuntoFacturacionFiscal != "001" ||
		dt.FechaEmision != "2026-10-21T10:04:05-05:00" || dt.TipoDocumento != types.TipoDocFacturaInterna ||
		dt.Cliente.TipoClienteFE != types.ClienteConsumidorFinal || doc.CodigoSucursalEmisor != "0000" {
		t.Fatalf("transacción: %+v", dt)
	}
}

func TestHKA_UnitDiscountAndFormats(t *testing.T) {
	cases := []struct {
		disc, qty int64
		want      string
	}{{30, 3000, "0.100000"}, {100, 3000, "0.333333"}, {200, 3000, "0.666667"}, {1, 1_000_000_000, "0.000000"}, {999_999_999_999, 1000, "9999999999.990000"}}
	for _, c := range cases {
		if got := unitDiscount(c.disc, c.qty); got != c.want {
			t.Fatalf("unitDiscount(%d,%d)=%s, se esperaba %s", c.disc, c.qty, got, c.want)
		}
	}
	if money(5) != "0.05" || money(123456) != "1234.56" || quantity(1500) != "1.500" {
		t.Fatal("formatos")
	}
}

// N-FIS-07 + ADR 0022 §6: receptor según su tipo de identificación.
func TestN_FIS_07_HKAReceiverMapping(t *testing.T) {
	cases := []struct {
		tp      domain.Taxpayer
		tipo    types.TipoClienteFE
		contrib types.TipoContribuyente
		wantErr error
	}{
		{domain.Taxpayer{TaxIDType: domain.TaxIDRUCJuridico, TaxID: "2588017-1-831938", CheckDigit: "20", LegalName: "Distribuidora, S.A.", Address: "Calle 50, Ciudad de Panamá", Location: "8-8-7"},
			types.ClienteContribuyente, types.ContribuyenteJuridico, nil},
		{domain.Taxpayer{TaxIDType: domain.TaxIDRUCNatural, TaxID: "8-926-1601", CheckDigit: "05", LegalName: "Ana Pérez", Address: "Vía España 12"},
			types.ClienteContribuyente, types.ContribuyenteNatural, nil},
		{domain.Taxpayer{TaxIDType: domain.TaxIDGobierno, TaxID: "1234567-1-123456", CheckDigit: "01", LegalName: "Ministerio", Address: "Avenida Perú"},
			types.ClienteGobierno, types.ContribuyenteJuridico, domain.ErrInvalidRequest}, // gobierno exige CPBS por línea
		{domain.Taxpayer{TaxIDType: domain.TaxIDCedula, TaxID: "8-926-1601", LegalName: "Ana Pérez"},
			types.ClienteConsumidorFinal, types.ContribuyenteNatural, nil},
		{domain.Taxpayer{TaxIDType: domain.TaxIDPasaporte, TaxID: "X1234567", LegalName: "John Doe"},
			types.ClienteExtranjero, "", nil},
		{domain.Taxpayer{TaxIDType: domain.TaxIDRUCJuridico, TaxID: "2588017-1-831938", CheckDigit: "20", LegalName: "Sin dirección, S.A."},
			types.ClienteContribuyente, types.ContribuyenteJuridico, domain.ErrInvalidTaxpayer},
	}
	h := NewHKA(HKAConfig{})
	for i, c := range cases {
		d := sampleDoc()
		tp := c.tp
		d.Customer = &tp
		doc, err := BuildHKADocument(d)
		if err != nil {
			t.Fatalf("caso %d: %v", i, err)
		}
		if doc.DatosTransaccion.Cliente.TipoClienteFE != c.tipo || doc.DatosTransaccion.Cliente.TipoContribuyente != c.contrib {
			t.Fatalf("caso %d: %+v", i, doc.DatosTransaccion.Cliente)
		}
		err = h.Check(d)
		if c.wantErr == nil && err != nil || c.wantErr != nil && !errors.Is(err, c.wantErr) {
			t.Fatalf("caso %d: Check=%v, se esperaba %v", i, err, c.wantErr)
		}
	}
}

func TestHKA_CheckRejectsWhatHKACannotIssue(t *testing.T) {
	h := NewHKA(HKAConfig{})
	for name, mut := range map[string]func(*Document){
		"moneda":           func(d *Document) { d.Currency = "EUR" },
		"varios medios":    func(d *Document) { d.PaymentMethods = []string{"CASH", "CARD"} },
		"medio sin código": func(d *Document) { d.PaymentMethods = []string{"BITCOIN"} },
		"tasa sin clase":   func(d *Document) { d.RateClasses = map[int64]string{0: domain.RateExempt} },
		"nota sin CUFE":    func(d *Document) { d.DocType = domain.DocCreditNote },
	} {
		d := sampleDoc()
		mut(&d)
		if err := h.Check(d); !errors.Is(err, domain.ErrInvalidRequest) {
			t.Fatalf("%s: %v", name, err)
		}
	}
	d := sampleDoc()
	d.DocType, d.RelatedCUFE, d.RelatedIssuedAt = domain.DocCreditNote, testCUFE, d.IssuedAt.Add(-time.Hour)
	if err := h.Check(d); err != nil {
		t.Fatalf("nota de crédito referenciada: %v", err)
	}
	doc, _ := BuildHKADocument(d)
	if doc.DatosTransaccion.TipoDocumento != types.TipoDocNotaCreditoRef || doc.DatosTransaccion.NaturalezaOperacion != types.NatDevolucion {
		t.Fatalf("%+v", doc.DatosTransaccion)
	}
}

// fakeHKA responde como el servicio SOAP de HKA según la acción.
type fakeHKA struct {
	mu      sync.Mutex
	send    string // código para Enviar
	status  string // código para EstadoDocumento
	bodies  []string
	actions []string
}

func (f *fakeHKA) handler(w http.ResponseWriter, r *http.Request) {
	b, _ := io.ReadAll(r.Body)
	f.mu.Lock()
	f.bodies = append(f.bodies, string(b))
	action := r.Header.Get("SOAPAction")
	f.actions = append(f.actions, action)
	send, st := f.send, f.status
	f.mu.Unlock()
	var inner string
	switch {
	case strings.Contains(action, "Enviar"):
		inner = "<codigo>" + send + "</codigo><resultado>x</resultado><mensaje>Mensaje del PAC " + send + "</mensaje>"
		if send == "200" {
			inner += "<cufe>" + testCUFE + "</cufe><qr>https://dgi-fep.mef.gob.pa/Consultas/FacturasPorQR?chFE=" + testCUFE + "</qr>"
		}
	case strings.Contains(action, "EstadoDocumento"):
		inner = "<codigo>" + st + "</codigo><mensaje>ok</mensaje><cufe>" + testCUFE + "</cufe>"
	case strings.Contains(action, "FoliosRestantes"):
		inner = "<codigo>200</codigo><mensaje>ok</mensaje><foliosDisponibles>1234</foliosDisponibles>"
	}
	_, _ = io.WriteString(w, `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><Result>`+inner+`</Result></s:Body></s:Envelope>`)
}

func newFake(t *testing.T, send string) (*fakeHKA, *HKA) {
	f := &fakeHKA{send: send, status: "200"}
	srv := httptest.NewServer(http.HandlerFunc(f.handler))
	t.Cleanup(srv.Close)
	return f, NewHKA(HKAConfig{DemoEndpoint: srv.URL, ProdEndpoint: srv.URL, Timeout: 2 * time.Second})
}

var creds = Credentials{HKATokenEmpresa: "tok-emp", HKATokenPassword: "tok-pass"}

// ADR 0022 §8: traducción de las respuestas de HKA.
func TestR3_HKASendResponses(t *testing.T) {
	ctx := context.Background()
	_, h := newFake(t, "200")
	r, err := h.Send(ctx, creds, sampleDoc())
	if err != nil || !r.Accepted || r.CUFE != testCUFE || !strings.Contains(r.QR, testCUFE) {
		t.Fatalf("200: %+v %v", r, err)
	}

	_, h = newFake(t, "109")
	if r, err := h.Send(ctx, creds, sampleDoc()); err != nil || r.Accepted || r.RejectionReason != "Mensaje del PAC 109" {
		t.Fatalf("109 = rechazo con el mensaje del PAC: %+v %v", r, err)
	}

	for code, alert := range map[string]bool{"300": false, "119": true, "401": true, "500": true} {
		_, h = newFake(t, code)
		_, err := h.Send(ctx, creds, sampleDoc())
		var re *RetryError
		if !errors.Is(err, ErrTransient) || !errors.As(err, &re) || re.Alert != alert || re.Message == "" {
			t.Fatalf("%s = reintento (alerta %v): %v", code, alert, err)
		}
	}

	f, h := newFake(t, "102")
	r, err = h.Send(ctx, creds, sampleDoc())
	if err != nil || !r.Accepted || r.CUFE != testCUFE || len(f.actions) != 2 || !strings.Contains(f.actions[1], "EstadoDocumento") {
		t.Fatalf("102 = se recupera el CUFE con EstadoDocumento: %+v %v %v", r, err, f.actions)
	}
	if !strings.Contains(f.bodies[1], "0000000042") {
		t.Fatal("la consulta usa el número del documento")
	}
}

func TestR3_HKANetworkAndCredentials(t *testing.T) {
	ctx := context.Background()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	url := srv.URL
	srv.Close()
	h := NewHKA(HKAConfig{DemoEndpoint: url, Timeout: time.Second})
	if _, err := h.Send(ctx, creds, sampleDoc()); !errors.Is(err, ErrTransient) {
		t.Fatalf("sin red = reintento: %v", err)
	}
	var re *RetryError
	if _, err := h.Send(ctx, Credentials{}, sampleDoc()); !errors.As(err, &re) || !re.Alert {
		t.Fatalf("sin credenciales = reintento con alerta: %v", err)
	}
	d := sampleDoc()
	d.Environment = domain.EnvProd
	if _, err := h.Send(ctx, creds, d); !errors.As(err, &re) || !re.Alert {
		t.Fatalf("PROD sin habilitar: %v", err)
	}
	d = sampleDoc()
	d.Currency = "EUR"
	if _, err := h.Send(ctx, creds, d); !errors.Is(err, ErrInvalidDocument) {
		t.Fatalf("documento inválido al enviar = defecto: %v", err)
	}
}

// AGENTS.md §2.16: los tokens viajan solo en el sobre SOAP, nunca en el error.
func TestObs_HKATokensNotInErrors(t *testing.T) {
	f, h := newFake(t, "401")
	_, err := h.Send(context.Background(), creds, sampleDoc())
	if err == nil || strings.Contains(err.Error(), "tok-pass") || strings.Contains(err.Error(), "tok-emp") {
		t.Fatalf("%v", err)
	}
	if !strings.Contains(f.bodies[0], "tok-emp") {
		t.Fatal("el sobre lleva el token")
	}
}

func TestR10_HKAInfoAndFolios(t *testing.T) {
	_, h := newFake(t, "200")
	if i := h.Info(); i.ID != domain.ProviderHKA || len(i.Environments) != 1 || len(i.CredentialKeys) != 2 {
		t.Fatalf("%+v", i)
	}
	if n, err := h.RemainingFolios(context.Background(), domain.EnvDemo, creds); err != nil || n != 1234 {
		t.Fatalf("%d %v", n, err)
	}
	prod := NewHKA(HKAConfig{ProdEnabled: true})
	r := NewRegistry(NewSimulator(), prod)
	if !r.Supports(domain.ProviderHKA, domain.EnvProd) || r.Supports(domain.ProviderSimulator, domain.EnvProd) ||
		r.Get("otro") != nil || len(r.List()) != 2 || r.List()[0].ID != domain.ProviderSimulator {
		t.Fatal("registro")
	}
}
