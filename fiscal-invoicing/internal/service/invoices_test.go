package service

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"plentypay/fiscal-invoicing/internal/client"
	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/observability"
	"plentypay/fiscal-invoicing/internal/pac"
	"plentypay/fiscal-invoicing/internal/store"
)

// fakeInvoices registra lo que el worker hace con cada documento.
type fakeInvoices struct {
	mu          sync.Mutex
	due         []domain.Invoice
	created     []domain.Invoice
	accepted    map[string]string // id → CUFE
	rejected    map[string]string // id → motivo
	rescheduled map[string]string // id → last_error
}

func newFakeInvoices(due ...domain.Invoice) *fakeInvoices {
	return &fakeInvoices{due: due, accepted: map[string]string{}, rejected: map[string]string{}, rescheduled: map[string]string{}}
}

func (f *fakeInvoices) CreateInvoice(_ context.Context, inv domain.Invoice) (domain.Invoice, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.created = append(f.created, inv)
	return inv, true, nil
}
func (f *fakeInvoices) GetInvoice(context.Context, string, string) (domain.Invoice, error) {
	return domain.Invoice{}, domain.ErrNotFound
}
func (f *fakeInvoices) ListInvoices(context.Context, string, store.ListFilter) ([]domain.Invoice, string, error) {
	return nil, "", nil
}
func (f *fakeInvoices) ClaimDue(context.Context, time.Time, int, time.Duration) ([]domain.Invoice, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := f.due
	f.due = nil
	return out, nil
}
func (f *fakeInvoices) MarkAccepted(_ context.Context, id, cufe, _ string, _ time.Time, _ store.OutboxEvent) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.accepted[id] = cufe
	return nil
}
func (f *fakeInvoices) MarkRejected(_ context.Context, id, reason string, _ time.Time, _ store.OutboxEvent) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rejected[id] = reason
	return nil
}
func (f *fakeInvoices) Reschedule(_ context.Context, id string, _ time.Time, lastError string, _ time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rescheduled[id] = lastError
	return nil
}
func (f *fakeInvoices) PendingAgeSeconds(context.Context, time.Time) (float64, error) { return 0, nil }

// fakePAC es un adaptador que pide credenciales y responde lo que la prueba indique.
type fakePAC struct {
	result  pac.Result
	err     error
	gotCred pac.Credentials
	checkFn func(pac.Document) error
}

func (p *fakePAC) Info() pac.Info {
	return pac.Info{ID: "fake", DisplayName: "Fake", Environments: []string{domain.EnvDemo}, CredentialKeys: []string{"token"}}
}
func (p *fakePAC) Check(d pac.Document) error {
	if p.checkFn != nil {
		return p.checkFn(d)
	}
	return nil
}
func (p *fakePAC) Send(_ context.Context, c pac.Credentials, _ pac.Document) (pac.Result, error) {
	p.gotCred = c
	return p.result, p.err
}

type fakeRates struct{}

func (fakeRates) TaxRates(context.Context, string) (client.Rates, error) {
	return client.Rates{Allowed: map[int64]bool{700: true}, Version: "legal.pa.itbms.standard_bps=700@2026-10-13T00:00:00Z"}, nil
}

type sendFixture struct {
	*fixture
	inv  *Invoicing
	st   *fakeInvoices
	fake *fakePAC
	logs *bytes.Buffer
}

func newSendFixture(due ...domain.Invoice) *sendFixture {
	f := newFixture()
	fake := &fakePAC{result: pac.Result{Accepted: true, CUFE: "CUFE-1"}}
	f.pacs = pac.NewRegistry(f.sim, fake)
	f.svc.pacs = f.pacs
	logs := &bytes.Buffer{}
	logger := observability.NewLogger(logs, "fiscal-invoicing", "test", slog.LevelDebug)
	st := newFakeInvoices(due...)
	inv := NewInvoicing(f.svc, st, fakeRates{}, nil, observability.NewReporter(logger, "fiscal-invoicing", nil))
	return &sendFixture{fixture: f, inv: inv, st: st, fake: fake, logs: logs}
}

func queued(id, secret string) domain.Invoice {
	return domain.Invoice{ID: id, TenantID: tenantA, DocType: domain.DocFiscalInvoice, Environment: domain.EnvDemo,
		PacProvider: "fake", CredentialsSecret: secret, PointOfSaleCode: "001", Number: 1, Currency: "USD"}
}

// R3 + ADR 0022 §4: el worker lee las credenciales de security y las entrega solo al adaptador.
func TestR3_SendUsesCredentialsFromSecurity(t *testing.T) {
	f := newSendFixture(queued("inv-1", "fiscal/t/pac"))
	f.secrets.puts["fiscal/t/pac"] = []byte(`{"token":"tok-secreto"}`)
	if n, err := f.inv.ProcessDue(context.Background(), 10); err != nil || n != 1 {
		t.Fatalf("%d %v", n, err)
	}
	if f.st.accepted["inv-1"] != "CUFE-1" || f.fake.gotCred["token"] != "tok-secreto" {
		t.Fatalf("aceptado %v, credenciales %v", f.st.accepted, f.fake.gotCred)
	}
	if strings.Contains(f.logs.String(), "tok-secreto") {
		t.Fatal("el token nunca se registra")
	}
}

