//go:build l2

// Pruebas L2 de inventory contra PostgreSQL real y efímero (inventory/test/test_l2.sh).
package store_test

import (
	"context"
	"errors"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"plentypay/inventory/internal/client"
	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/service"
	"plentypay/inventory/internal/store"
)

// products simula la respuesta de catalog (catalog no corre en esta prueba de store).
type products struct{ archived, untracked map[string]bool }

func (p products) Product(_ context.Context, id string) (client.Product, error) {
	return client.Product{ID: id, Active: !p.archived[id], TracksInventory: !p.untracked[id]}, nil
}

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

func svcWith(t *testing.T, p products) *service.Inventory {
	return service.New(open(t), p, func() time.Time { return time.Now().UTC() }, service.NewUUIDv7)
}

func svc(t *testing.T) *service.Inventory { return svcWith(t, products{}) }

func id() string { return uuid.Must(uuid.NewV7()).String() }

func key() string { return "k-" + id() }

func person(tenant string) service.Caller {
	return service.Caller{TenantID: tenant, UserID: id(), Service: "api-gateway"}
}

func pos(tenant string) service.Caller { return service.Caller{TenantID: tenant, Service: "pos"} }

func receive(t *testing.T, s *service.Inventory, tenant, product string, milli int64) {
	t.Helper()
	if _, err := s.AdjustStock(context.Background(), person(tenant), service.AdjustRequest{IdempotencyKey: key(),
		ProductID: product, DeltaMilli: milli, Type: domain.Receipt}); err != nil {
		t.Fatal(err)
	}
}

func onHand(t *testing.T, s *service.Inventory, tenant, product string) int64 {
	t.Helper()
	l, err := s.GetStock(context.Background(), tenant, product, "")
	if err != nil {
		t.Fatal(err)
	}
	return l.OnHandMilli
}

func count(t *testing.T, tenant, sql string, args ...any) int {
	t.Helper()
	var n int
	err := pgx.BeginTxFunc(context.Background(), open(t).Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.tenant_id', $1, true)`, tenant); err != nil {
			return err
		}
		return tx.QueryRow(context.Background(), sql, args...).Scan(&n)
	})
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func TestR1_OnHandEqualsSumOfMovements(t *testing.T) {
	ctx, s, tenant, product := context.Background(), svc(t), id(), id()
	receive(t, s, tenant, product, 12000)
	if _, err := s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		DeltaMilli: -2500, Type: domain.Adjustment, Reason: "conteo físico"}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AdjustStock(ctx, pos(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		DeltaMilli: -1500, Type: domain.Sale, ReferenceType: "sale", ReferenceID: id()}); err != nil {
		t.Fatal(err)
	}
	w, err := s.DefaultWarehouse(ctx, tenant)
	if err != nil {
		t.Fatal(err)
	}
	sum, err := open(t).SumOfMovements(ctx, tenant, w.ID, product)
	if err != nil {
		t.Fatal(err)
	}
	if got := onHand(t, s, tenant, product); got != 8000 || sum != got {
		t.Fatalf("on_hand=%d Σmovimientos=%d, se esperaba 8000", got, sum)
	}
}

func TestIdempotency_SameKeyMovesStockOnce(t *testing.T) {
	ctx, s, tenant, product, k := context.Background(), svc(t), id(), id(), key()
	req := service.AdjustRequest{IdempotencyKey: k, ProductID: product, DeltaMilli: 5000, Type: domain.Receipt}
	m1, err := s.AdjustStock(ctx, person(tenant), req)
	if err != nil {
		t.Fatal(err)
	}
	m2, err := s.AdjustStock(ctx, person(tenant), req)
	if err != nil {
		t.Fatal(err)
	}
	if m1.ID != m2.ID || onHand(t, s, tenant, product) != 5000 {
		t.Fatalf("el reintento movió stock dos veces: %s %s %d", m1.ID, m2.ID, onHand(t, s, tenant, product))
	}
	req.DeltaMilli = 6000
	if _, err := s.AdjustStock(ctx, person(tenant), req); !errors.Is(err, domain.ErrKeyReused) {
		t.Fatalf("misma clave, otro contenido: %v", err)
	}
}

