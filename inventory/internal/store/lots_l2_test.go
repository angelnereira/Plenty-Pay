//go:build l2

package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/service"
)

func inDays(n int) *time.Time {
	d := domain.Today(time.Now()).AddDate(0, 0, n)
	return &d
}

func lotIn(t *testing.T, s *service.Inventory, tenant, product, code string, milli int64, exp *time.Time) {
	t.Helper()
	if _, err := s.AdjustStock(context.Background(), person(tenant), service.AdjustRequest{IdempotencyKey: key(),
		ProductID: product, DeltaMilli: milli, Type: domain.Receipt, LotCode: code, LotExpiresOn: exp}); err != nil {
		t.Fatal(code, err)
	}
}

func lotsByCode(t *testing.T, s *service.Inventory, tenant, product string) map[string]int64 {
	t.Helper()
	lots, err := s.ListLots(context.Background(), tenant, product, "", true)
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]int64{}
	for _, l := range lots {
		out[l.Code] += l.OnHandMilli
	}
	return out
}

// expire vence un lote (como si pasaran los días): el rol del servicio puede actualizar lotes.
func expire(t *testing.T, tenant, product, code string) {
	t.Helper()
	err := pgx.BeginTxFunc(context.Background(), open(t).Pool(), pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.tenant_id', $1, true)`, tenant); err != nil {
			return err
		}
		_, err := tx.Exec(context.Background(), `UPDATE lots SET expires_on = current_date - 3 WHERE product_id = $1 AND code = $2`, product, code)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
}

// R5 · F16.4: un producto con lotes exige lote al entrar y no recibe lotes vencidos; la venta
// sale FEFO (primero lo que vence antes, nunca de un vencido) y un reintento no duplica; la suma
// de los lotes es la existencia.
func TestL2_R5_LotsAreRequiredAndSalesLeaveFEFO(t *testing.T) {
	ctx, tenant, product := context.Background(), id(), id()
	s := svcWith(t, products{lots: map[string]bool{product: true}})

	_, err := s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		DeltaMilli: 1000, Type: domain.Receipt})
	if !errors.Is(err, domain.ErrLotRequired) {
		t.Fatalf("entrada sin lote: %v", err)
	}
	_, err = s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		DeltaMilli: 1000, Type: domain.Receipt, LotCode: "VIEJO", LotExpiresOn: inDays(-1)})
	if !errors.Is(err, domain.ErrLotExpired) {
		t.Fatalf("recibir un lote vencido: %v", err)
	}

	lotIn(t, s, tenant, product, "DIC", 5000, inDays(60))
	lotIn(t, s, tenant, product, "NOV", 3000, inDays(30))
	lotIn(t, s, tenant, product, "SIN", 2000, nil)
	lotIn(t, s, tenant, product, "VENCE", 4000, inDays(10))
	expire(t, tenant, product, "VENCE")

	k := key()
	sale := service.AdjustRequest{IdempotencyKey: k, ProductID: product, DeltaMilli: -4000, Type: domain.Sale,
		ReferenceType: "sale", ReferenceID: id()}
	for i := 0; i < 2; i++ {
		if _, err := s.AdjustStock(ctx, pos(tenant), sale); err != nil {
			t.Fatal(err)
		}
	}
	got := lotsByCode(t, s, tenant, product)
	want := map[string]int64{"NOV": 0, "DIC": 4000, "SIN": 2000, "VENCE": 4000}
	for c, v := range want {
		if got[c] != v {
			t.Fatalf("lotes tras la venta: %v (quiero %v)", got, want)
		}
	}
	if n := count(t, tenant, `SELECT count(*) FROM movements WHERE idempotency_key = $1`, k); n != 2 {
		t.Fatalf("la venta de 4 en dos lotes son 2 movimientos, sin duplicar en el reintento: %d", n)
	}
	if onHand(t, s, tenant, product) != 10000 {
		t.Fatalf("existencia: %d", onHand(t, s, tenant, product))
	}

	_, err = s.AdjustStock(ctx, pos(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		DeltaMilli: -1000, Type: domain.Sale, LotCode: "VENCE", ReferenceType: "sale", ReferenceID: id()})
	if !errors.Is(err, domain.ErrLotExpired) {
		t.Fatalf("vender de un lote vencido: %v", err)
	}
	// Desechar lo vencido es una baja de ese lote.
	if _, err := s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		DeltaMilli: -4000, Type: domain.WriteOff, Reason: "vencido", LotCode: "VENCE"}); err != nil {
		t.Fatal(err)
	}
	if got := lotsByCode(t, s, tenant, product); got["VENCE"] != 0 || onHand(t, s, tenant, product) != 6000 {
		t.Fatalf("baja del vencido: %v %d", got, onHand(t, s, tenant, product))
	}
	if _, err := s.AdjustStock(ctx, person(tenant), service.AdjustRequest{IdempotencyKey: key(), ProductID: product,
		DeltaMilli: -1, Type: domain.WriteOff, Reason: "x", LotCode: "NO-EXISTE"}); !errors.Is(err, domain.ErrLotNotFound) {
		t.Fatalf("lote inexistente: %v", err)
	}
}

