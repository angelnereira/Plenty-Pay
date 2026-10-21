package domain

import "testing"

// R6: media ponderada exponencial con α = 0,3, en enteros.
func TestR6_Velocity(t *testing.T) {
	if Velocity(nil) != 0 {
		t.Fatal("sin datos")
	}
	// 10, 20 → 0,3·20 + 0,7·10 = 13; luego 0 → 0,7·13 = 9,1 → 9.
	if v := Velocity([]int64{10_000, 20_000, 0}); v != 9_100 {
		t.Fatalf("%d", v)
	}
	flat := make([]int64, VelocityWindowDays)
	for i := range flat {
		flat[i] = 2_000
	}
	if Velocity(flat) != 2_000 {
		t.Fatal("ventas constantes = esa velocidad")
	}
}

// R6: sugerir si la cobertura < plazo + 7; pedir para plazo + 14 menos disponible y en tránsito.
func TestR6_Suggest(t *testing.T) {
	// 2 unidades/día, 10 disponibles → 5 días; plazo 7 → 5 < 14: pedir 2×21 − 10 = 32.
	if cover, q := Suggest(10_000, 0, 2_000, 7); cover != 5 || q != 32_000 {
		t.Fatalf("%d %d", cover, q)
	}
	// Lo que ya viene en camino se descuenta.
	if _, q := Suggest(10_000, 30_000, 2_000, 7); q != 2_000 {
		t.Fatalf("en tránsito: %d", q)
	}
	// Cobertura suficiente: sin sugerencia.
	if cover, q := Suggest(40_000, 0, 2_000, 7); cover != 20 || q != 0 {
		t.Fatalf("%d %d", cover, q)
	}
	// Sin ventas: no se sugiere (lo cubre R7).
	if cover, q := Suggest(0, 0, 0, 7); cover != NoCover || q != 0 {
		t.Fatal("sin ventas")
	}
	// Se redondea a unidades enteras hacia arriba.
	if _, q := Suggest(0, 0, 1_500, 0); q != 21_000 {
		t.Fatalf("%d", q)
	}
}

// R6: clase ABC por su peso en lo vendido.
func TestR6_ABC(t *testing.T) {
	c := ClassifyABC(map[string]int64{"a": 700, "b": 150, "c": 100, "d": 50, "e": 0})
	want := map[string]string{"a": "A", "b": "A", "c": "B", "d": "C", "e": "C"}
	for k, v := range want {
		if c[k] != v {
			t.Fatalf("%s: %s, se esperaba %s (%v)", k, c[k], v, c)
		}
	}
}
