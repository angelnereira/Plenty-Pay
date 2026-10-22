package domain

import (
	"errors"
	"testing"
	"time"
)

func day(s string) *time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return &t
}

// R5 (F16.4): FEFO toma primero lo que vence antes, deja al final lo que no vence, desempata por
// código y nunca vende de un lote vencido.
func TestR5_FEFOAllocationOrderAndExpiredLots(t *testing.T) {
	today := *day("2026-10-21")
	lots := []Lot{
		{Code: "SIN-VENC", OnHandMilli: 5000},
		{Code: "B-NOV", ExpiresOn: day("2026-11-30"), OnHandMilli: 3000},
		{Code: "A-NOV", ExpiresOn: day("2026-11-30"), OnHandMilli: 1000},
		{Code: "VENCIDO", ExpiresOn: day("2026-10-20"), OnHandMilli: 9000},
		{Code: "HOY", ExpiresOn: day("2026-10-21"), OnHandMilli: 2000},
		{Code: "VACIO", ExpiresOn: day("2026-10-25"), OnHandMilli: 0},
	}
	got, rest := AllocateFEFO(lots, 7500, today, false)
	want := []struct {
		code  string
		milli int64
	}{{"HOY", 2000}, {"A-NOV", 1000}, {"B-NOV", 3000}, {"SIN-VENC", 1500}}
	if rest != 0 || len(got) != len(want) {
		t.Fatalf("reparto %+v resto %d", got, rest)
	}
	for i, w := range want {
		if got[i].Lot.Code != w.code || got[i].Milli != w.milli {
			t.Fatalf("paso %d: %s %d; quiero %s %d", i, got[i].Lot.Code, got[i].Milli, w.code, w.milli)
		}
	}
	// Sin lotes suficientes queda un resto; un ajuste puede incluir el vencido (desecharlo).
	if _, rest := AllocateFEFO(lots, 20000, today, false); rest != 9000 {
		t.Fatalf("resto sin vencidos: %d", rest)
	}
	got, rest = AllocateFEFO(lots, 9000, today, true)
	if rest != 0 || got[0].Lot.Code != "VENCIDO" || got[0].Milli != 9000 {
		t.Fatalf("con vencidos: %+v %d", got, rest)
	}
}

// R5: un lote vence al terminar su día en Panamá, no a las 00:00 UTC.
func TestR5_ExpiryIsJudgedInPanama(t *testing.T) {
	lot := Lot{ExpiresOn: day("2026-10-21")}
	// 2026-10-22 03:00 UTC = 2026-10-21 22:00 en Panamá: aún no vence.
	if lot.Expired(Today(time.Date(2026, 10, 22, 3, 0, 0, 0, time.UTC))) {
		t.Fatal("vence el 21 en Panamá, todavía es 21")
	}
	if !lot.Expired(Today(time.Date(2026, 10, 22, 6, 0, 0, 0, time.UTC))) {
		t.Fatal("ya es 22 en Panamá")
	}
}

func TestR5_LotCodeFormat(t *testing.T) {
	if c, err := NormalizeLotCode("  L-2026/11.A "); err != nil || c != "L-2026/11.A" {
		t.Fatal(c, err)
	}
	for _, bad := range []string{"", "con espacio", "ñ", "123456789012345678901234567890123456789012"} {
		if _, err := NormalizeLotCode(bad); !errors.Is(err, ErrInvalidLot) {
			t.Fatalf("%q aceptado", bad)
		}
	}
}

// DateOnly no corre el día al normalizar dos veces; el instante del contrato (00:00 en Panamá =
// 05:00 UTC) da su propio día.
func TestR5_DateOnlyIsIdempotent(t *testing.T) {
	pure := *day("2026-11-30")
	if got := DateOnly(DateOnly(pure)); !got.Equal(pure) {
		t.Fatalf("normalizar dos veces: %v", got)
	}
	if got := DateOnly(time.Date(2026, 11, 30, 5, 0, 0, 0, time.UTC)); !got.Equal(pure) {
		t.Fatalf("00:00 en Panamá: %v", got)
	}
}
