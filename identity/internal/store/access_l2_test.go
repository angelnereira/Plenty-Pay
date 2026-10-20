//go:build l2

// Pruebas L2 del modelo de acceso contra PostgreSQL real (F08.6 ampliado, ADR 0018):
// alta con membresía/sucursal/capacidades, sucursales con código DGI, capacidades con evento solo
// si cambian, invitaciones con alcance (H8: cuenta existente), membresías, estados de usuario con
// revocación de sesiones (R13) y aislamiento por tenant (RLS).
package store_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/store"
)

type accessL2 struct {
	st    *store.PostgresUserStore
	ts    *store.PostgresTenantStore
	rs    *store.PostgresRoleStore
	dsn   string
	owner *domain.User
	t     *domain.Tenant
}

// newAccessL2 crea un dueño y su negocio retail con capacidades derivadas del perfil.
func newAccessL2(t *testing.T) *accessL2 {
	t.Helper()
	st, dsn := newStore(t)
	f := &accessL2{st: st, ts: store.NewPostgresTenantStore(st.Pool()), rs: store.NewPostgresRoleStore(st.Pool()), dsn: dsn}
	ctx := context.Background()
	f.owner = newUser("dueno+" + uuid.NewString()[:8] + "@example.com")
	if err := st.Create(ctx, f.owner); err != nil {
		t.Fatalf("seed owner: %v", err)
	}
	t.Cleanup(func() { cleanupSession(t, dsn, f.owner.ID) })
	var caps []domain.CapabilityState
	for c, src := range auth.DeriveCapabilities("retail", nil, map[string]bool{"multi_branch": true}) {
		caps = append(caps, domain.CapabilityState{Capability: c, Enabled: true, Source: src})
	}
	f.t = &domain.Tenant{
		LegalName: "Acceso L2 S.A.", TradeName: "AL2", TaxID: "1557" + uuid.NewString()[:6] + "-2-2023", DV: "2", Country: "PA",
		PrimaryVertical: "retail", TraitOverrides: map[string]bool{"multi_branch": true}, PlanCode: "standard",
		BranchName: "Matriz L2", Capabilities: caps, CreatedAt: time.Now().UTC(),
	}
	if err := f.ts.CreateTenant(ctx, f.owner, f.t); err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	t.Cleanup(func() { cleanupTenant(t, dsn, f.t.ID) })
	f.owner.Role, f.owner.TenantID = "BUSINESS_OWNER", f.t.ID
	return f
}

// staff crea un BUSINESS_STAFF con membresía activa vía el canje de una invitación real.
func (f *accessL2) staff(t *testing.T, roleID, scope string, branchIDs []string) *domain.User {
	t.Helper()
	ctx := context.Background()
	inv, token, err := f.rs.CreateInvitation(ctx, &domain.Invitation{
		TenantID: f.t.ID, Email: "staff+" + uuid.NewString()[:8] + "@example.com", RoleID: roleID,
		InvitedBy: f.owner.ID, Scope: scope, BranchIDs: branchIDs, JobTitle: "Cajera",
	})
	if err != nil {
		t.Fatalf("CreateInvitation: %v", err)
	}
	hash, _ := auth.HashPassword("una-clave-muy-larga")
	u, err := f.rs.AcceptInvitation(ctx, token, "", hash)
	if err != nil {
		t.Fatalf("AcceptInvitation %s: %v", inv.Email, err)
	}
	t.Cleanup(func() { cleanupSession(t, f.dsn, u.ID) })
	return u
}

