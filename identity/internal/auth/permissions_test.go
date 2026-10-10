package auth

import (
	"reflect"
	"strings"
	"testing"
)

func TestR10_ModulesDerivedFromPermissions(t *testing.T) {
	cases := map[string][]string{
		"CUSTOMER":       {"wallet", "marketplace"},
		"BUSINESS_STAFF": {"wallet", "marketplace", "pos", "inventory", "finance", "payroll"}, // preset cajero
		"BUSINESS_OWNER": {"wallet", "marketplace", "pos", "catalog", "inventory", "orders", "logistics", "finance", "payroll", "analytics", "admin"},
		"PLATFORM_ADMIN": {"wallet", "marketplace", "orders", "logistics", "finance", "analytics", "admin", "platform"},
		"courier":        {"wallet", "marketplace", "logistics", "payroll"},
	}
	for role, want := range cases {
		if got := ModulesForRole(role); !reflect.DeepEqual(got, want) {
			t.Errorf("%s: módulos = %v, se esperaba %v", role, got, want)
		}
	}
}

func TestR10_UnknownRoleHasNoModules(t *testing.T) {
	if got := ModulesForRole("HACKER"); len(got) != 0 {
		t.Fatalf("rol desconocido obtuvo módulos: %v", got)
	}
}

func TestR10_SelfOrderPermissionDoesNotEnableMerchantOrders(t *testing.T) {
	got := ModulesForPermissions([]string{"orders:read:self"})
	for _, m := range got {
		if m == "orders" {
			t.Fatal("orders:read:self activó el módulo de pedidos del comercio")
		}
	}
}

func TestR12_PresetsOnlyUseCatalogPermissions(t *testing.T) {
	for role, perms := range presets {
		for _, p := range perms {
			if !IsKnownPermission(p) {
				t.Errorf("preset %s usa permiso fuera del catálogo: %s", role, p)
			}
		}
	}
}

func TestR12_BusinessOwnerHasNoPlatformPermissions(t *testing.T) {
	for _, p := range PermissionsFor("BUSINESS_OWNER") {
		if strings.HasPrefix(p, "platform:") {
			t.Fatalf("BUSINESS_OWNER recibió %s", p)
		}
	}
}

func TestPermissionsForReturnsDefensiveCopy(t *testing.T) {
	a := PermissionsFor("CUSTOMER")
	a[0] = "mutado"
	if PermissionsFor("CUSTOMER")[0] == "mutado" {
		t.Fatal("PermissionsFor expone estado compartido")
	}
}
