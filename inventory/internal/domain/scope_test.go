package domain

import "testing"

// ADR 0018 · R11: `*` = todas; lista = esas; ausente o basura = ninguna, nunca todas.
func TestADR0018_ScopeParsing(t *testing.T) {
	a, b := "018f0000-0000-7000-8000-0000000000a1", "018f0000-0000-7000-8000-0000000000b2"
	all := ParseBranchScope("*")
	if !all.Allows(a) || !all.Allows("") {
		t.Fatal("* alcanza todas, también la Casa Matriz sin asignar")
	}
	one := ParseBranchScope(" " + a + " , no-es-uuid ")
	if !one.Allows(a) || one.Allows(b) || one.Allows("") {
		t.Fatalf("lista: %+v", one)
	}
	for _, raw := range []string{"", "  ", "todas", "no-es-uuid"} {
		if sc := ParseBranchScope(raw); sc.All || sc.Allows(a) || sc.Allows("") {
			t.Fatalf("%q debe ser ninguna sucursal: %+v", raw, sc)
		}
	}
}
