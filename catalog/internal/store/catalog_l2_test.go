//go:build l2

// Pruebas L2 de catalog contra PostgreSQL real y efímero (catalog/test/test_l2.sh crea la base y la
// borra al terminar; nunca la base `plentypay`).
package store_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"plentypay/catalog/internal/client"
	"plentypay/catalog/internal/domain"
	"plentypay/catalog/internal/service"
	"plentypay/catalog/internal/store"
)

type fixedRates struct{}

func (fixedRates) TaxRates(context.Context, string) (domain.TaxRates, error) {
	return domain.TaxRates{0: true, 700: true, 1000: true, 1500: true}, nil
}

func (fixedRates) NamedTaxRates(context.Context, string) ([]client.NamedRate, error) {
	return []client.NamedRate{{Kind: "STANDARD", RateBps: 700}}, nil
}

var (
	once sync.Once
	st   *store.Store
)

func open(t *testing.T) *store.Store {
	t.Helper()
	once.Do(func() {
		dsn := os.Getenv("PP_TEST_DB_DSN")
		if dsn == "" {
			return
		}
		s, err := store.Open(context.Background(), dsn)
		if err != nil {
			panic(err)
		}
		st = s
	})
	if st == nil {
		t.Skip("PP_TEST_DB_DSN no definido")
	}
	return st
}

func newSvc(t *testing.T) *service.Catalog {
	return service.New(open(t), fixedRates{}, func() time.Time { return time.Now().UTC() }, service.NewUUIDv7)
}

func tenant() string { return uuid.Must(uuid.NewV7()).String() }

func coffee(sku, barcode string) domain.Product {
	return domain.Product{SKU: sku, Barcode: barcode, Name: "Café " + sku, PriceMinor: 1850, TaxRateBps: 700, TracksInventory: true}
}

func outboxCount(t *testing.T, tenantID, aggregateID string) int {
	t.Helper()
	var n int
	err := pgx.BeginTxFunc(context.Background(), open(t).Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
			return err
		}
		return tx.QueryRow(context.Background(), `SELECT count(*) FROM outbox WHERE aggregate_id = $1`, aggregateID).Scan(&n)
	})
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func TestR1_SKUAndBarcodeUniquePerTenant(t *testing.T) {
	ctx, svc, a, b := context.Background(), newSvc(t), tenant(), tenant()
	if _, err := svc.CreateProduct(ctx, a, "", "", coffee("SKU-1", "4006381333931"), true); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateProduct(ctx, a, "", "", coffee("SKU-1", ""), true); !errors.Is(err, domain.ErrSKUTaken) {
		t.Fatalf("sku repetido: %v", err)
	}
	if _, err := svc.CreateProduct(ctx, a, "", "", coffee("SKU-2", "4006381333931"), true); !errors.Is(err, domain.ErrBarcodeTaken) {
		t.Fatalf("barcode repetido: %v", err)
	}
	// Otro comercio puede usar el mismo sku y código de barras.
	if _, err := svc.CreateProduct(ctx, b, "", "", coffee("SKU-1", "4006381333931"), true); err != nil {
		t.Fatalf("otro tenant: %v", err)
	}
}