// R3: sin credenciales el documento sigue en cola con un mensaje claro y una alerta registrada.
func TestR3_MissingCredentialsRetryWithAlert(t *testing.T) {
	f := newSendFixture(queued("inv-1", ""))
	if _, err := f.inv.ProcessDue(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	if f.st.rescheduled["inv-1"] != "faltan las credenciales del PAC" || len(f.st.accepted) != 0 {
		t.Fatalf("%v", f.st.rescheduled)
	}
	if !strings.Contains(f.logs.String(), `"msg":"pac needs attention"`) || !strings.Contains(f.logs.String(), `"peer.service":"pac-fake"`) {
		t.Fatalf("alerta registrada: %s", f.logs.String())
	}
}

// R3: un fallo transitorio sin alerta (security o el PAC no respondieron) se reintenta sin ruido.
func TestR3_TransientFailureIsRescheduled(t *testing.T) {
	f := newSendFixture(queued("inv-1", "fiscal/t/pac"))
	f.secrets.getErr = client.ErrUnavailable
	if _, err := f.inv.ProcessDue(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	if f.st.rescheduled["inv-1"] != "no se pudieron leer las credenciales del PAC" {
		t.Fatalf("%v", f.st.rescheduled)
	}
	f.secrets.getErr = nil
	f.secrets.puts["fiscal/t/pac"] = []byte(`{"token":"x"}`)
	f.fake.err = &pac.RetryError{Message: "el PAC no respondió", Err: errors.New("timeout")}
	f.st.due = []domain.Invoice{queued("inv-2", "fiscal/t/pac")}
	if _, err := f.inv.ProcessDue(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	if f.st.rescheduled["inv-2"] != "el PAC no respondió" || strings.Contains(f.logs.String(), `"level":"error"`) {
		t.Fatalf("%v %s", f.st.rescheduled, f.logs.String())
	}
}

// observability-standards §9: un documento que el PAC no puede leer es un defecto (con pila) y se
// rechaza para no reintentarlo sin fin.
func TestObs_InvalidDocumentIsDefectAndRejected(t *testing.T) {
	f := newSendFixture(queued("inv-1", "fiscal/t/pac"))
	f.secrets.puts["fiscal/t/pac"] = []byte(`{"token":"x"}`)
	f.fake.err = errors.Join(pac.ErrInvalidDocument, errors.New("PrecioItem"))
	if _, err := f.inv.ProcessDue(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	if f.st.rejected["inv-1"] == "" || len(f.st.rescheduled) != 0 {
		t.Fatalf("rechazado %v, reprogramado %v", f.st.rejected, f.st.rescheduled)
	}
	l := f.logs.String()
	if !strings.Contains(l, `"msg":"pac rejected document format"`) || !strings.Contains(l, `"level":"error"`) ||
		!strings.Contains(l, "exception.stacktrace") {
		t.Fatalf("defecto registrado: %s", l)
	}
}

// R10: un documento cuyo adaptador ya no está registrado sigue en cola y alerta.
func TestR10_UnknownProviderRetriesWithAlert(t *testing.T) {
	inv := queued("inv-1", "")
	inv.PacProvider = "retirado"
	f := newSendFixture(inv)
	if _, err := f.inv.ProcessDue(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	if f.st.rescheduled["inv-1"] == "" || !strings.Contains(f.logs.String(), "pac needs attention") {
		t.Fatalf("%v %s", f.st.rescheduled, f.logs.String())
	}
}

// R2 + ADR 0022: el formato del PAC se revisa antes de numerar; un rechazo no consume folio.
func TestR2_PrecheckBeforeNumbering(t *testing.T) {
	f := newSendFixture()
	f.store.profiles[tenantA] = domain.Profile{TenantID: tenantA, RUC: "2588017-1-831938", DV: "20", LegalName: "Café",
		BranchCode: "0000", PointOfSaleCode: "001", PACProvider: "fake", Environment: domain.EnvDemo,
		CheckoutPreference: domain.PrefAlwaysFiscal, PACCredentialsSecret: "fiscal/t/pac"}
	f.fake.checkFn = func(pac.Document) error { return domain.ErrInvalidTaxpayer }
	in := IssueInput{IdempotencyKey: "emitir-factura-0001", RequestHash: []byte{1}, SourceType: "manual", SourceID: "m-1",
		Lines: []domain.Line{{Description: "Café", QuantityMilli: 1000, UnitPriceMinor: 150, TaxRateBps: 700}}, PaymentMethods: []string{"CASH"}}
	if _, err := f.inv.IssueInvoice(as(PermIssue, ""), in); !errors.Is(err, domain.ErrInvalidTaxpayer) {
		t.Fatalf("precheck: %v", err)
	}
	if len(f.st.created) != 0 {
		t.Fatal("no se numera un documento que el PAC rechazaría")
	}
	f.fake.checkFn = nil
	out, err := f.inv.IssueInvoice(as(PermIssue, ""), in)
	if err != nil || out.PacProvider != "fake" || out.BranchCode != "0000" || len(f.st.created) != 1 {
		t.Fatalf("emisión: %v %+v", err, out)
	}
}
