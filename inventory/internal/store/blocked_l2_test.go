//go:build l2

package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/service"
)

func stock(t *testing.T, s *service.Inventory, tenant, product string) domain.Level {
	t.Helper()
	l, err := s.GetStock(context.Background(), tenant, product, "")
	if err != nil {
		t.Fatal(err)
	}
	return l
}

func adjust(s *service.Inventory, c service.Caller, r service.AdjustRequest) error {
	if r.IdempotencyKey == "" {
		r.IdempotencyKey = key()
	}
	_, err := s.AdjustStock(context.Background(), c, r)
	return err
}

// F16.10 · disponible = on_hand − reservado − bloqueado, con vectores sobre la base real; ninguna
// reserva, ajuste, baja ni transferencia toma lo bloqueado; R1 se recalcula desde los movimientos.
func TestL2_F16_10_AvailableFormulaAndBlockedIsNeverTaken(t *testing.T) {
	ctx, tenant, product := context.Background(), id(), id()
	s := svc(t)
	c := person(tenant)
	receive(t, s, tenant, product, 10_000)
	if _, err := reserve(s, tenant, product, 3000, 300); err != nil {
		t.Fatal(err)
	}

	blockKey := key()
	block := service.AdjustRequest{IdempotencyKey: blockKey, ProductID: product, DeltaMilli: 4000, Type: domain.Block, Reason: "dañado"}
	for i := 0; i < 2; i++ { // el reintento con la misma clave no bloquea dos veces
		if err := adjust(s, c, block); err != nil {
			t.Fatal(err)
		}
	}
	vectors := []struct {
		step                             string
		onHand, reserved, blocked, avail int64
	}{{"tras bloquear", 10_000, 3000, 4000, 3000}}
	check := func(i int) {
		t.Helper()
		v, l := vectors[i], stock(t, s, tenant, product)
		if l.OnHandMilli != v.onHand || l.ReservedMilli != v.reserved || l.BlockedMilli != v.blocked || l.Available() != v.avail {
			t.Fatalf("%s: %+v (quiero %+v)", v.step, l, v)
		}
	}
	check(0)

	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: 4000, Type: domain.Block, Reason: "x"}); !errors.Is(err, domain.ErrOutOfStock) {
		t.Fatalf("bloquear más de lo disponible: %v", err)
	}
	if _, err := reserve(s, tenant, product, 3001, 300); !errors.Is(err, domain.ErrOutOfStock) {
		t.Fatalf("reservar lo bloqueado: %v", err)
	}
	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: -3001, Type: domain.WriteOff, Reason: "x"}); !errors.Is(err, domain.ErrOutOfStock) {
		t.Fatalf("baja que toma lo bloqueado: %v", err)
	}
	w, err := s.DefaultWarehouse(ctx, tenant)
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.UpsertWarehouse(ctx, tenant, domain.Warehouse{Name: "Sucursal David"})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.TransferStock(ctx, c, key(), product, w.ID, b.ID, 3001, "reposición", ""); !errors.Is(err, domain.ErrOutOfStock) {
		t.Fatalf("transferir lo bloqueado: %v", err)
	}
	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: -4001, Type: domain.Unblock, Reason: "revisado"}); !errors.Is(err, domain.ErrExceedsBlocked) {
		t.Fatalf("desbloquear más de lo bloqueado: %v", err)
	}
	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: -1, Type: domain.Block, Reason: "x"}); !errors.Is(err, domain.ErrInvalidQty) {
		t.Fatalf("BLOCK negativo: %v", err)
	}
	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: 1000, Type: domain.Block}); !errors.Is(err, domain.ErrReasonRequired) {
		t.Fatalf("BLOCK sin motivo: %v", err)
	}
	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: -1000, Type: domain.Adjustment, Reason: "x", FromBlocked: true}); !errors.Is(err, domain.ErrInvalidMovementType) {
		t.Fatalf("from_blocked fuera de WRITE_OFF: %v", err)
	}

	// Baja de lo bloqueado: UNBLOCK + WRITE_OFF en una transacción; reintentarla no repite.
	wo := service.AdjustRequest{IdempotencyKey: key(), ProductID: product, DeltaMilli: -1000, Type: domain.WriteOff, Reason: "dañado", FromBlocked: true}
	for i := 0; i < 2; i++ {
		m, err := s.AdjustStock(ctx, c, wo)
		if err != nil {
			t.Fatal(err)
		}
		if m.Type != domain.WriteOff {
			t.Fatalf("la respuesta es la baja: %v", m.Type)
		}
	}
	if n := count(t, tenant, `SELECT count(*) FROM movements WHERE idempotency_key = $1`, wo.IdempotencyKey); n != 2 {
		t.Fatalf("la baja de lo bloqueado son 2 movimientos (UNBLOCK + WRITE_OFF): %d", n)
	}
	vectors = append(vectors, struct {
		step                             string
		onHand, reserved, blocked, avail int64
	}{"tras la baja de lo bloqueado", 9000, 3000, 3000, 3000})
	check(1)

	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: -2000, Type: domain.Unblock, Reason: "revisado"}); err != nil {
		t.Fatal(err)
	}
	vectors = append(vectors, struct {
		step                             string
		onHand, reserved, blocked, avail int64
	}{"tras desbloquear", 9000, 3000, 1000, 5000})
	check(2)

	// Una venta física pasa aunque toque lo bloqueado (R2) y queda negativa para revisión.
	if err := adjust(s, pos(tenant), service.AdjustRequest{ProductID: product, DeltaMilli: -6000, Type: domain.Sale,
		ReferenceType: "sale", ReferenceID: id()}); err != nil {
		t.Fatal(err)
	}
	vectors = append(vectors, struct {
		step                             string
		onHand, reserved, blocked, avail int64
	}{"tras la venta física", 3000, 3000, 1000, -1000})
	check(3)

	sum, err := open(t).SumOfMovements(ctx, tenant, w.ID, product)
	if err != nil || sum != 3000 {
		t.Fatalf("R1: on_hand = Σ movimientos físicos: %d %v", sum, err)
	}
	blocked, err := open(t).SumOfBlocks(ctx, tenant, w.ID, product)
	if err != nil || blocked != 1000 {
		t.Fatalf("R1: bloqueado = Σ BLOCK/UNBLOCK: %d %v", blocked, err)
	}
	if n, err := open(t).BlockedLevels(ctx); err != nil || n < 1 {
		t.Fatalf("métrica de existencias bloqueadas: %d %v", n, err)
	}
}

