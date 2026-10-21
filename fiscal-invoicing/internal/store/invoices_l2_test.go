//go:build l2

package store_test

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"google.golang.org/grpc/metadata"

	"plentypay/fiscal-invoicing/internal/client"
	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/pac"
	"plentypay/fiscal-invoicing/internal/service"
	"plentypay/fiscal-invoicing/internal/store"
)

// rates simula infra-management: vector de prueba, no el valor legal.
type rates struct{ fail bool }

func (r rates) TaxRates(context.Context, string) (client.Rates, error) {
	if r.fail {
		return client.Rates{}, client.ErrUnavailable
	}
	return client.Rates{Allowed: map[int64]bool{700: true, 1000: true, 1500: true}, Version: "legal.pa.itbms.standard_bps=700@test"}, nil
}

type noIdentity struct{}

func (noIdentity) TenantLegal(context.Context, string, string) (client.TenantLegal, error) {
	return client.TenantLegal{}, nil
}
func (noIdentity) ConsumeStepUp(context.Context, string, string, string, string) (string, error) {
	return "", nil
}

type noSecrets struct{}

func (noSecrets) PutSecret(context.Context, string, string, []byte, string) (string, error) {
	return "", nil
}

func (noSecrets) GetSecret(context.Context, string, string) ([]byte, error) { return nil, nil }

type clock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *clock) now() time.Time      { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *clock) add(d time.Duration) { c.mu.Lock(); defer c.mu.Unlock(); c.t = c.t.Add(d) }

func invoicing(t *testing.T, s *store.Store, r rates) (*service.Invoicing, *pac.Simulator, *clock) {
	t.Helper()
	sim := pac.NewSimulator()
	c := &clock{t: time.Now().UTC().Truncate(time.Microsecond)}
	base := service.New(s, noIdentity{}, noSecrets{}, pac.NewRegistry(sim), c.now, func() string { return uuid.Must(uuid.NewV7()).String() })
	return service.NewInvoicing(base, s, r, nil, nil), sim, c
}

func cashier(tenant string) context.Context {
	return metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-pp-tenant-id", tenant,
		"x-pp-user-id", uuid.NewString(), "x-pp-permissions", "fiscal:issue,fiscal:read", "x-pp-actor-service", "api-gateway"))
}

func threeLines() []domain.Line {
	return []domain.Line{
		{Description: "Café 250 g", QuantityMilli: 2000, UnitPriceMinor: 1850, TaxRateBps: 700},
		{Description: "Taza", QuantityMilli: 1000, UnitPriceMinor: 1200, TaxRateBps: 700},
		{Description: "Croissant", QuantityMilli: 3000, UnitPriceMinor: 425, TaxRateBps: 700},
	}
}

func issue(t *testing.T, svc *service.Invoicing, tenant, key, source string) domain.Invoice {
	t.Helper()
	inv, err := svc.IssueInvoice(cashier(tenant), service.IssueInput{IdempotencyKey: key, RequestHash: []byte(source),
		Lines: threeLines(), SourceType: "sale", SourceID: source, Currency: "USD", PaymentMethods: []string{"CASH"}})
	if err != nil {
		t.Fatalf("emitir: %v", err)
	}
	return inv
}

