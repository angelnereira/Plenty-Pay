package authz

import "testing"

func TestOwnerHasBusinessModules(t *testing.T) {
	perms, features := ContextOf([]RoleKey{RoleOwner})
	if !HasPermission(perms, "pos", "write") || !HasPermission(perms, "settings", "write") {
		t.Fatal("OWNER debe tener pos.write y settings.write")
	}
	if !HasPermission(perms, "reports", "read") {
		t.Fatal("OWNER debe ver reportes financieros")
	}
	if len(features) == 0 {
		t.Fatal("OWNER debe tener features habilitadas")
	}
}

func TestCashierCannotSeeFinancialReports(t *testing.T) {
	// doc 00 §3.11: un cajero no tiene por qué ver los reportes financieros.
	perms, _ := ContextOf([]RoleKey{RoleCashier})
	if HasPermission(perms, "reports", "read") {
		t.Fatal("CASHIER NO debe tener reports.read (least privilege)")
	}
	if !HasPermission(perms, "pos", "write") {
		t.Fatal("CASHIER debe operar el POS")
	}
}

func TestConsumerSeesWalletOnly(t *testing.T) {
	perms, features := ContextOf([]RoleKey{RoleConsumer})
	if !HasPermission(perms, "wallet", "read") {
		t.Fatal("CONSUMER debe tener wallet.read")
	}
	if HasPermission(perms, "pos", "read") {
		t.Fatal("CONSUMER NO debe ver POS")
	}
	foundWallet := false
	for _, f := range features {
		if f.Key == "wallet" {
			foundWallet = true
		}
	}
	if !foundWallet {
		t.Fatal("CONSUMER debe tener feature wallet")
	}
}

func TestContextDeduplicatesUnion(t *testing.T) {
	// Usuario con dos roles: sin duplicados en permisos/features.
	perms, features := ContextOf([]RoleKey{RoleOwner, RoleConsumer})
	seenP := map[Permission]bool{}
	for _, p := range perms {
		if seenP[p] {
			t.Fatalf("permiso duplicado en unión: %+v", p)
		}
		seenP[p] = true
	}
	seenF := map[string]bool{}
	for _, f := range features {
		if seenF[f.Key] {
			t.Fatalf("feature duplicada en unión: %s", f.Key)
		}
		seenF[f.Key] = true
	}
}

func TestHasPermissionExactMatch(t *testing.T) {
	perms := []Permission{{Resource: "pos", Action: "write"}}
	if !HasPermission(perms, "pos", "write") {
		t.Fatal("match exacto debe ser true")
	}
	if HasPermission(perms, "pos", "read") {
		t.Fatal("acción distinta NO debe autorizar (least privilege)")
	}
}
