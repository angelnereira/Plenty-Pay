//go:build l2

// Pruebas L2 de pos contra PostgreSQL real y efímero (pos/test/test_l2.sh). catalog e inventory se
// sustituyen por dobles en memoria: aquí se prueba la cadena de pos (venta → cobro → recibo →
// tareas de stock → evento) y su atomicidad en la base.
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

	"plentypay/pos/internal/client"
	"plentypay/pos/internal/domain"
	"plentypay/pos/internal/service"
	"plentypay/pos/internal/store"
)

type fakeCatalog struct{ products map[string]client.Product }

func (f fakeCatalog) Product(_ context.Context, _ client.Who, id string) (client.Product, error) {
	p, ok := f.products[id]
	if !ok {
		return p, client.ErrProductNotFound
	}
	return p, nil
}

type fakeInventory struct {
	mu    sync.Mutex
	err   error
	moves map[string]int64 // clave → cantidad
}

func (f *fakeInventory) Move(_ context.Context, _ client.Who, key, _, _ string, _ int16, qty int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	f.moves[key] = qty // idempotente por clave, como inventory
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
	svc      *service.Pos
	inv      *fakeInventory
	cafe     string
	pan      string
	servicio string // no lleva inventario
	now      time.Time
}

func newWorld(t *testing.T) *world {
	w := &world{inv: &fakeInventory{moves: map[string]int64{}}, cafe: id(), pan: id(), servicio: id(), now: time.Now().UTC()}
	cat := fakeCatalog{products: map[string]client.Product{
		w.cafe:     {ID: w.cafe, Name: "Café 250 g", PriceMinor: 1850, Currency: "USD", TaxRateBps: 700, TracksInventory: true, Active: true},
		w.pan:      {ID: w.pan, Name: "Croissant", PriceMinor: 425, Currency: "USD", TaxRateBps: 700, TracksInventory: true, Active: true},
		w.servicio: {ID: w.servicio, Name: "Envoltura de regalo", PriceMinor: 300, Currency: "USD", TaxRateBps: 0, Active: true},
	}}
	w.svc = service.New(open(t), cat, w.inv, func() time.Time { return time.Now().UTC() }, service.NewUUIDv7)
	return w
}

func cashier(tenant string) service.Actor {
	return service.Actor{TenantID: tenant, UserID: id(), Permissions: map[string]bool{"pos:sell": true, "pos:session:manage": true, "pos:void": true}}
}