func TestIdempotency_ConcurrentRetriesProduceOneMovement(t *testing.T) {
	ctx, s, tenant, product, k := context.Background(), svc(t), id(), id(), key()
	var wg sync.WaitGroup
	ids := make(chan string, 10)
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			m, err := s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: k, ProductID: product,
				DeltaMilli: 1000, Type: domain.Receipt})
			if err == nil {
				ids <- m.ID
			}
		}()
	}
	wg.Wait()
	close(ids)
	seen := map[string]bool{}
	for v := range ids {
		seen[v] = true
	}
	if len(seen) != 1 || onHand(t, s, tenant, product) != 1000 {
		t.Fatalf("%d movimientos distintos, on_hand=%d", len(seen), onHand(t, s, tenant, product))
	}
}

func TestR2_OutflowCannotLeaveAvailableNegativeExceptSales(t *testing.T) {
	ctx, s, tenant, product := context.Background(), svc(t), id(), id()
	receive(t, s, tenant, product, 2000)
	_, err := s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		DeltaMilli: -3000, Type: domain.WriteOff, Reason: "dañado"})
	if !errors.Is(err, domain.ErrOutOfStock) {
		t.Fatalf("merma mayor que la existencia: %v", err)
	}
	if n := count(t, tenant, `SELECT count(*) FROM movements WHERE product_id = $1`, product); n != 1 {
		t.Fatalf("el rechazo dejó %d movimientos (solo debía quedar la recepción)", n)
	}
	if _, err := s.AdjustStock(ctx, pos(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		DeltaMilli: -3000, Type: domain.Sale, ReferenceType: "sale", ReferenceID: id()}); err != nil {
		t.Fatalf("la venta física se registra: %v", err)
	}
	if got := onHand(t, s, tenant, product); got != -1000 {
		t.Fatalf("on_hand=%d", got)
	}
	if n := count(t, tenant, `SELECT count(*) FROM outbox WHERE aggregate_id = $1 AND subject = 'pp.inventory.stock.low.v1'`, product); n != 1 {
		t.Fatalf("stock negativo debe avisar StockLow una vez: %d", n)
	}
}

func TestSPEC4_PeopleCannotRecordSales(t *testing.T) {
	_, err := svc(t).AdjustStock(context.Background(), person(id()), service.AdjustRequest{IdempotencyKey: key(),
		ProductID: id(), DeltaMilli: -1000, Type: domain.Sale})
	if !errors.Is(err, domain.ErrServiceOnly) {
		t.Fatalf("una persona registró una venta a mano: %v", err)
	}
}

func TestR3_ConcurrentOutflowsNeverOversell(t *testing.T) {
	ctx, s, tenant, product := context.Background(), svc(t), id(), id()
	receive(t, s, tenant, product, 30000)
	var ok, out atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
				DeltaMilli: -1000, Type: domain.WriteOff, Reason: "prueba de concurrencia"})
			switch {
			case err == nil:
				ok.Add(1)
			case errors.Is(err, domain.ErrOutOfStock):
				out.Add(1)
			default:
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if ok.Load() != 30 || out.Load() != 20 || onHand(t, s, tenant, product) != 0 {
		t.Fatalf("ok=%d sin_stock=%d on_hand=%d (se esperaba 30/20/0)", ok.Load(), out.Load(), onHand(t, s, tenant, product))
	}
}

func TestSPEC4_TransferIsAtomic(t *testing.T) {
	ctx, s, tenant, product := context.Background(), svc(t), id(), id()
	a, err := s.DefaultWarehouse(ctx, tenant)
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.UpsertWarehouse(ctx, tenant, domain.Warehouse{Name: "Sucursal Colón"})
	if err != nil {
		t.Fatal(err)
	}
	receive(t, s, tenant, product, 4000)
	if _, _, err := s.TransferStock(ctx, person(tenant), key(), product, a.ID, b.ID, 9000, ""); !errors.Is(err, domain.ErrOutOfStock) {
		t.Fatalf("transferir más de lo que hay: %v", err)
	}
	out, in, err := s.TransferStock(ctx, person(tenant), key(), product, a.ID, b.ID, 1500, "reposición")
	if err != nil {
		t.Fatal(err)
	}
	la, _ := s.GetStock(ctx, tenant, product, a.ID)
	lb, _ := s.GetStock(ctx, tenant, product, b.ID)
	if la.OnHandMilli != 2500 || lb.OnHandMilli != 1500 || out.ReferenceID != in.ID {
		t.Fatalf("A=%d B=%d", la.OnHandMilli, lb.OnHandMilli)
	}
	if _, _, err := s.TransferStock(ctx, person(tenant), key(), product, a.ID, a.ID, 1, ""); !errors.Is(err, domain.ErrSameWarehouse) {
		t.Fatal(err)
	}
}