// outboxTypes devuelve los event_type del outbox de un agregado.
func outboxTypes(t *testing.T, dsn, aggregateID string) []string {
	t.Helper()
	pool := newVerificationPool(t, dsn)
	var out []string
	err := pgx.BeginTxFunc(context.Background(), pool, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(context.Background(), `SELECT set_config('app.actor_role', 'PLATFORM_ADMIN', true)`); err != nil {
			return err
		}
		rows, err := tx.Query(context.Background(), `SELECT event_type FROM outbox WHERE aggregate_id = $1::uuid ORDER BY created_at`, aggregateID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var e string
			if err := rows.Scan(&e); err != nil {
				return err
			}
			out = append(out, e)
		}
		return rows.Err()
	})
	if err != nil {
		t.Fatalf("leer outbox: %v", err)
	}
	return out
}

// R20/R24: el alta crea en una transacción la membresía de dueño TENANT, la sucursal 0000 y
// las capacidades del perfil, y publica el cambio de estado y la sucursal por outbox.
func TestL2_R20_CreateTenantSeedsAccessModel(t *testing.T) {
	f := newAccessL2(t)
	ctx := context.Background()

	m, err := f.rs.MembershipForUser(ctx, f.owner.ID)
	if err != nil || m == nil || m.BaseRole != "BUSINESS_OWNER" || m.Scope != domain.ScopeTenant || m.Status != "ACTIVE" {
		t.Fatalf("membresía del dueño: %v %+v", err, m)
	}
	branches, err := f.ts.ListBranches(ctx, f.t.ID, false)
	if err != nil || len(branches) != 1 || branches[0].Code != "0000" || branches[0].Name != "Matriz L2" {
		t.Fatalf("sucursal matriz: %v %+v", err, branches)
	}
	got, err := f.ts.GetTenant(ctx, f.t.ID)
	if err != nil || got.PrimaryVertical != "retail" || got.PlanCode != "standard" || !got.TraitOverrides["multi_branch"] {
		t.Fatalf("perfil: %v %+v", err, got)
	}
	if !slices.ContainsFunc(got.Capabilities, func(c domain.CapabilityState) bool { return c.Capability == "inventory.transfers" && c.Enabled }) {
		t.Fatalf("multi_branch enciende inventory.transfers: %+v", got.Capabilities)
	}
	if types := outboxTypes(t, f.dsn, branches[0].ID); !slices.Equal(types, []string{store.EventBranchChanged}) {
		t.Fatalf("evento de la sucursal matriz: %v", types)
	}
}

// R24: código DGI único por negocio, edición con versión y nunca sin sucursal activa.
func TestL2_R24_Branches(t *testing.T) {
	f := newAccessL2(t)
	ctx := context.Background()
	colon, err := f.ts.UpsertBranch(ctx, &domain.Branch{TenantID: f.t.ID, Code: "0001", Name: "Colón", LatitudeE6: 9358900})
	if err != nil || colon.Version != 1 || !colon.Active {
		t.Fatalf("crear sucursal: %v %+v", err, colon)
	}
	if _, err := f.ts.UpsertBranch(ctx, &domain.Branch{TenantID: f.t.ID, Code: "0001", Name: "Repetida"}); !errors.Is(err, domain.ErrBranchCodeTaken) {
		t.Fatalf("código repetido: %v", err)
	}
	colon.Name = "Colón 2000"
	edited, err := f.ts.UpsertBranch(ctx, colon)
	if err != nil || edited.Version != 2 || edited.Name != "Colón 2000" {
		t.Fatalf("editar sube la versión: %v %+v", err, edited)
	}
	branches, _ := f.ts.ListBranches(ctx, f.t.ID, false)
	var hq string
	for _, b := range branches {
		if b.Code == "0000" {
			hq = b.ID
		}
	}
	if _, err := f.ts.SetBranchActive(ctx, f.t.ID, colon.ID, false); err != nil {
		t.Fatalf("desactivar Colón: %v", err)
	}
	if _, err := f.ts.SetBranchActive(ctx, f.t.ID, hq, false); !errors.Is(err, domain.ErrCannotDeactivateLastBranch) {
		t.Fatalf("la única activa: %v", err)
	}
	if _, err := f.ts.SetBranchActive(ctx, f.t.ID, colon.ID, true); err != nil {
		t.Fatalf("reactivar: %v", err)
	}
	types := outboxTypes(t, f.dsn, colon.ID)
	if len(types) != 4 { // creada, editada, desactivada, reactivada
		t.Fatalf("eventos de la sucursal: %v", types)
	}

	// RLS + filtro: otro negocio no ve estas sucursales.
	other := newAccessL2(t)
	list, err := other.ts.ListBranches(ctx, other.t.ID, true)
	if err != nil || slices.ContainsFunc(list, func(b domain.Branch) bool { return b.ID == colon.ID }) {
		t.Fatalf("aislamiento entre negocios: %v %+v", err, list)
	}
	if _, err := other.ts.SetBranchActive(ctx, other.t.ID, colon.ID, false); !errors.Is(err, domain.ErrBranchNotFound) {
		t.Fatalf("operar sucursal ajena: %v", err)
	}
}

