//go:build l2

// Pruebas L2 de fiscal-invoicing contra PostgreSQL real y efímero (fiscal-invoicing/test/test_l2.sh).
package store_test

import (
	"context"
	"errors"
	"os"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/store"
)

var (
	once sync.Once
	st   *store.Store
)

func open(t *testing.T) *store.Store {
	t.Helper()
	once.Do(func() {
		if dsn := os.Getenv("PP_TEST_DB_DSN"); dsn != "" {
			s, err := store.Open(context.Background(), dsn)
			if err != nil {
				panic(err)
			}
			st = s
		}
	})
	if st == nil {
		t.Skip("PP_TEST_DB_DSN no definido")
	}
	return st
}

func newTenant(t *testing.T, s *store.Store) string {
	t.Helper()
	tenant := uuid.Must(uuid.NewV7()).String()
	_, err := s.UpsertProfile(context.Background(), domain.Profile{TenantID: tenant, RUC: "2588017-1-831938", DV: "20",
		LegalName: "Café La Esquina, S.A.", BranchCode: "0000", PointOfSaleCode: "001", PACProvider: domain.ProviderSimulator,
		CheckoutPreference: domain.PrefAlwaysFiscal, Environment: domain.EnvDemo, IdempotencyKey: "perfil-l2-000001",
		UpdatedAt: time.Now().UTC()})
	if err != nil {
		t.Fatalf("perfil: %v", err)
	}
	return tenant
}

// R2: 40 asignaciones simultáneas reciben 1..40 sin huecos ni repetidos; cada tipo lleva su serie.
func TestL2_R2_NumbersAreConsecutiveUnderConcurrency(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	const n = 40
	var (
		wg  sync.WaitGroup
		mu  sync.Mutex
		got []int64
	)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			num, err := s.AllocateNumberTx(context.Background(), tenant, domain.DocFiscalInvoice, "001")
			if err != nil {
				t.Errorf("asignar: %v", err)
				return
			}
			mu.Lock()
			got = append(got, num)
			mu.Unlock()
		}()
	}
	wg.Wait()
	sort.Slice(got, func(i, j int) bool { return got[i] < got[j] })
	for i, v := range got {
		if v != int64(i+1) {
			t.Fatalf("números %v: se esperaba 1..%d sin huecos", got, n)
		}
	}
	if num, err := s.AllocateNumberTx(context.Background(), tenant, domain.DocCreditNote, "001"); err != nil || num != 1 {
		t.Fatalf("la nota de crédito lleva su propia serie: %d %v", num, err)
	}
	stat, err := s.GetFolioStatus(context.Background(), tenant, "001")
	if err != nil || stat.Next != n+1 || stat.Remaining != -1 {
		t.Fatalf("estado de folios: %+v %v", stat, err)
	}
}

// R2: un número asignado en una transacción que se revierte no se consume (no deja huecos).
func TestL2_R2_RollbackDoesNotLeaveGaps(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	ctx := context.Background()
	errBoom := errors.New("fallo después de asignar")
	err := pgx.BeginTxFunc(ctx, s.Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenant); err != nil {
			return err
		}
		if _, err := store.AllocateNumber(ctx, tx, tenant, domain.DocFiscalInvoice, "001"); err != nil {
			return err
		}
		return errBoom
	})
	if !errors.Is(err, errBoom) {
		t.Fatalf("la transacción debía fallar: %v", err)
	}
	if num, err := s.AllocateNumberTx(ctx, tenant, domain.DocFiscalInvoice, "001"); err != nil || num != 1 {
		t.Fatalf("tras el rollback el siguiente es 1: %d %v", num, err)
	}
}