func outboxSubjects(t *testing.T, s *store.Store, invoiceID string) []string {
	t.Helper()
	var out []string
	ctx := context.Background()
	err := pgx.BeginTxFunc(ctx, s.Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'SYSTEM', true)`); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT subject FROM outbox WHERE aggregate_id = $1 ORDER BY created_at`, invoiceID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var sub string
			if err := rows.Scan(&sub); err != nil {
				return err
			}
			out = append(out, sub)
		}
		return rows.Err()
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// Aceptación 1 (sin PDF, que llega en el bloque C): venta de 3 líneas con ITBMS 7 % → factura ACCEPTED
// con CUFE del simulador, número asignado y evento InvoiceAccepted por el outbox.
func TestL2_Acceptance1_ThreeLinesAcceptedWithCUFE(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	svc, _, _ := invoicing(t, s, rates{})
	inv := issue(t, svc, tenant, "venta-0001-clave-idem", "sale-1")
	if inv.Status != domain.StatusQueued || inv.Number != 1 || inv.Totals.SubtotalMinor != 6175 || inv.Totals.TaxMinor != 432 ||
		inv.Totals.TotalMinor != 6607 || inv.LegalParamVersion == "" || inv.Environment != domain.EnvDemo {
		t.Fatalf("en cola: %+v", inv)
	}
	if n, err := svc.ProcessDue(context.Background(), 10); err != nil || n != 1 {
		t.Fatalf("envío: %d %v", n, err)
	}
	got, err := svc.GetInvoice(cashier(tenant), inv.ID)
	if err != nil || got.Status != domain.StatusAccepted || !strings.HasPrefix(got.CUFE, pac.SimulatorPrefix) ||
		!strings.HasPrefix(got.QR, pac.DemoQRNotice) || got.IssuedAt == nil {
		t.Fatalf("aceptada: %v %+v", err, got)
	}
	if subs := outboxSubjects(t, s, inv.ID); len(subs) != 1 || subs[0] != "pp.fiscal.invoice.accepted.v1" {
		t.Fatalf("evento: %v", subs)
	}
}

// Aceptación 2 y R3: el PAC falla 3 veces y luego acepta → una sola factura, sin huecos de número; los
// reintentos esperan su turno (backoff) y el evento sale una vez.
func TestL2_Acceptance2_TimeoutsThenAcceptOneInvoiceNoGaps(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	svc, sim, clk := invoicing(t, s, rates{})
	sim.FailNext(3)
	inv := issue(t, svc, tenant, "venta-0002-clave-idem", "sale-2")
	for i := 0; i < 3; i++ {
		if n, err := svc.ProcessDue(context.Background(), 10); err != nil || n != 1 {
			t.Fatalf("intento %d: %d %v", i+1, n, err)
		}
		if n, _ := svc.ProcessDue(context.Background(), 10); n != 0 {
			t.Fatalf("intento %d: no se reintenta antes del backoff", i+1)
		}
		clk.add(domain.NextRetry(i+1) + time.Second)
	}
	if n, err := svc.ProcessDue(context.Background(), 10); err != nil || n != 1 {
		t.Fatalf("cuarto intento: %d %v", n, err)
	}
	got, _ := svc.GetInvoice(cashier(tenant), inv.ID)
	if got.Status != domain.StatusAccepted || got.PacAttempts != 4 || got.Number != 1 {
		t.Fatalf("aceptada tras 4 intentos: %+v", got)
	}
	next := issue(t, svc, tenant, "venta-0003-clave-idem", "sale-3")
	if next.Number != 2 {
		t.Fatalf("la siguiente factura es la 2, sin huecos: %d", next.Number)
	}
	if subs := outboxSubjects(t, s, inv.ID); len(subs) != 1 {
		t.Fatalf("un solo evento: %v", subs)
	}
	if len(sim.Sent()) != 4 {
		t.Fatalf("el PAC recibió 4 intentos: %d", len(sim.Sent()))
	}
}

// grpc-conventions §3 y R6: misma clave y contenido → misma factura; otra clave para el mismo origen →
// la misma factura; misma clave con otro contenido → IDEMPOTENCY_KEY_REUSED.
func TestL2_R6_IdempotentBySourceAndKey(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	svc, _, _ := invoicing(t, s, rates{})
	first := issue(t, svc, tenant, "venta-0004-clave-idem", "sale-4")
	if again := issue(t, svc, tenant, "venta-0004-clave-idem", "sale-4"); again.ID != first.ID || again.Number != first.Number {
		t.Fatalf("misma clave: %+v", again)
	}
	if bySource := issue(t, svc, tenant, "otra-clave-0004-idem", "sale-4"); bySource.ID != first.ID {
		t.Fatalf("mismo origen (R6): %+v", bySource)
	}
	_, err := svc.IssueInvoice(cashier(tenant), service.IssueInput{IdempotencyKey: "venta-0004-clave-idem", RequestHash: []byte("otro"),
		Lines: threeLines(), SourceType: "sale", SourceID: "sale-99", Currency: "USD"})
	if !errors.Is(err, domain.ErrIdempotencyReused) {
		t.Fatalf("clave reutilizada: %v", err)
	}
}