// R21: capacidades a mano (MANUAL) sobreviven al cambio de perfil; el evento solo se escribe si
// algo cambia.
func TestL2_R21_CapabilitiesAndProfile(t *testing.T) {
	f := newAccessL2(t)
	ctx := context.Background()
	before := len(outboxTypes(t, f.dsn, f.t.ID))

	got, err := f.ts.SetCapabilities(ctx, f.t.ID, map[string]bool{"logistics.own_fleet": true}, f.owner.ID)
	if err != nil {
		t.Fatalf("SetCapabilities: %v", err)
	}
	if !slices.ContainsFunc(got.Capabilities, func(c domain.CapabilityState) bool {
		return c.Capability == "logistics.own_fleet" && c.Enabled && c.Source == "MANUAL"
	}) {
		t.Fatalf("capacidad manual: %+v", got.Capabilities)
	}
	if _, err := f.ts.SetCapabilities(ctx, f.t.ID, map[string]bool{"logistics.own_fleet": true}, f.owner.ID); err != nil {
		t.Fatalf("repetir: %v", err)
	}
	if after := len(outboxTypes(t, f.dsn, f.t.ID)); after != before+1 {
		t.Fatalf("un evento por cambio real: antes %d, después %d", before, after)
	}

	derived := auth.DeriveCapabilities("food_and_beverage", nil, nil)
	got, err = f.ts.UpdateBusinessProfile(ctx, f.t.ID, "food_and_beverage", []string{}, map[string]bool{}, derived, f.owner.ID)
	if err != nil || got.PrimaryVertical != "food_and_beverage" || got.Version < 3 {
		t.Fatalf("UpdateBusinessProfile: %v %+v", err, got)
	}
	has := func(c string) bool {
		return slices.ContainsFunc(got.Capabilities, func(s domain.CapabilityState) bool { return s.Capability == c && s.Enabled })
	}
	if !has("pos.tables") || !has("logistics.own_fleet") || has("pos.loyalty") {
		t.Fatalf("perfil restaurante + logística manual, sin la lealtad de retail: %+v", got.Capabilities)
	}
}

