//go:build l2

// Pruebas L2 de roles, invitaciones y equipo contra PostgreSQL real (F08.6).
// Criterio del paso: R12, R13 e invitacion que vence a los 7 dias.
package store_test

import (
	"context"
	"testing"
	"time"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/store"
)

// R12: un rol personalizado con permisos del catalogo se crea; con platform:*,
// el servicio ni siquiera llega al store (lo rechaza el dominio). Aqui se
// verifica que el store persiste solo lo valido y que el listado mezcla
// presets y roles del tenant.
func TestL2_R12_RolesForTenant(t *testing.T) {
	st, _, _ := newStoreAndSessions(t)
	rs := store.NewPostgresRoleStore(st.Pool())
	ctx := context.Background()

	// El rol se crea para un tenant arbitrario (los usuarios de prueba son de
	// otros tenants; el store de roles no depende de ellos).
	tenantID := "11111111-1111-1111-1111-111111111111"
	role, err := rs.CreateRole(ctx, tenantID, "Supervisor-"+randSuffix(),
		[]string{"pos:sell", "payments:read", "catalog:read"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}

	list, err := rs.ListRoles(ctx, tenantID)
	if err != nil {
		t.Fatalf("ListRoles: %v", err)
	}
	if len(list) < 8 { // 7 presets + el nuevo
		t.Fatalf("se esperaban al menos 8 roles (7 presets + 1), llegaron %d", len(list))
	}
	var found *domain.Role
	for i := range list {
		if list[i].ID == role.ID {
			found = &list[i]
		}
	}
	if found == nil {
		t.Fatal("el rol creado no aparece en el listado del tenant")
	}
	if found.System {
		t.Fatal("un rol del tenant no es de sistema")
	}
	if len(found.Permissions) != 3 {
		t.Fatalf("permisos persistidos: %v", found.Permissions)
	}

	// Limpieza.
	cleanupRole(t, st, role.ID)
}

// R12: el nombre de rol es unico por tenant.
func TestL2_R12_RoleNameUnique(t *testing.T) {
	st, _, _ := newStoreAndSessions(t)
	rs := store.NewPostgresRoleStore(st.Pool())
	ctx := context.Background()
	tenantID := "22222222-2222-2222-2222-222222222222"
	name := "Duplicado-" + randSuffix()

	role, err := rs.CreateRole(ctx, tenantID, name, []string{"pos:sell"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	defer cleanupRole(t, st, role.ID)

	if _, err := rs.CreateRole(ctx, tenantID, name, []string{"catalog:read"}); err == nil {
		t.Fatal("no deberia permitirse dos roles con el mismo nombre en el tenant")
	}
}

func randSuffix() string {
	n := time.Now().UTC().UnixNano()
	s := ""
	for n > 0 && len(s) < 6 {
		s += string(rune('a' + n%26))
		n /= 26
	}
	return s
}

func presetRoleID(t *testing.T, rs *store.PostgresRoleStore) string {
	t.Helper()
	list, err := rs.ListRoles(context.Background(), "")
	if err != nil || len(list) == 0 {
		t.Fatalf("ListRoles: %v", err)
	}
	for _, r := range list {
		if r.System && r.Name == "cashier" {
			return r.ID
		}
	}
	return list[0].ID
}

func cleanupRole(t *testing.T, st *store.PostgresUserStore, roleID string) {
	t.Helper()
	if _, err := poolExec(dsnOf(t), `DELETE FROM roles WHERE id = $1::uuid`, roleID); err != nil {
		t.Logf("limpieza del rol: %v", err)
	}
}