func openSale(t *testing.T, w *world, a service.Actor, terminal string, lines ...service.LineInput) domain.Sale {
	t.Helper()
	ctx := context.Background()
	ss, err := w.svc.GetSession(ctx, a, "")
	if errors.Is(err, domain.ErrNotFound) {
		ss, err = w.svc.OpenSession(ctx, a, terminal, 5000, "USD")
	}
	if err != nil {
		t.Fatal(err)
	}
	sale, err := w.svc.CreateSale(ctx, a, ss.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	sale, err = w.svc.UpdateSale(ctx, a, sale.ID, sale.Version, lines)
	if err != nil {
		t.Fatal(err)
	}
	return sale
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

func TestSPEC11_1_CashPlusWalletPaysAndDiscountsStock(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	sale := openSale(t, w, a, "CAJA-01",
		service.LineInput{ProductID: w.cafe, QtyMilli: 1000},
		service.LineInput{ProductID: w.pan, QtyMilli: 2000},
		service.LineInput{ProductID: w.servicio, QtyMilli: 1000})
	if sale.TotalMinor != 3000 || sale.Lines[0].UnitPriceMinor != 1850 {
		t.Fatalf("el precio sale del catálogo: %+v", sale)
	}
	sale, err := w.svc.Checkout(ctx, a, sale.ID, []domain.Tender{
		{Rail: domain.RailCash, AmountMinor: 1000, CashTendered: 2000},
		{Rail: domain.RailWallet, AmountMinor: 2000},
	})
	if err != nil {
		t.Fatal(err)
	}
	if sale.Status != domain.AwaitingPayment || sale.ChangeMinor != 1000 {
		t.Fatalf("%+v", sale)
	}
	// Hasta que la billetera cobre, no hay recibo, ni stock descontado, ni evento.
	if n := count(t, tenant, `SELECT count(*) FROM stock_tasks WHERE sale_id = $1`, sale.ID); n != 0 {
		t.Fatalf("stock descontado antes del cobro: %d", n)
	}
	applied, err := w.svc.HandlePayment(ctx, store.PaymentEvent{EventID: id(), TenantID: tenant, SaleID: sale.ID,
		IntentID: id(), Amount: 2000, Captured: true})
	if err != nil || !applied {
		t.Fatalf("%v %v", applied, err)
	}
	paid, err := w.svc.GetSale(ctx, a, sale.ID)
	if err != nil {
		t.Fatal(err)
	}
	if paid.Status != domain.Paid || paid.ReceiptNumber < 1 {
		t.Fatalf("%+v", paid)
	}
	// Atomicidad: con el pago nacen 2 tareas (el servicio no lleva inventario) y 1 SalePaid.
	if n := count(t, tenant, `SELECT count(*) FROM stock_tasks WHERE sale_id = $1`, sale.ID); n != 2 {
		t.Fatalf("tareas de stock: %d", n)
	}
	if n := count(t, tenant, `SELECT count(*) FROM outbox WHERE aggregate_id = $1 AND subject = 'pp.pos.sale.paid.v1'`, sale.ID); n != 1 {
		t.Fatalf("SalePaid: %d", n)
	}
	// El cajón suma 10.00 (no los 20.00 recibidos: el vuelto salió).
	ss, err := w.svc.GetSession(ctx, a, sale.SessionID)
	if err != nil || ss.ExpectedCash != 5000+1000 {
		t.Fatalf("efectivo esperado %d (%v)", ss.ExpectedCash, err)
	}
	// El worker entrega el descuento a inventory con claves deterministas.
	out, err := w.svc.DeliverStock(ctx, 500, func(store.StockTask, error) {})
	if err != nil {
		t.Fatal(err)
	}
	if w.inv.moves["sale:"+sale.ID+":"+paid.Lines[0].ID] != 1000 || w.inv.moves["sale:"+sale.ID+":"+paid.Lines[1].ID] != 2000 {
		t.Fatalf("movimientos: %v (%+v)", w.inv.moves, out)
	}
	if n := count(t, tenant, `SELECT count(*) FROM stock_tasks WHERE sale_id = $1 AND status = 'DONE'`, sale.ID); n != 2 {
		t.Fatalf("tareas cerradas: %d", n)
	}
}

func TestADR0012_DuplicatePaymentEventHasNoEffect(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	sale := openSale(t, w, a, "CAJA-02", service.LineInput{ProductID: w.cafe, QtyMilli: 1000})
	if _, err := w.svc.Checkout(ctx, a, sale.ID, []domain.Tender{{Rail: domain.RailWallet, AmountMinor: 1850}}); err != nil {
		t.Fatal(err)
	}
	ev := store.PaymentEvent{EventID: id(), TenantID: tenant, SaleID: sale.ID, IntentID: id(), Amount: 1850, Captured: true}
	for i := 0; i < 3; i++ {
		if _, err := w.svc.HandlePayment(ctx, ev); err != nil {
			t.Fatal(err)
		}
	}
	if n := count(t, tenant, `SELECT count(*) FROM outbox WHERE aggregate_id = $1`, sale.ID); n != 1 {
		t.Fatalf("eventos tras 3 entregas del mismo cobro: %d", n)
	}
	if n := count(t, tenant, `SELECT count(*) FROM stock_tasks WHERE sale_id = $1`, sale.ID); n != 1 {
		t.Fatalf("tareas: %d", n)
	}
}

func TestR4_CashOnlyPaysAtOnceWithConsecutiveReceipts(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	var receipts []int64
	for i := 0; i < 3; i++ {
		sale := openSale(t, w, a, "CAJA-03", service.LineInput{ProductID: w.pan, QtyMilli: 1000})
		paid, err := w.svc.Checkout(ctx, a, sale.ID, []domain.Tender{{Rail: domain.RailCash, AmountMinor: 425}})
		if err != nil {
			t.Fatal(err)
		}
		if paid.Status != domain.Paid {
			t.Fatalf("%+v", paid.Status)
		}
		receipts = append(receipts, paid.ReceiptNumber)
	}
	if receipts[1] != receipts[0]+1 || receipts[2] != receipts[1]+1 {
		t.Fatalf("R10 recibos consecutivos: %v", receipts)
	}
}

func TestStockWorker_InventoryDownIsDeferredNotLost(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	sale := openSale(t, w, a, "CAJA-04", service.LineInput{ProductID: w.cafe, QtyMilli: 3000})
	if _, err := w.svc.Checkout(ctx, a, sale.ID, []domain.Tender{{Rail: domain.RailCash, AmountMinor: 5550}}); err != nil {
		t.Fatal(err)
	}
	w.inv.err = fmt.Errorf("%w: inventory down", client.ErrUnavailable)
	out, err := w.svc.DeliverStock(ctx, 500, func(store.StockTask, error) {})
	if err != nil || out.Retried < 1 {
		t.Fatalf("%+v %v", out, err)
	}
	if n := count(t, tenant, `SELECT count(*) FROM stock_tasks WHERE sale_id = $1 AND status = 'PENDING' AND next_attempt_at > now()`, sale.ID); n != 1 {
		t.Fatalf("la tarea debe quedar diferida: %d", n)
	}
	// Rechazo definitivo (p. ej. producto sin inventario): la venta queda para revisión.
	w.inv.err = fmt.Errorf("%w: INVENTORY_NOT_TRACKED", client.ErrRejected)
	if _, err := open(t).Pool().Exec(ctx, `SELECT 1`); err != nil {
		t.Fatal(err)
	}
	err = pgx.BeginTxFunc(ctx, open(t).Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenant); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `UPDATE stock_tasks SET next_attempt_at = now() - interval '1 second' WHERE sale_id = $1`, sale.ID)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	if out, err := w.svc.DeliverStock(ctx, 500, func(store.StockTask, error) {}); err != nil || out.Failed < 1 {
		t.Fatalf("%+v %v", out, err)
	}
	got, err := w.svc.GetSale(ctx, a, sale.ID)
	if err != nil || !got.NeedsReview {
		t.Fatalf("la venta debe quedar para revisión: %+v %v", got.NeedsReview, err)
	}
}

func TestR1_OneOpenSessionPerTerminalAndOwnerOnly(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a, b := cashier(tenant), cashier(tenant)
	ss, err := w.svc.OpenSession(ctx, a, "CAJA-05", 0, "USD")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.OpenSession(ctx, b, "caja-05", 0, "USD"); !errors.Is(err, domain.ErrSessionOpen) {
		t.Fatalf("segunda sesión en la misma caja: %v", err)
	}
	if _, err := w.svc.CreateSale(ctx, b, ss.ID, ""); !errors.Is(err, domain.ErrNotYourSession) {
		t.Fatalf("otro cajero vendió en mi sesión: %v", err)
	}
}

func TestSessionClose_PendingSalesBlockAndDifferenceIsRecorded(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	sale := openSale(t, w, a, "CAJA-06", service.LineInput{ProductID: w.pan, QtyMilli: 1000})
	if _, err := w.svc.Checkout(ctx, a, sale.ID, []domain.Tender{{Rail: domain.RailWallet, AmountMinor: 425}}); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.CloseSession(ctx, a, sale.SessionID, 5000, ""); !errors.Is(err, domain.ErrSalesPending) {
		t.Fatalf("cerrar con un cobro pendiente: %v", err)
	}
	if _, err := w.svc.HandlePayment(ctx, store.PaymentEvent{EventID: id(), TenantID: tenant, SaleID: sale.ID, Amount: 425, Captured: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.RecordCashMovement(ctx, a, sale.SessionID, "OUT", 1000, "retiro a caja fuerte"); err != nil {
		t.Fatal(err)
	}
	closed, err := w.svc.CloseSession(ctx, a, sale.SessionID, 3900, "faltan 1.00")
	if err != nil {
		t.Fatal(err)
	}
	// Esperado = 50.00 de fondo − 10.00 retirados (la venta fue con billetera).
	if closed.ExpectedCash != 4000 || closed.DifferenceMinor != -100 || closed.Status != "CLOSED" {
		t.Fatalf("%+v", closed)
	}
}

func TestRLS_SalesAndPaymentEventsAreTenantScoped(t *testing.T) {
	ctx, w, ta, tb := context.Background(), newWorld(t), id(), id()
	a := cashier(ta)
	sale := openSale(t, w, a, "CAJA-07", service.LineInput{ProductID: w.cafe, QtyMilli: 1000})
	if _, err := w.svc.Checkout(ctx, a, sale.ID, []domain.Tender{{Rail: domain.RailWallet, AmountMinor: 1850}}); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.GetSale(ctx, cashier(tb), sale.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("B leyó la venta de A: %v", err)
	}
	// Un cobro de otro comercio que referencia esta venta no la paga.
	if _, err := w.svc.HandlePayment(ctx, store.PaymentEvent{EventID: id(), TenantID: tb, SaleID: sale.ID, Amount: 1850, Captured: true}); err != nil {
		t.Fatal(err)
	}
	got, err := w.svc.GetSale(ctx, a, sale.ID)
	if err != nil || got.Status != domain.AwaitingPayment {
		t.Fatalf("un cobro ajeno pagó la venta: %+v %v", got.Status, err)
	}
}

func TestR8_VoidBeforePaymentOnly(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	open1 := openSale(t, w, a, "CAJA-08", service.LineInput{ProductID: w.pan, QtyMilli: 1000})
	if v, err := w.svc.VoidSale(ctx, a, open1.ID, "error de digitación"); err != nil || v.Status != domain.Voided {
		t.Fatalf("%v %+v", err, v.Status)
	}
	// El motivo queda guardado para auditoría (defecto encontrado en el L4 de F17.4: se validaba y no se guardaba).
	if got, err := w.svc.GetSale(ctx, a, open1.ID); err != nil || got.VoidReason != "error de digitación" {
		t.Fatalf("motivo de anulación no guardado: %q %v", got.VoidReason, err)
	}
	paid := openSale(t, w, a, "CAJA-08", service.LineInput{ProductID: w.pan, QtyMilli: 1000})
	if _, err := w.svc.Checkout(ctx, a, paid.ID, []domain.Tender{{Rail: domain.RailCash, AmountMinor: 425}}); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.VoidSale(ctx, a, paid.ID, "x"); !errors.Is(err, domain.ErrInvalidTransition) {
		t.Fatalf("anular pagada: %v", err)
	}
}

func TestR3_DiscountRequiresPermissionAndUnknownProductsFail(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	sale := openSale(t, w, a, "CAJA-09", service.LineInput{ProductID: w.pan, QtyMilli: 1000})
	if _, err := w.svc.UpdateSale(ctx, a, sale.ID, 0, []service.LineInput{{ProductID: w.pan, QtyMilli: 1000, DiscountMinor: 100}}); !errors.Is(err, service.ErrDiscountNotAllowed) {
		t.Fatalf("descuento sin permiso: %v", err)
	}
	if _, err := w.svc.UpdateSale(ctx, a, sale.ID, 0, []service.LineInput{{ProductID: id(), QtyMilli: 1000}}); !errors.Is(err, client.ErrProductNotFound) {
		t.Fatalf("producto inexistente: %v", err)
	}
	a.Permissions["pos:discount:apply"] = true
	got, err := w.svc.UpdateSale(ctx, a, sale.ID, 0, []service.LineInput{{ProductID: w.pan, QtyMilli: 1000, DiscountMinor: 25}})
	if err != nil || got.TotalMinor != 400 {
		t.Fatalf("%v %d", err, got.TotalMinor)
	}
}

func TestClientSaleIDIsIdempotent(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	ss, err := w.svc.OpenSession(ctx, a, "CAJA-10", 0, "USD")
	if err != nil {
		t.Fatal(err)
	}
	c := id()
	s1, err := w.svc.CreateSale(ctx, a, ss.ID, c)
	if err != nil {
		t.Fatal(err)
	}
	s2, err := w.svc.CreateSale(ctx, a, ss.ID, c)
	if err != nil || s1.ID != s2.ID {
		t.Fatalf("el reintento del dispositivo creó otra venta: %s %s %v", s1.ID, s2.ID, err)
	}
}

func TestPrivileges_ServiceRoleCannotDeleteSales(t *testing.T) {
	ctx := context.Background()
	err := pgx.BeginTxFunc(ctx, open(t).Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `DELETE FROM sales`)
		return err
	})
	if err == nil {
		t.Fatal("pos_svc pudo borrar ventas")
	}
}

// F17.4: estacionar → listar → retomar conserva líneas y totales; estacionar no toca inventario;
// una estacionada bloquea el cierre y no se cobra; repetir la transición no falla ni escribe.
func TestL2_R13_ParkResumeAndCloseBlocked(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	sale := openSale(t, w, a, "CAJA-17", service.LineInput{ProductID: w.cafe, QtyMilli: 2000})
	parked, err := w.svc.ParkSale(ctx, a, sale.ID, "Cliente fue por la leche")
	if err != nil || parked.Status != domain.Parked || parked.ParkLabel != "Cliente fue por la leche" ||
		parked.ParkedAt.IsZero() || parked.Version != sale.Version+1 {
		t.Fatalf("%v %+v", err, parked)
	}
	again, err := w.svc.ParkSale(ctx, a, sale.ID, "otra nota")
	if err != nil || again.Version != parked.Version || again.ParkLabel != parked.ParkLabel {
		t.Fatalf("reintento de estacionar: %v %+v", err, again)
	}
	list, _, err := w.svc.ListSales(ctx, a, store.SaleFilter{SessionID: sale.SessionID, Status: domain.Parked, Limit: 50})
	if err != nil || len(list) != 1 || list[0].ID != sale.ID {
		t.Fatalf("lista de estacionadas: %v %d", err, len(list))
	}
	if len(w.inv.moves) != 0 || count(t, tenant, `SELECT count(*) FROM stock_tasks`) != 0 {
		t.Fatal("estacionar no reserva ni descuenta existencias")
	}
	if _, err := w.svc.Checkout(ctx, a, sale.ID, []domain.Tender{{Rail: domain.RailCash, AmountMinor: 3700}}); !errors.Is(err, domain.ErrInvalidTransition) {
		t.Fatalf("cobrar una estacionada: %v", err)
	}
	if _, err := w.svc.UpdateSale(ctx, a, sale.ID, parked.Version, []service.LineInput{{ProductID: w.pan, QtyMilli: 1000}}); !errors.Is(err, domain.ErrInvalidTransition) {
		t.Fatalf("editar una estacionada: %v", err)
	}
	if _, err := w.svc.CloseSession(ctx, a, sale.SessionID, 5000, ""); !errors.Is(err, domain.ErrSalesPending) {
		t.Fatalf("cerrar con una estacionada: %v", err)
	}
	if _, err := w.svc.ResumeSale(ctx, cashier(tenant), sale.ID); !errors.Is(err, domain.ErrNotYourSession) {
		t.Fatalf("otro cajero retoma: %v", err)
	}
	resumed, err := w.svc.ResumeSale(ctx, a, sale.ID)
	if err != nil || resumed.Status != domain.Open || len(resumed.Lines) != 1 || resumed.TotalMinor != 3700 {
		t.Fatalf("%v %+v", err, resumed)
	}
	if again, err := w.svc.ResumeSale(ctx, a, sale.ID); err != nil || again.Version != resumed.Version {
		t.Fatalf("reintento de retomar: %v", err)
	}
	paid, err := w.svc.Checkout(ctx, a, sale.ID, []domain.Tender{{Rail: domain.RailCash, AmountMinor: 3700}})
	if err != nil || paid.Status != domain.Paid {
		t.Fatalf("%v %+v", err, paid.Status)
	}
	if _, err := w.svc.CloseSession(ctx, a, sale.SessionID, 8700, ""); err != nil {
		t.Fatalf("cerrar sin estacionadas: %v", err)
	}
}

// F17.4: una venta vacía no se estaciona; una estacionada se anula con motivo; con la caja cerrada
// no se estaciona ni se retoma.
func TestL2_R13_EmptyVoidAndClosedSession(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	ss, err := w.svc.OpenSession(ctx, a, "CAJA-18", 5000, "USD")
	if err != nil {
		t.Fatal(err)
	}
	empty, err := w.svc.CreateSale(ctx, a, ss.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.ParkSale(ctx, a, empty.ID, ""); !errors.Is(err, domain.ErrEmptySale) {
		t.Fatalf("estacionar vacía: %v", err)
	}
	sale := openSale(t, w, a, "CAJA-18", service.LineInput{ProductID: w.pan, QtyMilli: 1000})
	if _, err := w.svc.ParkSale(ctx, a, sale.ID, ""); err != nil {
		t.Fatal(err)
	}
	if v, err := w.svc.VoidSale(ctx, a, sale.ID, "el cliente no volvió"); err != nil || v.Status != domain.Voided {
		t.Fatalf("anular estacionada: %v", err)
	}
	other := openSale(t, w, a, "CAJA-18", service.LineInput{ProductID: w.pan, QtyMilli: 1000})
	if _, err := w.svc.VoidSale(ctx, a, empty.ID, "vacía"); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.VoidSale(ctx, a, other.ID, "prueba"); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.CloseSession(ctx, a, ss.ID, 5000, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.ParkSale(ctx, a, other.ID, ""); !errors.Is(err, domain.ErrSessionClosed) {
		t.Fatalf("estacionar con la caja cerrada: %v", err)
	}
}

// F17.4 · concurrencia: diez retomas simultáneas de la misma venta dejan una sola transición
// (versión +1) y todas responden la venta abierta.
func TestL2_R13_ConcurrentResumeIsSingleTransition(t *testing.T) {
	ctx, w, tenant := context.Background(), newWorld(t), id()
	a := cashier(tenant)
	sale := openSale(t, w, a, "CAJA-19", service.LineInput{ProductID: w.cafe, QtyMilli: 1000})
	parked, err := w.svc.ParkSale(ctx, a, sale.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 10)
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			got, err := w.svc.ResumeSale(ctx, a, sale.ID)
			if err == nil && (got.Status != domain.Open || got.Version != parked.Version+1) {
				err = fmt.Errorf("estado %v versión %d", got.Status, got.Version)
			}
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
}
