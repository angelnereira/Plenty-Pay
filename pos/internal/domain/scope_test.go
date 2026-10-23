package domain

import "testing"

// ADR 0018 · R15: `*` = todas (también lo anterior a sucursales); lista = esas; vacío = ninguna.
func TestADR0018_PosScopeParsing(t *testing.T) {
	a := "018f0000-0000-7000-8000-0000000000a1"
	if sc := ParseBranchScope("*"); !sc.All || !sc.Allows("") || sc.List() != nil {
		t.Fatalf("*: %+v", sc)
	}
	if sc := ParseBranchScope(a + ",basura"); sc.All || !sc.Allows(a) || sc.Allows("") || len(sc.List()) != 1 {
		t.Fatalf("lista: %+v", sc)
	}
	if sc := ParseBranchScope(""); sc.All || sc.Allows(a) || sc.List() == nil || len(sc.List()) != 0 {
		t.Fatalf("vacío = ninguna (lista vacía, no nil): %+v", sc)
	}
}