// H8 + R22 + R24: la invitación guarda alcance y cargo; el canje crea la membresía con sus
// sucursales y sincroniza user_roles; una cuenta de cliente existente se vincula sin perder su clave.
func TestL2_H8_InvitationWithScopeAndExistingAccount(t *testing.T) {
	f := newAccessL2(t)
	ctx := context.Background()
	branches, _ := f.ts.ListBranches(ctx, f.t.ID, false)
	hq := branches[0].ID
	role, err := f.rs.UpsertRole(ctx, &domain.Role{TenantID: f.t.ID, Name: "Caja " + randSuffix(), Permissions: []string{"pos:sell"}, TemplateKey: "cashier", TemplateVersion: 1})
	if err != nil {
		t.Fatalf("UpsertRole: %v", err)
	}

	inv, token, err := f.rs.CreateInvitation(ctx, &domain.Invitation{
		TenantID: f.t.ID, Email: "Nuevo+" + randSuffix() + "@Example.com", RoleID: role.ID, InvitedBy: f.owner.ID,
		Scope: domain.ScopeBranches, BranchIDs: []string{hq}, JobTitle: "Cajera",
	})
	if err != nil {
		t.Fatalf("CreateInvitation: %v", err)
	}
	if days := time.Until(inv.ExpiresAt).Hours() / 24; days < 6.9 || days > 7.1 {
		t.Fatalf("vence en %.2f días", days)
	}
	found, err := f.rs.InvitationByToken(ctx, token)
	if err != nil || found.ID != inv.ID || found.Scope != domain.ScopeBranches || !slices.Equal(found.BranchIDs, []string{hq}) {
		t.Fatalf("InvitationByToken: %v %+v", err, found)
	}
	pending, err := f.rs.ListInvitations(ctx, f.t.ID)
	if err != nil || !slices.ContainsFunc(pending, func(i domain.Invitation) bool { return i.ID == inv.ID && i.RoleName == role.Name }) {
		t.Fatalf("ListInvitations: %v %+v", err, pending)
	}

	hash, _ := auth.HashPassword("una-clave-muy-larga")
	u, err := f.rs.AcceptInvitation(ctx, token, "", hash)
	if err != nil {
		t.Fatalf("AcceptInvitation: %v", err)
	}
	defer cleanupSession(t, f.dsn, u.ID)
	if u.Role != "BUSINESS_STAFF" || u.RoleID != role.ID || u.Scope != domain.ScopeBranches || u.JobTitle != "Cajera" {
		t.Fatalf("staff creado: %+v", u)
	}
	if _, err := f.rs.AcceptInvitation(ctx, token, "", hash); !errors.Is(err, domain.ErrInvitationUsed) {
		t.Fatalf("token de un solo uso: %v", err)
	}
	m, err := f.rs.MembershipForUser(ctx, u.ID)
	if err != nil || m == nil || !slices.Equal(m.BranchIDs, []string{hq}) {
		t.Fatalf("membresía con alcance: %v %+v", err, m)
	}
	assigned, err := f.rs.RoleForUser(ctx, u.ID)
	if err != nil || assigned == nil || assigned.ID != role.ID || !slices.Equal(assigned.Permissions, []string{"pos:sell"}) {
		t.Fatalf("R22: el rol asignado resuelve: %v %+v", err, assigned)
	}
	if !slices.Contains(outboxTypes(t, f.dsn, u.ID), store.EventMembershipChanged) {
		t.Fatal("aceptar escribe MembershipChanged")
	}

	// H8: un cliente con billetera acepta con su cuenta.
	customer := newUser("cliente+" + randSuffix() + "@example.com")
	if err := f.st.Create(ctx, customer); err != nil {
		t.Fatalf("seed customer: %v", err)
	}
	defer cleanupSession(t, f.dsn, customer.ID)
	_, token2, err := f.rs.CreateInvitation(ctx, &domain.Invitation{TenantID: f.t.ID, Email: customer.Email, RoleID: role.ID, InvitedBy: f.owner.ID})
	if err != nil {
		t.Fatalf("CreateInvitation existente: %v", err)
	}
	linked, err := f.rs.AcceptInvitation(ctx, token2, customer.ID, "")
	if err != nil || linked.ID != customer.ID || linked.Role != "BUSINESS_STAFF" {
		t.Fatalf("vincular cuenta existente: %v %+v", err, linked)
	}
	reloaded, err := f.st.FindByID(ctx, customer.ID)
	if err != nil || reloaded.PasswordHash != customer.PasswordHash || reloaded.TenantID != f.t.ID {
		t.Fatalf("la cuenta conserva su clave: %v %+v", err, reloaded)
	}
}

