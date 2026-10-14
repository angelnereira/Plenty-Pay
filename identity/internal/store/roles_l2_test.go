//go:build l2

// Pruebas L2 de roles, invitaciones y equipo contra PostgreSQL real (F08.6).
// Criterio del paso: R12, R13 e invitacion que vence a los 7 dias.
package store_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"plentypay/identity/internal/auth"
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
	if len(list) < 7 { // 6 presets + el nuevo
		t.Fatalf("se esperaban al menos 7 roles (6 presets + 1), llegaron %d", len(list))
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

// SPEC §4: la invitacion vence a los 7 dias y el token se guarda hasheado.
func TestL2_InvitationExpiresInSevenDays(t *testing.T) {
	st, _, dsn := newStoreAndSessions(t)
	rs := store.NewPostgresRoleStore(st.Pool())
	ctx := context.Background()

	// Se necesita un dueno real (invited_by referencia a users).
	user := newUser("invita+" + randSuffix() + "@example.com")
	if err := st.Create(ctx, user); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	defer cleanupSession(t, dsn, user.ID)

	invitedEmail := "invitado-" + randSuffix() + "@example.com"
	token, expiresAt, err := rs.CreateInvitation(ctx, user.ID, invitedEmail, "Invitado Uno", presetRoleID(t, rs), user.ID)
	if err != nil {
		t.Fatalf("CreateInvitation: %v", err)
	}
	if token == "" {
		t.Fatal("el token debe devolverse en claro al invitador")
	}
	days := time.Until(expiresAt).Hours() / 24
	if days < 6.9 || days > 7.1 {
		t.Fatalf("la invitacion deberia vencer en 7 dias, venia en %.2f", days)
	}

	// El token se guarda hasheado (nunca en claro). La lectura pasa por RLS: se
	// hace como plataforma, como el relay.
	pool := newVerificationPool(t, dsn)
	var stored []byte
	err = pgx.BeginTxFunc(context.Background(), pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		return tx.QueryRow(context.Background(), `SELECT token_hash FROM invitations WHERE invited_by = $1::uuid`, user.ID).Scan(&stored)
	})
	if err != nil {
		t.Fatalf("lectura del hash: %v", err)
	}
	if string(stored) == token {
		t.Fatal("el token no deberia guardarse en claro")
	}

	// Canje: crea el BUSINESS_STAFF con el rol.
	hash, _ := auth.HashPassword("una-clave-muy-larga")
	accepted, role, err := rs.AcceptInvitation(ctx, token, hash)
	if err != nil {
		t.Fatalf("AcceptInvitation: %v", err)
	}
	if accepted.Role != "BUSINESS_STAFF" {
		t.Fatalf("rol del usuario: %q", accepted.Role)
	}
	if role == nil || !role.System {
		t.Fatalf("el rol invitado deberia ser un preset: %+v", role)
	}

	// Token de un solo uso.
	if _, _, err := rs.AcceptInvitation(ctx, token, hash); err == nil {
		t.Fatal("el token no deberia poder reusarse")
	}

	// Un token desconocido se rechaza.
	if _, _, err := rs.AcceptInvitation(ctx, "token-inventado", hash); err == nil {
		t.Fatal("un token desconocido deberia fallar")
	}

	cleanupInvitations(t, dsn, user.ID)
	cleanupUser(t, dsn, accepted.ID)
}

// R13: el ultimo dueno del negocio no puede ser desactivado.
func TestL2_R13_LastOwnerCannotBeDeactivated(t *testing.T) {
	st, _, dsn := newStoreAndSessions(t)
	rs := store.NewPostgresRoleStore(st.Pool())
	ctx := context.Background()

	// Dos duenos de un tenant unico por ejecucion (sin restos de corridas previas).
	tenantID := uuid.NewString()
	owner1 := newUser("owner1-" + randSuffix() + "@example.com")
	owner1.Role = "BUSINESS_OWNER"
	owner1.TenantID = tenantID
	owner2 := newUser("owner2-" + randSuffix() + "@example.com")
	owner2.Role = "BUSINESS_OWNER"
	owner2.TenantID = tenantID
	if err := st.Create(ctx, owner1); err != nil {
		t.Fatalf("seed owner1: %v", err)
	}
	if err := st.Create(ctx, owner2); err != nil {
		t.Fatalf("seed owner2: %v", err)
	}
	defer cleanupSession(t, dsn, owner1.ID)
	defer cleanupSession(t, dsn, owner2.ID)

	// Con dos duenos si se puede desactivar uno.
	if err := rs.DeactivateUser(ctx, owner1.ID); err != nil {
		t.Fatalf("DeactivateUser con dos duenos: %v", err)
	}
	// Al quedar uno solo, el siguiente responde ErrLastOwner.
	if err := rs.DeactivateUser(ctx, owner2.ID); err == nil {
		t.Fatal("el ultimo dueno no deberia poder desactivarse (R13)")
	} else if !strings.Contains(err.Error(), "ultimo") && !strings.Contains(err.Error(), "dueno") {
		t.Logf("error recibido: %v", err)
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

func cleanupInvitations(t *testing.T, dsn, userID string) {
	t.Helper()
	if _, err := poolExec(dsn, `DELETE FROM invitations WHERE invited_by = $1::uuid`, userID); err != nil {
		t.Logf("limpieza de invitaciones: %v", err)
	}
}