func TestRLS_TenantsAreIsolated(t *testing.T) {
	ctx, s, ta, tb, product := context.Background(), svc(t), id(), id(), id()
	receive(t, s, ta, product, 1000)
	wa, err := s.DefaultWarehouse(ctx, ta)
	if err != nil {
		t.Fatal(err)
	}
	if got := onHand(t, s, tb, product); got != 0 {
		t.Fatalf("B ve la existencia de A: %d", got)
	}
	// B no puede mover stock en la bodega de A.
	_, err = s.AdjustStock(ctx, person(tb), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		WarehouseID: wa.ID, DeltaMilli: 1000, Type: domain.Receipt})
	if !errors.Is(err, domain.ErrInvalidWarehouse) {
		t.Fatalf("B movió stock en la bodega de A: %v", err)
	}
	ms, _, err := s.ListMovements(ctx, tb, product, "", time.Time{}, time.Time{}, nil, 50)
	if err != nil || len(ms) != 0 {
		t.Fatalf("B ve %d movimientos de A", len(ms))
	}
}

func TestR1_MovementsAreImmutable(t *testing.T) {
	ctx, s, tenant, product := context.Background(), svc(t), id(), id()
	receive(t, s, tenant, product, 1000)
	err := pgx.BeginTxFunc(ctx, open(t).Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenant); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `UPDATE movements SET delta_milli = 999999 WHERE product_id = $1`, product)
		return err
	})
	if err == nil {
		t.Fatal("se pudo editar un movimiento: se corrige con uno nuevo")
	}
}

func TestDefaultWarehouseIsCreatedOnce(t *testing.T) {
	ctx, s, tenant := context.Background(), svc(t), id()
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := s.ListWarehouses(ctx, tenant); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	ws, err := s.ListWarehouses(ctx, tenant)
	if err != nil || len(ws) != 1 || !ws[0].IsDefault || ws[0].Name != store.DefaultWarehouseName {
		t.Fatalf("%v %+v", err, ws)
	}
}

func TestCatalogRules_ArchivedAndUntrackedProducts(t *testing.T) {
	ctx, tenant := context.Background(), id()
	arch, untracked := id(), id()
	s := svcWith(t, products{archived: map[string]bool{arch: true}, untracked: map[string]bool{untracked: true}})
	if _, err := s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: arch,
		DeltaMilli: 1000, Type: domain.Receipt}); !errors.Is(err, domain.ErrProductNotFound) {
		t.Fatalf("recibir producto archivado: %v", err)
	}
	if _, err := s.AdjustStock(ctx, pos(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: arch,
		DeltaMilli: 1000, Type: domain.Return, ReferenceType: "sale", ReferenceID: id()}); err != nil {
		t.Fatalf("una devolución de un producto archivado se acepta: %v", err)
	}
	if _, err := s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: untracked,
		DeltaMilli: 1000, Type: domain.Receipt}); !errors.Is(err, domain.ErrNotTracked) {
		t.Fatalf("producto sin inventario: %v", err)
	}
}

func TestOutbox_EveryMovementEmitsStockChanged(t *testing.T) {
	s, tenant, product := svc(t), id(), id()
	for i := 0; i < 3; i++ {
		receive(t, s, tenant, product, 1000)
	}
	if n := count(t, tenant, `SELECT count(*) FROM outbox WHERE aggregate_id = $1 AND subject = 'pp.inventory.stock.changed.v1'`, product); n != 3 {
		t.Fatalf("%d StockChanged, se esperaban 3", n)
	}
}

func orders(tenant string) service.Caller { return service.Caller{TenantID: tenant, Service: "orders"} }

func reserve(s *service.Inventory, tenant, product string, qty int64, ttl int32) (domain.Reservation, error) {
	return s.ReserveStock(context.Background(), orders(tenant), service.ReserveRequest{IdempotencyKey: key(),
		Lines: []domain.ReservationLine{{ProductID: product, QtyMilli: qty}}, ReferenceType: "order", ReferenceID: id(), TTLSeconds: ttl})
}