func TestAtomicity_ProductAndOutboxCommitTogether(t *testing.T) {
	ctx, svc, a := context.Background(), newSvc(t), tenant()
	p, err := svc.CreateProduct(ctx, a, "", "", coffee("ATOM-1", ""), true)
	if err != nil {
		t.Fatal(err)
	}
	if n := outboxCount(t, a, p.ID); n != 1 {
		t.Fatalf("alta: %d eventos, se esperaba 1", n)
	}
	// Un alta que falla (sku repetido) no deja evento huérfano.
	dup, err := svc.CreateProduct(ctx, a, "", "", coffee("ATOM-1", ""), true)
	if err == nil {
		t.Fatal("sku repetido aceptado")
	}
	if n := outboxCount(t, a, dup.ID); n != 0 {
		t.Fatalf("alta fallida dejó %d eventos", n)
	}
	if _, err := svc.UpdateProduct(ctx, a, "", domain.Product{ID: p.ID, PriceMinor: 1999, Currency: "USD"}, []string{"price"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ArchiveProduct(ctx, a, p.ID); err != nil {
		t.Fatal(err)
	}
	if n := outboxCount(t, a, p.ID); n != 3 {
		t.Fatalf("alta+cambio+archivo: %d eventos, se esperaban 3", n)
	}
}

func TestRLS_TenantCannotSeeOthersProducts(t *testing.T) {
	ctx, svc, a, b := context.Background(), newSvc(t), tenant(), tenant()
	p, err := svc.CreateProduct(ctx, a, "", "", coffee("RLS-1", "96385074"), true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.GetProduct(ctx, b, p.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("tenant B leyó el producto de A: %v", err)
	}
	if _, err := svc.LookupByBarcode(ctx, b, "96385074"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("tenant B encontró el código de barras de A: %v", err)
	}
	if _, err := svc.ArchiveProduct(ctx, b, p.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("tenant B archivó el producto de A: %v", err)
	}
	items, _, err := svc.ListProducts(ctx, b, store.ListFilter{PageSize: 50})
	if err != nil || len(items) != 0 {
		t.Fatalf("tenant B lista %d productos (%v)", len(items), err)
	}
}

func TestOptimisticLock_StaleVersionIsRejected(t *testing.T) {
	ctx, svc, a := context.Background(), newSvc(t), tenant()
	p, err := svc.CreateProduct(ctx, a, "", "", coffee("VER-1", ""), true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.UpdateProduct(ctx, a, "", domain.Product{ID: p.ID, Name: "Café nuevo", Version: p.Version}, []string{"name"}); err != nil {
		t.Fatal(err)
	}
	_, err = svc.UpdateProduct(ctx, a, "", domain.Product{ID: p.ID, Name: "Pisado", Version: p.Version}, []string{"name"})
	if !errors.Is(err, domain.ErrVersionConflict) {
		t.Fatalf("versión vieja aceptada: %v", err)
	}
}

func TestR3_ArchivedProductCannotBeEditedOrSoldByBarcode(t *testing.T) {
	ctx, svc, a := context.Background(), newSvc(t), tenant()
	p, err := svc.CreateProduct(ctx, a, "", "", coffee("ARC-1", "036000291452"), true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ArchiveProduct(ctx, a, p.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.UpdateProduct(ctx, a, "", domain.Product{ID: p.ID, Name: "x"}, []string{"name"}); !errors.Is(err, domain.ErrInvalidTransition) {
		t.Fatalf("editar archivado: %v", err)
	}
	if _, err := svc.LookupByBarcode(ctx, a, "036000291452"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("la caja encontró un producto archivado: %v", err)
	}
}

func TestListProducts_KeysetPagesAndSearch(t *testing.T) {
	ctx, svc, a := context.Background(), newSvc(t), tenant()
	for i := 0; i < 7; i++ {
		p := coffee(fmt.Sprintf("PG-%d", i), "")
		p.Name = fmt.Sprintf("Producto %02d", i)
		if i == 3 {
			p.Name = "Arroz Doña Blanca 5 lb"
		}
		if _, err := svc.CreateProduct(ctx, a, "", "", p, true); err != nil {
			t.Fatal(err)
		}
	}
	seen := map[string]bool{}
	after := store.Cursor{}
	pages := 0
	for {
		items, next, err := svc.ListProducts(ctx, a, store.ListFilter{PageSize: 3, After: after})
		if err != nil {
			t.Fatal(err)
		}
		pages++
		for _, p := range items {
			if seen[p.ID] {
				t.Fatalf("producto repetido entre páginas: %s", p.Name)
			}
			seen[p.ID] = true
		}
		if next == nil {
			break
		}
		after = *next
	}
	if len(seen) != 7 || pages != 3 {
		t.Fatalf("paginación: %d productos en %d páginas", len(seen), pages)
	}
	found, _, err := svc.ListProducts(ctx, a, store.ListFilter{Query: "arroz", PageSize: 10})
	if err != nil || len(found) != 1 || found[0].SKU != "PG-3" {
		t.Fatalf("búsqueda «arroz»: %v %v", found, err)
	}
}

func TestCategories_TreeDepthAndTenantScope(t *testing.T) {
	ctx, svc, a, b := context.Background(), newSvc(t), tenant(), tenant()
	parent := ""
	var leaf domain.Category
	for i := 1; i <= 4; i++ {
		c, err := svc.UpsertCategory(ctx, a, domain.Category{Name: fmt.Sprintf("Nivel %d", i), ParentID: parent})
		if err != nil {
			t.Fatalf("nivel %d: %v", i, err)
		}
		parent, leaf = c.ID, c
	}
	if leaf.Depth != 4 {
		t.Fatalf("profundidad %d", leaf.Depth)
	}
	if _, err := svc.UpsertCategory(ctx, a, domain.Category{Name: "Nivel 5", ParentID: parent}); !errors.Is(err, domain.ErrCategoryDepth) {
		t.Fatalf("nivel 5: %v", err)
	}
	if _, err := svc.UpsertCategory(ctx, a, domain.Category{Name: "nivel 1"}); !errors.Is(err, domain.ErrCategoryTaken) {
		t.Fatalf("nombre repetido sin distinguir mayúsculas: %v", err)
	}
	// Un producto de B no puede apuntar a una categoría de A (la FK no ve la RLS).
	p := coffee("CAT-1", "")
	p.CategoryID = leaf.ID
	if _, err := svc.CreateProduct(ctx, b, "", "", p, true); !errors.Is(err, domain.ErrInvalidCategory) {
		t.Fatalf("categoría ajena aceptada: %v", err)
	}
	cats, err := svc.ListCategories(ctx, b)
	if err != nil || len(cats) != 0 {
		t.Fatalf("B ve %d categorías de A", len(cats))
	}
}

func TestOutbox_RelayReadsInOrderAndMarksPublished(t *testing.T) {
	ctx, svc, a := context.Background(), newSvc(t), tenant()
	p, err := svc.CreateProduct(ctx, a, "", "", coffee("OUT-1", ""), true)
	if err != nil {
		t.Fatal(err)
	}
	pending, err := open(t).OutboxPending(ctx, 10000)
	if err != nil {
		t.Fatal(err)
	}
	var mine *store.OutboxEvent
	for i := range pending {
		if pending[i].AggregateID == p.ID {
			mine = &pending[i]
		}
	}
	if mine == nil || mine.Subject != "pp.catalog.product.changed.v1" || len(mine.Payload) == 0 {
		t.Fatalf("evento pendiente no encontrado: %+v", mine)
	}
	if err := open(t).OutboxMarkPublished(ctx, mine.ID, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	pending, err = open(t).OutboxPending(ctx, 10000)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range pending {
		if e.ID == mine.ID {
			t.Fatal("el evento publicado sigue pendiente")
		}
	}
}

func TestPrivileges_ServiceRoleCannotDelete(t *testing.T) {
	ctx := context.Background()
	err := pgx.BeginTxFunc(ctx, open(t).Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `DELETE FROM products`)
		return err
	})
	if err == nil {
		t.Fatal("catalog_svc pudo borrar productos: nada se borra, se archiva")
	}
}