// R23/R24: UpdateMembership reemplaza rol, alcance y sucursales y mantiene user_roles; un rol
// con miembros no se archiva (ROLE_IN_USE).
func TestL2_R24_UpdateMembershipAndArchiveRole(t *testing.T) {
	f := newAccessL2(t)
	ctx := context.Background()
	branches, _ := f.ts.ListBranches(ctx, f.t.ID, false)
	role, err := f.rs.UpsertRole(ctx, &domain.Role{TenantID: f.t.ID, Name: "Caja " + randSuffix(), Permissions: []string{"pos:sell"}})
	if err != nil {
		t.Fatalf("UpsertRole: %v", err)
	}
	other, err := f.rs.UpsertRole(ctx, &domain.Role{TenantID: f.t.ID, Name: "Bodega " + randSuffix(), Permissions: []string{"inventory:read"}})
	if err != nil {
		t.Fatalf("UpsertRole: %v", err)
	}
	u := f.staff(t, role.ID, domain.ScopeTenant, nil)

	updated, err := f.rs.UpdateMembership(ctx, store.MembershipUpdate{
		TenantID: f.t.ID, UserID: u.ID, RoleID: other.ID, Scope: domain.ScopeBranches,
		BranchIDs: []string{branches[0].ID}, JobTitle: "Bodeguero", Change: store.ChangeRole,
	})
	if err != nil || updated.RoleID != other.ID || updated.Scope != domain.ScopeBranches || len(updated.BranchIDs) != 1 {
		t.Fatalf("UpdateMembership: %v %+v", err, updated)
	}
	assigned, err := f.rs.RoleForUser(ctx, u.ID)
	if err != nil || assigned.ID != other.ID {
		t.Fatalf("user_roles sincronizado: %v %+v", err, assigned)
	}
	if err := f.rs.ArchiveRole(ctx, f.t.ID, other.ID); !errors.Is(err, domain.ErrRoleInUse) {
		t.Fatalf("rol con miembros: %v", err)
	}
	if err := f.rs.ArchiveRole(ctx, f.t.ID, role.ID); err != nil {
		t.Fatalf("archivar rol sin miembros: %v", err)
	}
	if _, err := f.rs.RoleByID(ctx, f.t.ID, role.ID); !errors.Is(err, domain.ErrRoleNotFound) {
		t.Fatalf("un rol archivado no se asigna: %v", err)
	}
	listed, err := f.rs.ListRoles(ctx, f.t.ID)
	if err != nil || !slices.ContainsFunc(listed, func(r domain.Role) bool { return r.ID == other.ID && r.MemberCount == 1 }) {
		t.Fatalf("ListRoles con miembros: %v %+v", err, listed)
	}

	// Otro negocio no ve ni toca a este miembro.
	foreign := newAccessL2(t)
	if _, err := foreign.rs.UpdateMembership(ctx, store.MembershipUpdate{TenantID: foreign.t.ID, UserID: u.ID, Scope: domain.ScopeTenant}); !errors.Is(err, domain.ErrUserNotFound) {
		t.Fatalf("membresía ajena: %v", err)
	}
	team, err := foreign.rs.ListUsers(ctx, foreign.t.ID)
	if err != nil || slices.ContainsFunc(team, func(x domain.User) bool { return x.ID == u.ID }) {
		t.Fatalf("aislamiento del equipo: %v %+v", err, team)
	}
}