// R1 y AGENTS.md §2.13: sin tasas legales no se emite; una tasa fuera de las vigentes se rechaza.
func TestL2_R1_RatesFromInfraManagement(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	down, _, _ := invoicing(t, s, rates{fail: true})
	_, err := down.IssueInvoice(cashier(tenant), service.IssueInput{IdempotencyKey: "venta-0005-clave-idem", RequestHash: []byte("x"),
		Lines: threeLines(), SourceType: "sale", SourceID: "sale-5", Currency: "USD"})
	if !errors.Is(err, domain.ErrDependency) {
		t.Fatalf("infra-management caído: %v", err)
	}
	svc, _, _ := invoicing(t, s, rates{})
	_, err = svc.IssueInvoice(cashier(tenant), service.IssueInput{IdempotencyKey: "venta-0006-clave-idem", RequestHash: []byte("y"),
		Lines: []domain.Line{{Description: "x", QuantityMilli: 1000, UnitPriceMinor: 100, TaxRateBps: 800}}, SourceType: "sale",
		SourceID: "sale-6", Currency: "USD"})
	if !errors.Is(err, domain.ErrInvalidTaxRate) {
		t.Fatalf("tasa 8 %%: %v", err)
	}
	if st, _ := s.GetFolioStatus(context.Background(), tenant, "001"); st.Next != 1 {
		t.Fatalf("un rechazo no consume número: %+v", st)
	}
}

// R3: el PAC rechaza → REJECTED con motivo y evento InvoiceRejected; el número se conserva (R2).
func TestL2_R3_RejectedKeepsNumber(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	svc, sim, _ := invoicing(t, s, rates{})
	sim.RejectWith("RUC del receptor no inscrito")
	inv := issue(t, svc, tenant, "venta-0007-clave-idem", "sale-7")
	if _, err := svc.ProcessDue(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	got, _ := svc.GetInvoice(cashier(tenant), inv.ID)
	if got.Status != domain.StatusRejected || got.RejectionReason != "RUC del receptor no inscrito" || got.Number != 1 {
		t.Fatalf("rechazada: %+v", got)
	}
	if subs := outboxSubjects(t, s, inv.ID); len(subs) != 1 || subs[0] != "pp.fiscal.invoice.rejected.v1" {
		t.Fatalf("evento: %v", subs)
	}
}

// N-FIS-08: una factura aceptada no se edita ni se borra (disparador en la base).
func TestL2_N_FIS_08_AcceptedIsImmutable(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	svc, _, _ := invoicing(t, s, rates{})
	inv := issue(t, svc, tenant, "venta-0008-clave-idem", "sale-8")
	if _, err := svc.ProcessDue(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	for _, sql := range []string{`UPDATE invoices SET total_minor = 1, subtotal_minor = 1, tax_minor = 0 WHERE id = $1`,
		`DELETE FROM invoices WHERE id = $1`} {
		err := pgx.BeginTxFunc(ctx, s.Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, `SELECT set_config('app.actor_role', 'SYSTEM', true)`); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, sql, inv.ID)
			return err
		})
		if err == nil || !strings.Contains(err.Error(), "N-FIS-08") && !strings.Contains(err.Error(), "permission denied") {
			t.Fatalf("%s debía fallar: %v", sql, err)
		}
	}
}

// RLS: otro negocio no ve la factura.
func TestL2_RLS_InvoiceIsolation(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	other := newTenant(t, s)
	svc, _, _ := invoicing(t, s, rates{})
	inv := issue(t, svc, tenant, "venta-0009-clave-idem", "sale-9")
	if _, err := svc.GetInvoice(cashier(other), inv.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("otro negocio: %v", err)
	}
	list, _, err := svc.ListInvoices(cashier(other), store.ListFilter{})
	if err != nil || len(list) != 0 {
		t.Fatalf("lista de otro negocio: %v %d", err, len(list))
	}
	mine, _, err := svc.ListInvoices(cashier(tenant), store.ListFilter{Limit: 1})
	if err != nil || len(mine) != 1 || mine[0].ID != inv.ID {
		t.Fatalf("lista propia: %v %+v", err, mine)
	}
}
