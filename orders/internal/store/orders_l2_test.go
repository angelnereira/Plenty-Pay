//go:build l2

// Pruebas L2 de orders contra PostgreSQL real y efímero (orders/test/test_l2.sh). catalog,
// inventory y payments-core se sustituyen por dobles en memoria que registran cada llamada: aquí
// se prueba la saga, su atomicidad en la base y sus compensaciones.
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

	"plentypay/orders/internal/client"
	"plentypay/orders/internal/domain"
	"plentypay/orders/internal/service"
	"plentypay/orders/internal/store"
)

type fakeDeps struct {
	mu        sync.Mutex
	listings  map[string]client.Listing
	noStock   map[string]bool // comercio sin existencias al reservar
	reserved  map[string]string
	committed map[string]bool
	released  map[string]bool
	returned  map[string]int64
	refunded  map[string]bool
	refundErr error
	intents   map[string]client.Intent
	intentReq map[string][]client.Split
}

func newDeps() *fakeDeps {
	return &fakeDeps{listings: map[string]client.Listing{}, noStock: map[string]bool{}, reserved: map[string]string{},
		committed: map[string]bool{}, released: map[string]bool{}, returned: map[string]int64{}, refunded: map[string]bool{},
		intents: map[string]client.Intent{}, intentReq: map[string][]client.Split{}}
}

func (f *fakeDeps) MarketplaceProduct(_ context.Context, _, _, id string) (client.Listing, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	l, ok := f.listings[id]
	if !ok {
		return l, client.ErrNotFound
	}
	return l, nil
}

func (f *fakeDeps) Reserve(_ context.Context, tenant, _, key, _ string, _ []client.ReserveLine, _ int32) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.noStock[tenant] {
		return "", &client.Rejected{Dep: "inventory", Reason: "OUT_OF_STOCK"}
	}
	if r, ok := f.reserved[key]; ok {
		return r, nil
	}
	r := uuid.Must(uuid.NewV7()).String()
	f.reserved[key] = r
	return r, nil
}

func (f *fakeDeps) Commit(_ context.Context, _, res string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.committed[res] = true
	return nil
}

func (f *fakeDeps) Release(_ context.Context, _, res string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.released[res] = true
	return nil
}

func (f *fakeDeps) Return(_ context.Context, _, key, _, _ string, qty int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.returned[key] = qty
	return nil
}

func (f *fakeDeps) CreateIntent(_ context.Context, _, _, _, key, _, _ string, _ int64, _ int32, splits []client.Split, _ int32) (client.Intent, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if i, ok := f.intents[key]; ok {
		return i, nil
	}
	i := client.Intent{ID: uuid.Must(uuid.NewV7()).String(), Status: "PAYMENT_STATUS_CREATED"}
	f.intents[key] = i
	f.intentReq[key] = splits
	return i, nil
}

func (f *fakeDeps) GetIntent(_ context.Context, id string) (client.Intent, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, i := range f.intents {
		if i.ID == id {
			return i, nil
		}
	}
	return client.Intent{}, client.ErrNotFound
}