// R5: una transferencia sale FEFO y el destino recibe los mismos lotes con su vencimiento; una
// reserva confirmada vende FEFO.
func TestL2_R5_TransferMirrorsLotsAndReservationsSellFEFO(t *testing.T) {
	ctx, tenant, product := context.Background(), id(), id()
	s := svcWith(t, products{lots: map[string]bool{product: true}})
	a, err := s.DefaultWarehouse(ctx, tenant)
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.UpsertWarehouse(ctx, tenant, domain.Warehouse{Name: "Sucursal Chitré"})
	if err != nil {
		t.Fatal(err)
	}
	lotIn(t, s, tenant, product, "L1", 2000, inDays(15))
	lotIn(t, s, tenant, product, "L2", 5000, inDays(40))

	if _, _, err := s.TransferStock(ctx, person(tenant), key(), product, a.ID, b.ID, 3000, "reposición", ""); err != nil {
		t.Fatal(err)
	}
	inB, err := s.ListLots(ctx, tenant, product, b.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(inB) != 2 || inB[0].Code != "L1" || inB[0].OnHandMilli != 2000 || inB[1].Code != "L2" || inB[1].OnHandMilli != 1000 ||
		inB[0].ExpiresOn == nil || !inB[0].ExpiresOn.Equal(*inDays(15)) {
		t.Fatalf("lotes en el destino: %+v", inB)
	}

	r, err := reserve(s, tenant, product, 2500, 300)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CommitReservation(ctx, orders(tenant), r.ID); err != nil {
		t.Fatal(err)
	}
	inA, err := s.ListLots(ctx, tenant, product, a.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(inA) != 2 || inA[0].Code != "L1" || inA[0].OnHandMilli != 0 || inA[1].Code != "L2" || inA[1].OnHandMilli != 1500 {
		t.Fatalf("la venta confirmada sale FEFO: %+v", inA)
	}
}

// F16.8: la recepción de una compra lleva lote y vencimiento; un producto puede llegar en dos lotes.
func TestL2_F16_8_PurchaseReceiptWithLots(t *testing.T) {
	ctx, tenant, prod := context.Background(), id(), id()
	s := svcWith(t, products{lots: map[string]bool{prod: true}})
	c := person(tenant)
	sup, err := s.UpsertSupplier(ctx, c, domain.Supplier{Name: "Droguería Istmeña"}, key())
	if err != nil {
		t.Fatal(err)
	}
	po, err := s.CreatePurchaseOrder(ctx, c, domain.PurchaseOrder{SupplierID: sup.ID,
		Lines: []domain.POLine{{ProductID: prod, OrderedMilli: 10_000, UnitCostMinor: 150}}}, key())
	if err != nil {
		t.Fatal(err)
	}
	if po, err = s.UpdatePurchaseOrderStatus(ctx, tenant, po.ID, domain.POSent); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ReceiveGoods(ctx, c, po.ID, key(), "", []domain.Received{{ProductID: prod, ReceivedMilli: 1000}}); !errors.Is(err, domain.ErrLotRequired) {
		t.Fatalf("recepción sin lote: %v", err)
	}
	po, err = s.ReceiveGoods(ctx, c, po.ID, key(), "F-77", []domain.Received{
		{ProductID: prod, ReceivedMilli: 6000, LotCode: "A-26", LotExpiresOn: inDays(90)},
		{ProductID: prod, ReceivedMilli: 4000, LotCode: "B-26", LotExpiresOn: inDays(120)},
	})
	if err != nil || po.Status != domain.POReceived {
		t.Fatalf("%v %v", err, po.Status)
	}
	if got := lotsByCode(t, s, tenant, prod); got["A-26"] != 6000 || got["B-26"] != 4000 {
		t.Fatalf("lotes recibidos: %v", got)
	}
}