func TestSPEC11_100ConcurrentReservationsOver50Units(t *testing.T) {
	s, tenant, product := svc(t), id(), id()
	receive(t, s, tenant, product, 50000)
	var ok, out atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := reserve(s, tenant, product, 1000, 900)
			switch {
			case err == nil:
				ok.Add(1)
			case errors.Is(err, domain.ErrOutOfStock):
				out.Add(1)
			default:
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	l, err := s.GetStock(context.Background(), tenant, product, "")
	if err != nil || ok.Load() != 50 || out.Load() != 50 || l.ReservedMilli != 50000 || l.Available() != 0 {
		t.Fatalf("ok=%d sin_stock=%d reservado=%d disponible=%d (%v)", ok.Load(), out.Load(), l.ReservedMilli, l.Available(), err)
	}
}

func TestR4_ReservationIsAllOrNothing(t *testing.T) {
	ctx, s, tenant, a, b := context.Background(), svc(t), id(), id(), id()
	receive(t, s, tenant, a, 5000)
	receive(t, s, tenant, b, 1000)
	_, err := s.ReserveStock(ctx, orders(tenant), service.ReserveRequest{IdempotencyKey: key(), ReferenceType: "order", ReferenceID: id(),
		Lines: []domain.ReservationLine{{ProductID: a, QtyMilli: 2000}, {ProductID: b, QtyMilli: 3000}}})
	if !errors.Is(err, domain.ErrOutOfStock) {
		t.Fatalf("una línea sin stock: %v", err)
	}
	la, _ := s.GetStock(ctx, tenant, a, "")
	if la.ReservedMilli != 0 {
		t.Fatalf("la otra línea quedó reservada: %d", la.ReservedMilli)
	}
}

func TestReservation_CommitIsASaleAndReleaseReturns(t *testing.T) {
	ctx, s, tenant, product := context.Background(), svc(t), id(), id()
	receive(t, s, tenant, product, 10000)
	r1, err := reserve(s, tenant, product, 3000, 900)
	if err != nil {
		t.Fatal(err)
	}
	r2, err := reserve(s, tenant, product, 2000, 900)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ { // confirmar dos veces no vende dos veces
		if _, err := s.CommitReservation(ctx, orders(tenant), r1.ID); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.ReleaseReservation(ctx, orders(tenant), r2.ID); err != nil {
		t.Fatal(err)
	}
	l, _ := s.GetStock(ctx, tenant, product, "")
	if l.OnHandMilli != 7000 || l.ReservedMilli != 0 {
		t.Fatalf("on_hand=%d reservado=%d (se esperaba 7000/0)", l.OnHandMilli, l.ReservedMilli)
	}
	if _, err := s.ReleaseReservation(ctx, orders(tenant), r1.ID); !errors.Is(err, domain.ErrInvalidTransition) {
		t.Fatalf("liberar una reserva vendida: %v", err)
	}
	if n := count(t, tenant, `SELECT count(*) FROM movements WHERE product_id = $1 AND type = 2`, product); n != 1 {
		t.Fatalf("movimientos de venta: %d", n)
	}
}

func TestR4_ExpiredReservationsReturnStockAndCannotBeCommitted(t *testing.T) {
	ctx, s, tenant, product := context.Background(), svc(t), id(), id()
	receive(t, s, tenant, product, 4000)
	r, err := reserve(s, tenant, product, 4000, 1)
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(1100 * time.Millisecond)
	if _, err := s.CommitReservation(ctx, orders(tenant), r.ID); !errors.Is(err, domain.ErrInvalidTransition) {
		t.Fatalf("confirmar vencida: %v", err)
	}
	if n, err := s.ExpireReservations(ctx, 1000); err != nil || n < 1 {
		t.Fatalf("job de vencimiento: %d %v", n, err)
	}
	l, _ := s.GetStock(ctx, tenant, product, "")
	if l.ReservedMilli != 0 || l.Available() != 4000 {
		t.Fatalf("la reserva vencida no devolvió el stock: %+v", l)
	}
}

func TestReservation_IdempotentAndServiceOnly(t *testing.T) {
	ctx, s, tenant, product := context.Background(), svc(t), id(), id()
	receive(t, s, tenant, product, 4000)
	req := service.ReserveRequest{IdempotencyKey: key(), ReferenceType: "order", ReferenceID: id(),
		Lines: []domain.ReservationLine{{ProductID: product, QtyMilli: 1000}}}
	r1, err := s.ReserveStock(ctx, orders(tenant), req)
	if err != nil {
		t.Fatal(err)
	}
	r2, err := s.ReserveStock(ctx, orders(tenant), req)
	if err != nil || r2.ID != r1.ID {
		t.Fatalf("reintento creó otra reserva: %v", err)
	}
	if _, err := s.ReserveStock(ctx, person(tenant), req); !errors.Is(err, domain.ErrServiceOnly) {
		t.Fatalf("una persona reservó: %v", err)
	}
}
