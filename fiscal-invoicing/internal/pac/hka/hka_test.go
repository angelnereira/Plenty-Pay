package hka

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
	"plentypay/fiscal-invoicing/internal/pac"
)

const testCUFE = "FE01200002588017-1-831938-2000012026102100000000010010112345678901"

var testClasses = map[int64]string{0: domain.RateExempt, 700: domain.RateStandard, 1000: domain.RateAlcohol, 1500: domain.RateTobacco}

func sampleDoc() pac.Document {
	lines, totals, err := domain.ComputeLines([]domain.Line{
		{Description: "Café americano", QuantityMilli: 3000, UnitPriceMinor: 150, DiscountMinor: 30, TaxRateBps: 700},
		{Description: "Cerveza nacional", QuantityMilli: 2000, UnitPriceMinor: 275, TaxRateBps: 1000},
	}, map[int64]bool{700: true, 1000: true})
	if err != nil {
		panic(err)
	}
	return pac.Document{Environment: domain.EnvDemo, BranchCode: "0000", DocType: domain.DocFiscalInvoice,
		PointOfSaleCode: "001", Number: 42, Lines: lines, Totals: totals, Currency: "USD", PaymentMethods: []string{"CASH"},
		RateClasses: testClasses, IssuedAt: time.Date(2026, 10, 21, 15, 4, 5, 0, time.UTC)}
}

// ADR 0022: la traducción a HKA del documento DGI pasa la validación previa del SDK.
func TestR10_HKATranslationPassesSDKValidation(t *testing.T) {
	doc, err := build(sampleDoc())
	if err != nil {
		t.Fatal(err)
	}
	if ve := validate.Document(doc); ve != nil {
		t.Fatalf("el SDK rechaza el documento: %v", ve)
	}
	dt := doc.DatosTransaccion
	if dt.FechaEmision != "2026-10-21T10:04:05-05:00" || dt.NumeroDocumentoFiscal != "0000000042" ||
		doc.ListaItems[0].TasaITBMS != types.ITBMS7 || doc.ListaItems[0].PrecioItem != "4.20" ||
		doc.TotalesSubTotales.ListaFormaPago[0].FormaPagoFact != types.PagoEfectivo || doc.CodigoSucursalEmisor != "0000" {
		t.Fatalf("%+v", doc)
	}
	d := sampleDoc()
	d.Customer = &domain.Taxpayer{TaxIDType: domain.TaxIDPasaporte, TaxID: "X1234567", LegalName: "John Doe"}
	if err := New(Config{}).Check(d); err != nil {
		t.Fatalf("extranjero: %v", err)
	}
	d.DocType, d.RelatedCUFE, d.RelatedIssuedAt = domain.DocCreditNote, testCUFE, d.IssuedAt.Add(-time.Hour)
	doc, _ = build(d)
	if doc.DatosTransaccion.TipoDocumento != types.TipoDocNotaCreditoRef || len(doc.DatosTransaccion.ListaDocsFiscalReferenciados) != 1 {
		t.Fatalf("nota: %+v", doc.DatosTransaccion)
	}
}

// Check devuelve errores de dominio: lo del receptor como INVALID_TAXPAYER.
func TestR10_HKACheckReturnsDomainErrors(t *testing.T) {
	a := New(Config{})
	d := sampleDoc()
	d.Customer = &domain.Taxpayer{TaxIDType: domain.TaxIDRUCJuridico, TaxID: "2588017-1-831938", CheckDigit: "20", LegalName: "Sin dirección"}
	if err := a.Check(d); !errors.Is(err, domain.ErrInvalidTaxpayer) {
		t.Fatalf("%v", err)
	}
	d = sampleDoc()
	d.Currency = "EUR"
	if err := a.Check(d); !errors.Is(err, domain.ErrInvalidRequest) {
		t.Fatalf("%v", err)
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

func newFake(t *testing.T, send string) (*fakeHKA, *Adapter) {
	f := &fakeHKA{send: send, status: "200"}
	srv := httptest.NewServer(http.HandlerFunc(f.handler))
	t.Cleanup(srv.Close)
	return f, New(Config{DemoEndpoint: srv.URL, ProdEndpoint: srv.URL, Timeout: 2 * time.Second})
}

var creds = pac.Credentials{KeyTokenEmpresa: "tok-emp", KeyTokenPassword: "tok-pass"}

// ADR 0022 §10: traducción de las respuestas de HKA.
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
		var re *pac.RetryError
		if !errors.Is(err, pac.ErrTransient) || !errors.As(err, &re) || re.Alert != alert || re.Message == "" {
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
	h := New(Config{DemoEndpoint: url, Timeout: time.Second})
	if _, err := h.Send(ctx, creds, sampleDoc()); !errors.Is(err, pac.ErrTransient) {
		t.Fatalf("sin red = reintento: %v", err)
	}
	var re *pac.RetryError
	if _, err := h.Send(ctx, pac.Credentials{}, sampleDoc()); !errors.As(err, &re) || !re.Alert {
		t.Fatalf("sin credenciales = reintento con alerta: %v", err)
	}
	d := sampleDoc()
	d.Environment = domain.EnvProd
	if _, err := h.Send(ctx, creds, d); !errors.As(err, &re) || !re.Alert {
		t.Fatalf("PROD sin habilitar: %v", err)
	}
	d = sampleDoc()
	d.Currency = "EUR"
	if _, err := h.Send(ctx, creds, d); !errors.Is(err, pac.ErrInvalidDocument) {
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
	i := h.Info()
	if i.ID != ID || i.Simulated || len(i.Environments) != 1 || len(i.Credentials) != 2 || !i.Credentials[1].Secret ||
		i.CredentialKeys()[0] != KeyTokenEmpresa {
		t.Fatalf("%+v", i)
	}
	if n, err := h.RemainingFolios(context.Background(), domain.EnvDemo, creds); err != nil || n != 1234 {
		t.Fatalf("%d %v", n, err)
	}
	if envs := New(Config{ProdEnabled: true}).Info().Environments; len(envs) != 2 || envs[1] != domain.EnvProd {
		t.Fatalf("FISCAL_PROD_ENABLED: %v", envs)
	}
}
