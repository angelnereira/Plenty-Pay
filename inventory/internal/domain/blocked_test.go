package domain

import (
	"errors"
	"testing"
	"time"
)

// F16.10 · disponible = on_hand − reservado − bloqueado, con vectores.
func TestF16_10_AvailableSubtractsReservedAndBlocked(t *testing.T) {
	cases := []struct{ onHand, reserved, blocked, want int64 }{
		{10000, 0, 0, 10000},
		{10000, 3000, 0, 7000},
		{10000, 3000, 2000, 5000},
		{10000, 0, 10000, 0},
		{-2000, 0, 1000, -3000}, // venta física dejó negativo (R2): lo bloqueado no lo compensa
	}
	for _, c := range cases {
		l := Level{OnHandMilli: c.onHand, ReservedMilli: c.reserved, BlockedMilli: c.blocked}
		if got := l.Available(); got != c.want {
			t.Fatalf("%+v → %d (quiero %d)", c, got, c.want)
		}
	}
}

// F16.10: BLOCK toma solo lo disponible y no cambia el físico; UNBLOCK no libera más de lo
// bloqueado; ni reservas ni ajustes toman lo bloqueado; una venta física sigue pudiendo pasar.
func TestF16_10_BlockUnblockAndWhatTheyProtect(t *testing.T) {
	l := Level{OnHandMilli: 10000, ReservedMilli: 2000}
	if err := l.Apply(Movement{Type: Block, DeltaMilli: 9000, Reason: "dañado"}); !errors.Is(err, ErrOutOfStock) {
		t.Fatalf("bloquear más de lo disponible: %v", err)
	}
	if err := l.Apply(Movement{Type: Block, DeltaMilli: 3000, Reason: "dañado"}); err != nil {
		t.Fatal(err)
	}
	if l.OnHandMilli != 10000 || l.BlockedMilli != 3000 || l.Available() != 5000 {
		t.Fatalf("tras bloquear: %+v", l)
	}
	if err := l.Reserve(5001, false); !errors.Is(err, ErrOutOfStock) {
		t.Fatalf("reservar lo bloqueado: %v", err)
	}
	if err := l.Apply(Movement{Type: Adjustment, DeltaMilli: -5001, Reason: "conteo"}); !errors.Is(err, ErrOutOfStock) {
		t.Fatalf("ajuste que toma lo bloqueado: %v", err)
	}
	if err := l.Apply(Movement{Type: Unblock, DeltaMilli: -3001, Reason: "revisado"}); !errors.Is(err, ErrExceedsBlocked) {
		t.Fatalf("desbloquear más de lo bloqueado: %v", err)
	}
	// Baja de lo bloqueado = UNBLOCK + WRITE_OFF en el mismo lote de movimientos.
	if err := l.Apply(Movement{Type: Unblock, DeltaMilli: -1000, Reason: "dañado"}); err != nil {
		t.Fatal(err)
	}
	if err := l.Apply(Movement{Type: WriteOff, DeltaMilli: -1000, Reason: "dañado"}); err != nil {
		t.Fatal(err)
	}
	if l.OnHandMilli != 9000 || l.BlockedMilli != 2000 || l.Available() != 5000 {
		t.Fatalf("tras la baja de lo bloqueado: %+v", l)
	}
	if err := l.Apply(Movement{Type: Sale, DeltaMilli: -6000}); err != nil {
		t.Fatalf("la venta física pasa (R2): %v", err)
	}
	if l.Available() != -1000 {
		t.Fatalf("disponible tras la venta: %d", l.Available())
	}
}

func TestF16_10_BlockMovementsNeedReasonAndSign(t *testing.T) {
	for _, m := range []Movement{
		{Type: Block, DeltaMilli: 1000},
		{Type: Unblock, DeltaMilli: -1000},
	} {
		if !errors.Is(m.Validate(), ErrReasonRequired) {
			t.Fatalf("sin motivo: %+v", m)
		}
	}
	if !errors.Is(Movement{Type: Block, DeltaMilli: -1, Reason: "x"}.Validate(), ErrInvalidQty) ||
		!errors.Is(Movement{Type: Unblock, DeltaMilli: 1, Reason: "x"}.Validate(), ErrInvalidQty) {
		t.Fatal("signo de BLOCK (+) y UNBLOCK (−)")
	}
	if Block.Physical() || Unblock.Physical() || !WriteOff.Physical() {
		t.Fatal("BLOCK/UNBLOCK no son físicos")
	}
}

// F16.10: FEFO no toma lo bloqueado de un lote; «Vence pronto» según los días del comercio.
func TestF16_10_FEFOSkipsBlockedAndExpiresSoonWindow(t *testing.T) {
	today := time.Date(2026, 10, 22, 0, 0, 0, 0, time.UTC)
	d := func(n int) *time.Time { v := today.AddDate(0, 0, n); return &v }
	lots := []Lot{
		{ID: "a", Code: "A", ExpiresOn: d(5), OnHandMilli: 3000, BlockedMilli: 3000},
		{ID: "b", Code: "B", ExpiresOn: d(9), OnHandMilli: 3000, BlockedMilli: 1000},
	}
	allocs, rest := AllocateFEFO(lots, 4000, today, false)
	if len(allocs) != 1 || allocs[0].Lot.Code != "B" || allocs[0].Milli != 2000 || rest != 2000 {
		t.Fatalf("reparto: %+v resto %d", allocs, rest)
	}
	l := Lot{ExpiresOn: d(30)}
	if !l.ExpiresSoon(today, 30) || l.ExpiresSoon(today, 29) {
		t.Fatal("vence en 30 días: dentro de 30, fuera de 29")
	}
	if (Lot{ExpiresOn: d(-1)}).ExpiresSoon(today, 30) || (Lot{}).ExpiresSoon(today, 30) {
		t.Fatal("un vencido o sin vencimiento no «vence pronto»")
	}
	if (Settings{ExpiryAlertDays: 0}).Validate() == nil || (Settings{ExpiryAlertDays: 366}).Validate() == nil ||
		(Settings{ExpiryAlertDays: 30}).Validate() != nil {
		t.Fatal("días de aviso 1–365")
	}
}