// F16.10 con lotes: bloquear exige el lote; FEFO y las ventas de ese lote no toman lo bloqueado;
// la baja de lo bloqueado sale del lote; el aviso de vencimiento usa los días del comercio.
func TestL2_F16_10_LotBlocksAndExpiryAlert(t *testing.T) {
	ctx, tenant, product := context.Background(), id(), id()
	s := svcWith(t, products{lots: map[string]bool{product: true}})
	c := person(tenant)
	lotIn(t, s, tenant, product, "PRONTO", 3000, inDays(5))
	lotIn(t, s, tenant, product, "LUEGO", 3000, inDays(60))

	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: 1000, Type: domain.Block, Reason: "golpeado"}); !errors.Is(err, domain.ErrLotRequired) {
		t.Fatalf("bloquear sin lote: %v", err)
	}
	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: 3001, Type: domain.Block, Reason: "x", LotCode: "PRONTO"}); !errors.Is(err, domain.ErrOutOfStock) {
		t.Fatalf("bloquear más que el lote: %v", err)
	}
	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: 2000, Type: domain.Block, Reason: "retiro del fabricante", LotCode: "PRONTO"}); err != nil {
		t.Fatal(err)
	}
	if err := adjust(s, pos(tenant), service.AdjustRequest{ProductID: product, DeltaMilli: -1001, Type: domain.Sale, LotCode: "PRONTO",
		ReferenceType: "sale", ReferenceID: id()}); !errors.Is(err, domain.ErrOutOfStock) {
		t.Fatalf("vender lo bloqueado de un lote: %v", err)
	}
	// FEFO: de PRONTO solo queda 1 libre; el resto sale de LUEGO.
	if err := adjust(s, pos(tenant), service.AdjustRequest{ProductID: product, DeltaMilli: -2000, Type: domain.Sale,
		ReferenceType: "sale", ReferenceID: id()}); err != nil {
		t.Fatal(err)
	}
	if got := lotsByCode(t, s, tenant, product); got["PRONTO"] != 2000 || got["LUEGO"] != 2000 {
		t.Fatalf("FEFO sin lo bloqueado: %v", got)
	}
	if err := adjust(s, c, service.AdjustRequest{ProductID: product, DeltaMilli: -2000, Type: domain.WriteOff, Reason: "retiro del fabricante",
		LotCode: "PRONTO", FromBlocked: true}); err != nil {
		t.Fatal(err)
	}
	if got, l := lotsByCode(t, s, tenant, product), stock(t, s, tenant, product); got["PRONTO"] != 0 || l.OnHandMilli != 2000 || l.BlockedMilli != 0 {
		t.Fatalf("baja del bloqueado del lote: %v %+v", got, l)
	}

	// Aviso de vencimiento: por defecto 30 días.
	lotIn(t, s, tenant, product, "MES", 1000, inDays(20))
	expiring := func() map[string]bool {
		t.Helper()
		lots, days, err := s.ListLots(ctx, tenant, service.LotsRequest{OnlyExpiring: true})
		if err != nil {
			t.Fatal(err)
		}
		out := map[string]bool{}
		for _, l := range lots {
			out[l.Code] = l.ExpiresSoon(domain.Today(time.Now()), days)
		}
		return out
	}
	if got := expiring(); len(got) != 1 || !got["MES"] {
		t.Fatalf("por vencer en 30 días (PRONTO ya está vacío): %v", got)
	}
	if _, err := s.UpdateSettings(ctx, c, domain.Settings{ExpiryAlertDays: 0}); !errors.Is(err, domain.ErrInvalidSettings) {
		t.Fatalf("0 días: %v", err)
	}
	if _, err := s.UpdateSettings(ctx, c, domain.Settings{ExpiryAlertDays: 90}); err != nil {
		t.Fatal(err)
	}
	if got := expiring(); len(got) != 2 || !got["MES"] || !got["LUEGO"] {
		t.Fatalf("por vencer en 90 días: %v", got)
	}
	// Los parámetros son del comercio: otro tenant sigue con el valor por defecto (RLS).
	other, err := s.Settings(ctx, id())
	if err != nil || other.ExpiryAlertDays != domain.DefaultExpiryAlertDays {
		t.Fatalf("otro comercio: %+v %v", other, err)
	}
}