// RLS (ADR 0014): un negocio no ve el perfil ni los contribuyentes de otro.
func TestL2_RLS_TenantIsolation(t *testing.T) {
	s := open(t)
	a, b := newTenant(t, s), uuid.Must(uuid.NewV7()).String()
	ctx := context.Background()
	if _, err := s.GetProfile(ctx, b); !errors.Is(err, domain.ErrProfileMissing) {
		t.Fatalf("b no tiene perfil: %v", err)
	}
	now := time.Now().UTC()
	if _, err := s.UpsertTaxpayer(ctx, domain.Taxpayer{ID: uuid.NewString(), TenantID: a, TaxIDType: domain.TaxIDCedula,
		TaxID: "8-926-1601", LegalName: "Ana Pérez", CreatedAt: now, UpdatedAt: now}); err != nil {
		t.Fatal(err)
	}
	list, _, err := s.SearchTaxpayers(ctx, b, "Ana", 10, "")
	if err != nil || len(list) != 0 {
		t.Fatalf("b no ve los contribuyentes de a: %v %+v", err, list)
	}
	// Leer como b una fila de a directamente: RLS la oculta.
	var n int
	err = pgx.BeginTxFunc(ctx, s.Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, b); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `SELECT count(*) FROM profiles WHERE tenant_id = $1`, a).Scan(&n)
	})
	if err != nil || n != 0 {
		t.Fatalf("RLS: %d filas %v", n, err)
	}
}

// N-FIS-07 y unicidad: el mismo RUC actualiza al contribuyente; la búsqueda pagina por nombre.
func TestL2_TaxpayersUpsertAndSearch(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	ctx := context.Background()
	now := time.Now().UTC()
	first, err := s.UpsertTaxpayer(ctx, domain.Taxpayer{ID: uuid.NewString(), TenantID: tenant, TaxIDType: domain.TaxIDRUCJuridico,
		TaxID: "2588017-1-831938", CheckDigit: "20", LegalName: "Distribuidora Uno, S.A.", CreatedAt: now, UpdatedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.UpsertTaxpayer(ctx, domain.Taxpayer{ID: uuid.NewString(), TenantID: tenant, TaxIDType: domain.TaxIDRUCJuridico,
		TaxID: "2588017-1-831938", CheckDigit: "20", LegalName: "Distribuidora Uno (nuevo nombre), S.A.", CreatedAt: now, UpdatedAt: now})
	if err != nil || second.ID != first.ID || second.LegalName != "Distribuidora Uno (nuevo nombre), S.A." {
		t.Fatalf("el mismo RUC actualiza: %v %+v", err, second)
	}
	for _, name := range []string{"Distribuidora Dos", "Distribuidora Tres", "Otra Empresa"} {
		if _, err := s.UpsertTaxpayer(ctx, domain.Taxpayer{ID: uuid.NewString(), TenantID: tenant, TaxIDType: domain.TaxIDPasaporte,
			TaxID: uuid.NewString()[:12], LegalName: name, CreatedAt: now, UpdatedAt: now}); err != nil {
			t.Fatal(err)
		}
	}
	page1, next, err := s.SearchTaxpayers(ctx, tenant, "distri", 2, "")
	if err != nil || len(page1) != 2 || next == "" {
		t.Fatalf("página 1: %v %d %q", err, len(page1), next)
	}
	page2, next2, err := s.SearchTaxpayers(ctx, tenant, "distri", 2, next)
	if err != nil || len(page2) != 1 || next2 != "" {
		t.Fatalf("página 2: %v %d %q", err, len(page2), next2)
	}
	if _, _, err := s.SearchTaxpayers(ctx, tenant, "%", 10, ""); err != nil {
		t.Fatalf("un comodín en la búsqueda se escapa: %v", err)
	}
}

// Perfil: la segunda configuración sube la versión y no duplica la fila de folios.
func TestL2_ProfileUpsertVersion(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	p, err := s.GetProfile(context.Background(), tenant)
	if err != nil || p.Version != 1 {
		t.Fatalf("versión 1: %v %+v", err, p)
	}
	p.CheckoutPreference = domain.PrefAutoThreshold
	threshold := int64(5000)
	p.AutoThresholdMinor = &threshold
	p.IdempotencyKey = "perfil-l2-000002"
	p2, err := s.UpsertProfile(context.Background(), p)
	if err != nil || p2.Version != 2 || p2.AutoThresholdMinor == nil || *p2.AutoThresholdMinor != 5000 {
		t.Fatalf("versión 2: %v %+v", err, p2)
	}
}