// R13 + R9: suspender revoca sesiones y escribe SessionRevoked; el último dueño activo no se da de baja.
func TestL2_R13_UserStatusRevokesSessionsAndKeepsAnOwner(t *testing.T) {
	f := newAccessL2(t)
	ctx := context.Background()
	role, err := f.rs.UpsertRole(ctx, &domain.Role{TenantID: f.t.ID, Name: "Caja " + randSuffix(), Permissions: []string{"pos:sell"}})
	if err != nil {
		t.Fatalf("UpsertRole: %v", err)
	}
	u := f.staff(t, role.ID, domain.ScopeTenant, nil)
	sessions := store.NewPostgresSessionStore(f.st.Pool())
	sess, err := sessions.CreateSession(ctx, u.ID)
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	if err := f.rs.SetUserStatus(ctx, f.t.ID, u.ID, domain.UserStatusSuspended); err != nil {
		t.Fatalf("suspender: %v", err)
	}
	got, err := sessions.SessionByID(ctx, sess.ID)
	if err != nil || !got.Revoked() {
		t.Fatalf("la sesión queda revocada: %v %+v", err, got)
	}
	if !slices.Contains(outboxTypes(t, f.dsn, u.ID), store.EventSessionRevoked) {
		t.Fatal("suspender escribe SessionRevoked (el gateway cierra el socket)")
	}
	reloaded, err := f.st.FindByID(ctx, u.ID)
	if err != nil || reloaded.Status != domain.UserStatusSuspended {
		t.Fatalf("estado del usuario: %v %+v", err, reloaded)
	}
	if err := f.rs.SetUserStatus(ctx, f.t.ID, u.ID, domain.UserStatusActive); err != nil {
		t.Fatalf("reactivar: %v", err)
	}
	if err := f.rs.SetUserStatus(ctx, f.t.ID, f.owner.ID, domain.UserStatusDeactivated); !errors.Is(err, domain.ErrLastOwner) {
		t.Fatalf("R13 último dueño: %v", err)
	}
}

// grpc-conventions §3 sobre PostgreSQL real: reserva única por (tenant, rpc, key), cierre con la
// respuesta, liberación de una ejecución fallida, aislamiento por tenant (RLS) y purga.
func TestL2_Idempotency_ReserveCompleteReleasePurge(t *testing.T) {
	f := newAccessL2(t)
	ctx := context.Background()
	st := store.NewPostgresIdempotencyStore(f.st.Pool())
	key := "l2-" + uuid.NewString()
	rpc := "/plentypay.identity.v1.Identity/UpsertBranch"
	hash := []byte("hash-1")

	if rec, err := st.Reserve(ctx, f.t.ID, rpc, key, hash); err != nil || rec != nil {
		t.Fatalf("primera reserva: %v %+v", err, rec)
	}
	rec, err := st.Reserve(ctx, f.t.ID, rpc, key, hash)
	if err != nil || rec == nil || rec.Done || string(rec.RequestHash) != "hash-1" {
		t.Fatalf("segunda reserva ve la primera en curso: %v %+v", err, rec)
	}
	if err := st.Complete(ctx, f.t.ID, rpc, key, []byte("resp")); err != nil {
		t.Fatalf("Complete: %v", err)
	}
	rec, err = st.Reserve(ctx, f.t.ID, rpc, key, hash)
	if err != nil || rec == nil || !rec.Done || string(rec.Response) != "resp" {
		t.Fatalf("tras completar: %v %+v", err, rec)
	}
	if err := st.Complete(ctx, f.t.ID, rpc, key, []byte("otra")); err == nil {
		t.Fatal("una clave DONE no se completa dos veces")
	}

	// Otro negocio con la misma clave reserva la suya.
	other := newAccessL2(t)
	if rec, err := st.Reserve(ctx, other.t.ID, rpc, key, hash); err != nil || rec != nil {
		t.Fatalf("aislamiento por tenant: %v %+v", err, rec)
	}
	if err := st.Release(ctx, other.t.ID, rpc, key); err != nil {
		t.Fatalf("Release: %v", err)
	}
	if rec, err := st.Reserve(ctx, other.t.ID, rpc, key, hash); err != nil || rec != nil {
		t.Fatalf("tras liberar se vuelve a reservar: %v %+v", err, rec)
	}

	if n, err := st.Purge(ctx, time.Now().UTC().Add(time.Minute)); err != nil || n < 2 {
		t.Fatalf("Purge: %v n=%d", err, n)
	}
}
