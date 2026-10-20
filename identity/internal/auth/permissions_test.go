package auth

import (
	"fmt"
	"os"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"
)

func TestR10_ModulesDerivedFromPermissions(t *testing.T) {
	cases := map[string][]string{
		"CUSTOMER":       {"wallet", "marketplace"},
		"BUSINESS_STAFF": {"wallet", "marketplace"}, // deny-by-default: staff sin rol asignado recibe solo base
		"BUSINESS_OWNER": {"wallet", "marketplace", "pos", "catalog", "inventory", "orders", "logistics", "finance", "payroll", "analytics", "admin"},
		"PLATFORM_ADMIN": {"wallet", "marketplace", "orders", "logistics", "finance", "analytics", "admin", "platform"},
		"cashier":        {"wallet", "marketplace", "pos", "inventory", "finance", "payroll"},
		"stock_keeper":   {"wallet", "marketplace", "inventory", "payroll"},
		"courier":        {"wallet", "marketplace", "logistics", "payroll"},
		"accountant":     {"wallet", "marketplace", "finance", "payroll", "analytics"},
		"supervisor":     {"wallet", "marketplace", "pos", "payroll"},
		"viewer":         {"wallet", "marketplace", "inventory", "orders", "logistics", "finance", "payroll", "analytics"},
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

// R12: La semilla SQL de presets (migración 0005) debe ser idéntica al catálogo de presets en auth.
func TestR12_SQLSeedsMatchCatalog(t *testing.T) {
	content, err := os.ReadFile("../../migrations/0005_roles_and_invitations.up.sql")
	if err != nil {
		t.Fatalf("leer migración 0005: %v", err)
	}
	s := string(content)

	uuidToName := map[string]string{
		"00000000-0000-0000-0000-00000000ce01": "cashier",
		"00000000-0000-0000-0000-00000000ce02": "stock_keeper",
		"00000000-0000-0000-0000-00000000ce03": "manager",
		"00000000-0000-0000-0000-00000000ce04": "accountant",
		"00000000-0000-0000-0000-00000000ce05": "courier",
		"00000000-0000-0000-0000-00000000ce06": "viewer",
		"00000000-0000-0000-0000-00000000ce07": "supervisor",
	}

	for id, name := range uuidToName {
		pattern := fmt.Sprintf(`\('%s',\s*NULL,\s*'%s',\s*true\)`, id, name)
		re := regexp.MustCompile(pattern)
		if !re.MatchString(s) {
			t.Errorf("no se encontró inserción de rol %s (%s) en la migración SQL", name, id)
		}
	}

	blockRe := regexp.MustCompile(`(?s)ARRAY\[(.*?)\]\s*\)\s*AS p\s*WHERE r\.id = '([0-9a-f-]+)'::uuid`)
	matches := blockRe.FindAllStringSubmatch(s, -1)
	if len(matches) == 0 {
		t.Fatal("no se encontraron bloques de permisos de roles en la migración SQL")
	}

	sqlPermsByRole := map[string][]string{}
	permRe := regexp.MustCompile(`'([^']+)'`)

	for _, m := range matches {
		rawArray := m[1]
		uuid := m[2]
		roleName, ok := uuidToName[uuid]
		if !ok {
			t.Fatalf("UUID desconocido en migración SQL: %s", uuid)
		}
		var perms []string
		for _, pMatch := range permRe.FindAllStringSubmatch(rawArray, -1) {
			perms = append(perms, pMatch[1])
		}
		sort.Strings(perms)
		sqlPermsByRole[roleName] = perms
	}

	catalogPresets := Presets()
	if len(catalogPresets) != len(sqlPermsByRole) {
		t.Errorf("número de presets no coincide: catálogo=%d, SQL=%d", len(catalogPresets), len(sqlPermsByRole))
	}

	for role, expectedPerms := range catalogPresets {
		sqlPerms, ok := sqlPermsByRole[role]
		if !ok {
			t.Errorf("preset %s del catálogo no tiene permisos en SQL", role)
			continue
		}
		expectedSorted := make([]string, len(expectedPerms))
		copy(expectedSorted, expectedPerms)
		sort.Strings(expectedSorted)

		if !reflect.DeepEqual(sqlPerms, expectedSorted) {
			t.Errorf("discrepancia en preset %s:\n  SQL:      %v\n  Catálogo: %v", role, sqlPerms, expectedSorted)
		}
	}
}