func (f *fakeDeps) Refund(_ context.Context, key, _, _, _ string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.refundErr != nil {
		return f.refundErr
	}
	f.refunded[key] = true
	return nil
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

func id() string { return uuid.Must(uuid.NewV7()).String() }

type world struct {
	svc        *service.Orders
	deps       *fakeDeps
	clock      *time.Time
	buyer      service.Buyer
	a, b       string // comercios
	a1, a2, b1 string // productos
}

func newWorld(t *testing.T) *world {
	now := time.Now().UTC()
	w := &world{deps: newDeps(), clock: &now, buyer: service.Buyer{UserID: id()}, a: id(), b: id(), a1: id(), a2: id(), b1: id()}
	for pid, l := range map[string]client.Listing{
		w.a1: {TenantID: w.a, MerchantName: "Café A", Name: "Café 250 g", PriceMinor: 1850, TaxRateBps: 700, TracksInventory: true},
		w.a2: {TenantID: w.a, MerchantName: "Café A", Name: "Taza", PriceMinor: 1000, TaxRateBps: 700, TracksInventory: true},
		w.b1: {TenantID: w.b, MerchantName: "Panadería B", Name: "Pan", PriceMinor: 300, TaxRateBps: 0, TracksInventory: true},
	} {
		l.ProductID, l.Currency, l.InStock, l.Pickup = pid, "USD", true, true
		w.deps.listings[pid] = l
	}
	w.svc = service.New(open(t), w.deps, func() time.Time { return *w.clock }, service.NewUUIDv7, 15*time.Minute)
	return w
}

func (w *world) cart(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	for _, p := range []struct {
		id  string
		qty int64
	}{{w.a1, 2000}, {w.a2, 1000}, {w.b1, 1000}} {
		if _, err := w.svc.SetCartItem(ctx, w.buyer, p.id, p.qty); err != nil {
			t.Fatal(err)
		}
	}
}

func (w *world) checkout(t *testing.T, key string) domain.Order {
	t.Helper()
	ctx := context.Background()
	q, err := w.svc.QuoteCheckout(ctx, w.buyer, 2)
	if err != nil {
		t.Fatal(err)
	}
	o, err := w.svc.Checkout(ctx, w.buyer, service.CheckoutRequest{IdempotencyKey: key, QuoteID: q.ID, Fulfillment: 2})
	if err != nil {
		t.Fatal(err)
	}
	return o
}

func count(t *testing.T, sql string, args ...any) int {
	t.Helper()
	var n int
	err := pgx.BeginTxFunc(context.Background(), open(t).Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.actor_role', 'SYSTEM', true)`); err != nil {
			return err
		}
		return tx.QueryRow(context.Background(), sql, args...).Scan(&n)
	})
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func runTasks(t *testing.T, w *world) service.TaskOutcome {
	t.Helper()
	out, err := w.svc.RunTasks(context.Background(), 500, func(store.Task, error) {})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func subOf(o domain.Order, tenant string) domain.SubOrder {
	for _, s := range o.Subs {
		if s.TenantID == tenant {
			return s
		}
	}
	return domain.SubOrder{}
}

func TestSPEC11_1_TwoMerchantsOnePaymentWithSplits(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	w.cart(t)
	o := w.checkout(t, "k-"+id())
	if o.Status != domain.OrderPendingPayment || len(o.Subs) != 2 || o.PaymentIntentID == "" {
		t.Fatalf("%+v", o)
	}
	// A: 2 × 18.50 + 10.00 = 47.00 · B: 3.00 → un cobro de 50.00 con dos splits.
	splits := w.deps.intentReq["order:"+o.ID]
	got := map[string]int64{}
	for _, s := range splits {
		got[s.TenantID] = s.AmountMinor
	}
	if o.TotalMinor != 5000 || got[w.a] != 4700 || got[w.b] != 300 {
		t.Fatalf("total %d splits %v", o.TotalMinor, got)
	}
	if err := w.svc.PaymentCaptured(ctx, id(), o.ID, id()); err != nil {
		t.Fatal(err)
	}
	paid, err := w.svc.GetOrder(ctx, store.Who{UserID: w.buyer.UserID}, o.ID)
	if err != nil {
		t.Fatal(err)
	}
	if paid.Status != domain.OrderPaid || subOf(paid, w.a).Status != domain.SubAwaitingAcceptance || subOf(paid, w.b).AcceptDeadline.IsZero() {
		t.Fatalf("%+v", paid)
	}
	// Atomicidad: con el pago nacen OrderPaid, un SubOrderStatusChanged por comercio y las
	// confirmaciones de reserva.
	if n := count(t, `SELECT count(*) FROM outbox WHERE aggregate_id = $1 AND subject = 'pp.orders.order.paid.v1'`, o.ID); n != 1 {
		t.Fatalf("OrderPaid: %d", n)
	}
	if n := count(t, `SELECT count(*) FROM saga_tasks WHERE order_id = $1 AND kind = 'COMMIT'`, o.ID); n != 2 {
		t.Fatalf("tareas COMMIT: %d", n)
	}
	runTasks(t, w)
	if len(w.deps.committed) != 2 {
		t.Fatalf("reservas confirmadas: %d", len(w.deps.committed))
	}
}

func TestSPEC11_4_SameKeyIsOneOrder(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	w.cart(t)
	key := "k-" + id()
	o1 := w.checkout(t, key)
	q, err := w.svc.QuoteCheckout(ctx, w.buyer, 2)
	if err != nil {
		t.Fatal(err)
	}
	o2, err := w.svc.Checkout(ctx, w.buyer, service.CheckoutRequest{IdempotencyKey: key, QuoteID: q.ID, Fulfillment: 2})
	if err != nil || o2.ID != o1.ID {
		t.Fatalf("otra orden con la misma clave: %v", err)
	}
	if n := count(t, `SELECT count(*) FROM orders WHERE user_id = $1`, w.buyer.UserID); n != 1 {
		t.Fatalf("pedidos: %d", n)
	}
	if len(w.deps.intents) != 1 {
		t.Fatalf("cobros: %d", len(w.deps.intents))
	}
}

func TestSPEC11_3_FailedPaymentReleasesReservations(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	w.cart(t)
	o := w.checkout(t, "k-"+id())
	ev := id()
	for i := 0; i < 2; i++ { // el mismo evento dos veces
		if err := w.svc.PaymentFailed(ctx, ev, o.ID); err != nil {
			t.Fatal(err)
		}
	}
	got, err := w.svc.GetOrder(ctx, store.Who{UserID: w.buyer.UserID}, o.ID)
	if err != nil || got.Status != domain.OrderCancelled {
		t.Fatalf("%v %v", got.Status, err)
	}
	runTasks(t, w)
	if len(w.deps.released) != 2 {
		t.Fatalf("reservas liberadas: %d", len(w.deps.released))
	}
}

func TestSPEC11_2_TimeoutRejectsAndRefundsOnlyThatSplit(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	w.cart(t)
	o := w.checkout(t, "k-"+id())
	if err := w.svc.PaymentCaptured(ctx, id(), o.ID, id()); err != nil {
		t.Fatal(err)
	}
	ma := service.Merchant{TenantID: w.a}
	if _, err := w.svc.Accept(ctx, ma, subOf(o, w.a).ID); err != nil {
		t.Fatal(err)
	}
	// B no responde en 15 min.
	*w.clock = w.clock.Add(16 * time.Minute)
	if n, err := w.svc.ExpireAcceptance(ctx, 100); err != nil || n < 1 {
		t.Fatalf("%d %v", n, err)
	}
	got, err := w.svc.GetOrder(ctx, store.Who{UserID: w.buyer.UserID}, o.ID)
	if err != nil {
		t.Fatal(err)
	}
	if subOf(got, w.b).Status != domain.SubRejected || subOf(got, w.b).RejectReason != "ACCEPTANCE_TIMEOUT" || got.Status != domain.OrderPartiallyFulfilled {
		t.Fatalf("%+v", got)
	}
	runTasks(t, w)
	// El job recorre toda la base: se verifica solo lo de este pedido.
	if !w.deps.refunded["suborder-reject:"+subOf(got, w.b).ID] || w.deps.refunded["suborder-reject:"+subOf(got, w.a).ID] {
		t.Fatalf("solo se reembolsa el split de B: %v", w.deps.refunded)
	}
	if w.deps.returned["return:"+subOf(got, w.b).ID+":"+w.b1] != 1000 {
		t.Fatalf("devolución de stock: %v", w.deps.returned)
	}
	// A entrega con código de retiro.
	ready, err := w.svc.MarkReady(ctx, ma, subOf(o, w.a).ID)
	if err != nil || len(ready.PickupCode) != 6 {
		t.Fatalf("%v %q", err, ready.PickupCode)
	}
	if _, err := w.svc.MarkCompleted(ctx, ma, ready.ID, "000000x"); !errors.Is(err, domain.ErrPickupCode) {
		t.Fatalf("código equivocado: %v", err)
	}
	if _, err := w.svc.MarkCompleted(ctx, ma, ready.ID, ready.PickupCode); err != nil {
		t.Fatal(err)
	}
	done, _ := w.svc.GetOrder(ctx, store.Who{UserID: w.buyer.UserID}, o.ID)
	if done.Status != domain.OrderCompleted {
		t.Fatalf("%v", done.Status)
	}
}

func TestR3_PriceChangeBlocksCheckoutWithoutSideEffects(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	w.cart(t)
	q, err := w.svc.QuoteCheckout(ctx, w.buyer, 2)
	if err != nil {
		t.Fatal(err)
	}
	l := w.deps.listings[w.a1]
	l.PriceMinor = 1900
	w.deps.listings[w.a1] = l
	if _, err := w.svc.Checkout(ctx, w.buyer, service.CheckoutRequest{IdempotencyKey: "k-" + id(), QuoteID: q.ID, Fulfillment: 2}); !errors.Is(err, domain.ErrPriceChanged) {
		t.Fatalf("%v", err)
	}
	if n := count(t, `SELECT count(*) FROM orders WHERE user_id = $1`, w.buyer.UserID); n != 0 || len(w.deps.reserved) != 0 {
		t.Fatalf("efectos de un checkout rechazado: pedidos %d reservas %d", n, len(w.deps.reserved))
	}
}

func TestR3_OutOfStockCancelsAndReleasesEarlierReservations(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	w.cart(t)
	w.deps.noStock[w.b] = true
	q, err := w.svc.QuoteCheckout(ctx, w.buyer, 2)
	if err != nil {
		t.Fatal(err)
	}
	_, err = w.svc.Checkout(ctx, w.buyer, service.CheckoutRequest{IdempotencyKey: "k-" + id(), QuoteID: q.ID, Fulfillment: 2})
	if !errors.Is(err, domain.ErrOutOfStock) {
		t.Fatalf("%v", err)
	}
	if n := count(t, `SELECT count(*) FROM orders WHERE user_id = $1 AND status = 5`, w.buyer.UserID); n != 1 {
		t.Fatalf("pedido cancelado: %d", n)
	}
	runTasks(t, w)
	if len(w.deps.released) != len(w.deps.reserved) || len(w.deps.intents) != 0 {
		t.Fatalf("reservadas %d liberadas %d cobros %d", len(w.deps.reserved), len(w.deps.released), len(w.deps.intents))
	}
}

func TestIntegrity_LatePaymentOnCancelledOrderIsRefunded(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	w.cart(t)
	o := w.checkout(t, "k-"+id())
	if _, err := w.svc.Cancel(ctx, w.buyer, o.ID); err != nil {
		t.Fatal(err)
	}
	// El comprador igual confirmó el cobro: nunca queda dinero cobrado sin pedido.
	if err := w.svc.PaymentCaptured(ctx, id(), o.ID, id()); err != nil {
		t.Fatal(err)
	}
	runTasks(t, w)
	for _, sub := range o.Subs {
		if !w.deps.refunded["late-payment-refund:"+sub.ID] {
			t.Fatalf("reembolsos del cobro tardío: %v", w.deps.refunded)
		}
	}
	got, _ := w.svc.GetOrder(ctx, store.Who{UserID: w.buyer.UserID}, o.ID)
	if got.Status != domain.OrderRefunded {
		t.Fatalf("%v", got.Status)
	}
}

func TestR9_BuyerCancelsBeforeAcceptanceOnly(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	w.cart(t)
	o := w.checkout(t, "k-"+id())
	if err := w.svc.PaymentCaptured(ctx, id(), o.ID, id()); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.Accept(ctx, service.Merchant{TenantID: w.a}, subOf(o, w.a).ID); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.Cancel(ctx, w.buyer, o.ID); !errors.Is(err, domain.ErrInvalidTransition) {
		t.Fatalf("cancelar con un comercio que ya aceptó: %v", err)
	}
}

func TestRLS_BuyersAndMerchantsSeeOnlyTheirs(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	w.cart(t)
	o := w.checkout(t, "k-"+id())
	if err := w.svc.PaymentCaptured(ctx, id(), o.ID, id()); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.GetOrder(ctx, store.Who{UserID: id()}, o.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("otro comprador vio el pedido: %v", err)
	}
	subs, _, err := w.svc.ListMerchantSubs(ctx, service.Merchant{TenantID: w.b}, 0, time.Time{}, time.Time{}, 0, 50)
	if err != nil || len(subs) != 1 || subs[0].TenantID != w.b {
		t.Fatalf("B ve %d sub-pedidos (%v)", len(subs), err)
	}
	if _, err := w.svc.Accept(ctx, service.Merchant{TenantID: w.b}, subOf(o, w.a).ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("B aceptó el sub-pedido de A: %v", err)
	}
}

func TestSPEC4_CartLimitOfTenMerchants(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	var err error
	for i := 0; i < 11 && err == nil; i++ {
		pid := id()
		w.deps.listings[pid] = client.Listing{ProductID: pid, TenantID: id(), Name: fmt.Sprint("p", i), PriceMinor: 100, Currency: "USD", InStock: true, Pickup: true}
		_, err = w.svc.SetCartItem(ctx, w.buyer, pid, 1000)
	}
	if !errors.Is(err, domain.ErrCartLimit) {
		t.Fatalf("11 comercios: %v", err)
	}
	items, _ := w.svc.Cart(ctx, w.buyer)
	if len(items) != 10 {
		t.Fatalf("el carrito quedó con %d líneas", len(items))
	}
}

func TestSagaTasks_RefundRetriesUntilMerchantHasBalance(t *testing.T) {
	ctx, w := context.Background(), newWorld(t)
	w.cart(t)
	o := w.checkout(t, "k-"+id())
	if err := w.svc.PaymentCaptured(ctx, id(), o.ID, id()); err != nil {
		t.Fatal(err)
	}
	w.deps.refundErr = &client.Rejected{Dep: "payments-core", Reason: "MERCHANT_BALANCE_INSUFFICIENT"}
	if _, err := w.svc.Reject(ctx, service.Merchant{TenantID: w.b}, subOf(o, w.b).ID, "sin existencias"); err != nil {
		t.Fatal(err)
	}
	if out := runTasks(t, w); out.Retried < 1 {
		t.Fatalf("%+v", out)
	}
	w.deps.refundErr = nil
	*w.clock = w.clock.Add(time.Hour)
	runTasks(t, w)
	if !w.deps.refunded["suborder-reject:"+subOf(o, w.b).ID] {
		t.Fatalf("el reembolso debe completarse al reintentar: %v", w.deps.refunded)
	}
}

func TestPrivileges_ServiceRoleCannotDeleteOrders(t *testing.T) {
	ctx := context.Background()
	err := pgx.BeginTxFunc(ctx, open(t).Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `DELETE FROM orders`)
		return err
	})
	if err == nil {
		t.Fatal("orders_svc pudo borrar pedidos")
	}
}
