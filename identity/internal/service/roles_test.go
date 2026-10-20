package service_test

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/service"
	"plentypay/identity/internal/store"
	"plentypay/identity/internal/tenancy"
)

// fakeRoleStore implementa store.RoleStore en memoria, enlazado al fakeStore de usuarios para
// que el canje de invitaciones cree o vincule cuentas igual que PostgreSQL.
type fakeRoleStore struct {
	roles       map[string]*domain.Role
	userRoles   map[string]string             // userID -> roleID (compatibilidad 0005)
	memberships map[string]*domain.Membership // por userID
	invitations map[string]*domain.Invitation // por token
	users       *fakeStore
	failWith    error
}

func newFakeRoleStore() *fakeRoleStore {
	return &fakeRoleStore{
		roles: map[string]*domain.Role{
			"role-cashier": {ID: "role-cashier", Name: "cashier", System: true, Permissions: auth.Presets()["cashier"]},
			"role-viewer":  {ID: "role-viewer", Name: "viewer", System: true, Permissions: auth.Presets()["viewer"]},
		},
		userRoles:   map[string]string{},
		memberships: map[string]*domain.Membership{},
		invitations: map[string]*domain.Invitation{},
		users:       newFakeStore(),
	}
}

func (f *fakeRoleStore) CreateRole(ctx context.Context, tenantID, name string, permissions []string) (*domain.Role, error) {
	return f.UpsertRole(ctx, &domain.Role{TenantID: tenantID, Name: name, Permissions: permissions})
}

func (f *fakeRoleStore) UpsertRole(_ context.Context, r *domain.Role) (*domain.Role, error) {
	if f.failWith != nil {
		return nil, f.failWith
	}
	for _, other := range f.roles {
		if strings.EqualFold(other.Name, r.Name) && other.TenantID == r.TenantID && other.ID != r.ID {
			return nil, domain.ErrRoleNameTaken
		}
	}
	out := *r
	if out.ID == "" {
		out.ID, out.Version = "role-"+r.Name, 1
	} else {
		current, ok := f.roles[out.ID]
		if !ok || current.TenantID != r.TenantID {
			return nil, domain.ErrRoleNotFound
		}
		out.Version = current.Version + 1
	}
	f.roles[out.ID] = &out
	cp := out
	return &cp, nil
}

func (f *fakeRoleStore) RoleByID(_ context.Context, tenantID, roleID string) (*domain.Role, error) {
	r, ok := f.roles[roleID]
	if !ok || r.Archived || (!r.System && r.TenantID != tenantID) {
		return nil, domain.ErrRoleNotFound
	}
	cp := *r
	return &cp, nil
}

func (f *fakeRoleStore) ArchiveRole(_ context.Context, tenantID, roleID string) error {
	r, ok := f.roles[roleID]
	if !ok || (!r.System && r.TenantID != tenantID) {
		return domain.ErrRoleNotFound
	}
	if r.System {
		return domain.ErrPresetReadOnly
	}
	for _, m := range f.memberships {
		if m.RoleID == roleID && m.Status == domain.UserStatusActive {
			return domain.ErrRoleInUse
		}
	}
	r.Archived = true
	return nil
}

func (f *fakeRoleStore) ListRoles(_ context.Context, tenantID string) ([]domain.Role, error) {
	var out []domain.Role
	for _, r := range f.roles {
		if !r.Archived && (r.System || r.TenantID == tenantID) {
			out = append(out, *r)
		}
	}
	return out, nil
}

func (f *fakeRoleStore) RoleForUser(_ context.Context, userID string) (*domain.Role, error) {
	if f.failWith != nil {
		return nil, f.failWith
	}
	roleID := f.userRoles[userID]
	if m, ok := f.memberships[userID]; ok && m.RoleID != "" {
		roleID = m.RoleID
	}
	r, ok := f.roles[roleID]
	if !ok {
		return nil, nil
	}
	return r, nil
}

func (f *fakeRoleStore) MembershipForUser(_ context.Context, userID string) (*domain.Membership, error) {
	m, ok := f.memberships[userID]
	if !ok {
		return nil, nil
	}
	cp := *m
	return &cp, nil
}

func (f *fakeRoleStore) UpdateMembership(_ context.Context, u store.MembershipUpdate) (*domain.User, error) {
	m, ok := f.memberships[u.UserID]
	if !ok || m.TenantID != u.TenantID {
		return nil, domain.ErrUserNotFound
	}
	m.RoleID, m.Scope, m.BranchIDs, m.JobTitle = u.RoleID, u.Scope, u.BranchIDs, u.JobTitle
	f.userRoles[u.UserID] = u.RoleID
	return &domain.User{ID: u.UserID, TenantID: u.TenantID, RoleID: u.RoleID, Scope: u.Scope, BranchIDs: u.BranchIDs, JobTitle: u.JobTitle}, nil
}

func (f *fakeRoleStore) CreateInvitation(_ context.Context, inv *domain.Invitation) (*domain.Invitation, string, error) {
	out := *inv
	out.ID = "inv-" + inv.Email
	out.CreatedAt = time.Now().UTC()
	out.ExpiresAt = out.CreatedAt.Add(store.InvitationTTL)
	token := "token-" + inv.Email
	f.invitations[token] = &out
	cp := out
	return &cp, token, nil
}

func (f *fakeRoleStore) InvitationByToken(_ context.Context, token string) (*domain.Invitation, error) {
	inv, ok := f.invitations[token]
	if !ok {
		return nil, domain.ErrInvitationNotFound
	}
	cp := *inv
	return &cp, nil
}

func (f *fakeRoleStore) AcceptInvitation(ctx context.Context, token, existingUserID, passwordHash string) (*domain.User, error) {
	inv, ok := f.invitations[token]
	if !ok {
		return nil, domain.ErrInvitationNotFound
	}
	if err := inv.Acceptable(time.Now().UTC()); err != nil {
		return nil, err
	}
	var user *domain.User
	if existingUserID != "" {
		user = f.users.byID[existingUserID]
		user.Role, user.TenantID = "BUSINESS_STAFF", inv.TenantID
	} else {
		user = &domain.User{ID: "user-" + inv.Email, Email: inv.Email, FullName: inv.FullName, PasswordHash: passwordHash,
			Role: "BUSINESS_STAFF", TenantID: inv.TenantID}
		if err := f.users.Create(ctx, user); err != nil {
			return nil, err
		}
	}
	f.memberships[user.ID] = &domain.Membership{UserID: user.ID, TenantID: inv.TenantID, BaseRole: "BUSINESS_STAFF",
		RoleID: inv.RoleID, Scope: inv.Scope, BranchIDs: inv.BranchIDs, JobTitle: inv.JobTitle, Status: domain.UserStatusActive}
	now := time.Now().UTC()
	inv.AcceptedAt = &now
	return user, nil
}

func (f *fakeRoleStore) ListInvitations(_ context.Context, tenantID string) ([]domain.Invitation, error) {
	var out []domain.Invitation
	for _, inv := range f.invitations {
		if inv.TenantID == tenantID && inv.AcceptedAt == nil && inv.RevokedAt == nil {
			out = append(out, *inv)
		}
	}
	return out, nil
}

func (f *fakeRoleStore) RevokeInvitation(_ context.Context, tenantID, invitationID string) error {
	for _, inv := range f.invitations {
		if inv.ID == invitationID && inv.TenantID == tenantID && inv.AcceptedAt == nil && inv.RevokedAt == nil {
			now := time.Now().UTC()
			inv.RevokedAt = &now
			return nil
		}
	}
	return domain.ErrInvitationNotFound
}

func (f *fakeRoleStore) ResendInvitation(_ context.Context, tenantID, invitationID string) (*domain.Invitation, string, error) {
	for token, inv := range f.invitations {
		if inv.ID == invitationID && inv.TenantID == tenantID && inv.AcceptedAt == nil && inv.RevokedAt == nil {
			delete(f.invitations, token)
			fresh := "token2-" + inv.Email
			inv.ExpiresAt = time.Now().UTC().Add(store.InvitationTTL)
			f.invitations[fresh] = inv
			cp := *inv
			return &cp, fresh, nil
		}
	}
	return nil, "", domain.ErrInvitationNotFound
}

func (f *fakeRoleStore) ListUsers(_ context.Context, tenantID string) ([]domain.User, error) {
	var out []domain.User
	for _, m := range f.memberships {
		if m.TenantID != tenantID {
			continue
		}
		u := domain.User{ID: m.UserID, TenantID: m.TenantID, Role: m.BaseRole, RoleID: m.RoleID, Scope: m.Scope,
			BranchIDs: m.BranchIDs, JobTitle: m.JobTitle, Status: m.Status}
		if full, ok := f.users.byID[m.UserID]; ok {
			u.Email, u.FullName = full.Email, full.FullName
		}
		out = append(out, u)
	}
	return out, nil
}

func (f *fakeRoleStore) SetUserStatus(_ context.Context, tenantID, userID, status string) error {
	m, ok := f.memberships[userID]
	if !ok || m.TenantID != tenantID {
		return domain.ErrUserNotFound
	}
	if status != domain.UserStatusActive && m.BaseRole == "BUSINESS_OWNER" {
		owners := 0
		for _, o := range f.memberships {
			if o.TenantID == tenantID && o.BaseRole == "BUSINESS_OWNER" && o.Status == domain.UserStatusActive {
				owners++
			}
		}
		if owners <= 1 {
			return domain.ErrLastOwner
		}
	}
	m.Status = status
	if u, ok := f.users.byID[userID]; ok {
		u.Status = status
	}
	return nil
}

var _ store.RoleStore = (*fakeRoleStore)(nil)

// ── Fixture del modelo de acceso ──────────────────────────────────────────────

const (
	tenantA  = "tenant-a"
	tenantB  = "tenant-b"
	branchHQ = "branch-0000"
	branchCo = "branch-colon"
	branchXX = "branch-otro-negocio"
)

type accessFixture struct {
	svc      *service.IdentityService
	users    *fakeStore
	roles    *fakeRoleStore
	tenants  *fakeTenantStore
	sessions *fakeSessionStore
	stepUp   *auth.StepUpManager
}

// newAccessFixture arma un negocio A (retail) con dueño, sucursales Casa Matriz y Colón, y un
// negocio B ajeno con su propia sucursal.
func newAccessFixture(t *testing.T) *accessFixture {
	t.Helper()
	fs := newFakeStore()
	rs := newFakeRoleStore()
	rs.users = fs
	ts := newFakeTenantStore()
	ss := newFakeSessionStore()
	stepUp := auth.NewStepUpManager()
	svc, _ := newService(fs)
	svc.WithSessions(ss).WithRoles(rs).WithTenants(ts).WithStepUp(stepUp)

	caps := []domain.CapabilityState{}
	for c, src := range auth.DeriveCapabilities("retail", nil, nil) {
		caps = append(caps, domain.CapabilityState{Capability: c, Enabled: true, Source: src})
	}
	ts.tenants[tenantA] = &domain.Tenant{ID: tenantA, PrimaryVertical: "retail", Status: domain.TenantActive, Capabilities: caps}
	ts.tenants[tenantB] = &domain.Tenant{ID: tenantB, PrimaryVertical: "retail", Status: domain.TenantActive, Capabilities: caps}
	ts.branches = map[string][]domain.Branch{
		tenantA: {{ID: branchHQ, TenantID: tenantA, Code: "0000", Name: "Casa Matriz", Active: true},
			{ID: branchCo, TenantID: tenantA, Code: "0001", Name: "Colón", Active: true}},
		tenantB: {{ID: branchXX, TenantID: tenantB, Code: "0000", Name: "Otra", Active: true}},
	}
	f := &accessFixture{svc: svc, users: fs, roles: rs, tenants: ts, sessions: ss, stepUp: stepUp}
	f.addMember(t, "owner-a", "BUSINESS_OWNER", tenantA, "", domain.ScopeTenant, nil)
	return f
}

// addMember crea una persona con membresía activa.
func (f *accessFixture) addMember(t *testing.T, id, baseRole, tenantID, roleID, scope string, branches []string) {
	t.Helper()
	u := &domain.User{ID: id, Email: id + "@example.com", Role: baseRole, TenantID: tenantID, Status: domain.UserStatusActive}
	if err := f.users.Create(context.Background(), u); err != nil {
		t.Fatalf("crear %s: %v", id, err)
	}
	f.roles.memberships[id] = &domain.Membership{UserID: id, TenantID: tenantID, BaseRole: baseRole, RoleID: roleID,
		Scope: scope, BranchIDs: branches, Status: domain.UserStatusActive}
}

// addRole guarda un rol del negocio A con los permisos dados.
func (f *accessFixture) addRole(id string, perms ...string) {
	f.roles.roles[id] = &domain.Role{ID: id, TenantID: tenantA, Name: id, Permissions: perms, Version: 1}
}

// as devuelve el contexto de la persona (lo que el gateway pone en x-pp-*).
func as(userID, tenantID string) context.Context {
	return tenancy.WithTenant(tenancy.WithUser(context.Background(), userID), tenantID)
}

// withStepUp agrega un token de confirmación fuerte válido para la operación.
func (f *accessFixture) withStepUp(ctx context.Context, userID, operation string) context.Context {
	id, _ := f.stepUp.IssueChallenge(userID, operation, 0, "")
	token, _, err := f.stepUp.VerifyChallenge(id, nil)
	if err != nil {
		panic(err)
	}
	return tenancy.WithStepUpToken(ctx, token)
}

// ── R12: roles del negocio ────────────────────────────────────────────────────

func TestR12_UpsertRole_RejectsPlatformPermissions(t *testing.T) {
	f := newAccessFixture(t)
	_, err := f.svc.UpsertRole(as("owner-a", tenantA), service.RoleInput{Name: "Encargado", Permissions: []string{"pos:sell", "platform:tenants:review"}})
	if !errors.Is(err, domain.ErrPlatformPermission) {
		t.Fatalf("se esperaba ErrPlatformPermission, llego %v", err)
	}
}

func TestR12_UpsertRole_RejectsUnknownPermission(t *testing.T) {
	f := newAccessFixture(t)
	_, err := f.svc.UpsertRole(as("owner-a", tenantA), service.RoleInput{Name: "Inventado", Permissions: []string{"inventado:si"}})
	if !errors.Is(err, domain.ErrUnknownPermission) {
		t.Fatalf("se esperaba ErrUnknownPermission, llego %v", err)
	}
}

func TestR12_UpsertRole_PresetNameReserved(t *testing.T) {
	f := newAccessFixture(t)
	_, err := f.svc.UpsertRole(as("owner-a", tenantA), service.RoleInput{Name: "Cashier", Permissions: []string{"pos:sell"}})
	if !errors.Is(err, domain.ErrPresetReadOnly) {
		t.Fatalf("se esperaba ErrPresetReadOnly, llego %v", err)
	}
}

func TestF08_6_UpsertRoleValidAndListed(t *testing.T) {
	f := newAccessFixture(t)
	ctx := as("owner-a", tenantA)
	role, err := f.svc.UpsertRole(ctx, service.RoleInput{Name: "Inventarista", TemplateKey: "stock_keeper", Permissions: []string{"inventory:read", "catalog:read"}})
	if err != nil {
		t.Fatalf("rol valido: %v", err)
	}
	if role.System || role.Version != 1 || role.TemplateKey != "stock_keeper" {
		t.Fatalf("rol creado: %+v", role)
	}
	list, err := f.svc.ListRoles(ctx)
	if err != nil || !slices.ContainsFunc(list, func(r service.RoleResult) bool { return r.ID == role.ID }) {
		t.Fatalf("ListRoles: %v %+v", err, list)
	}
	edited, err := f.svc.UpsertRole(ctx, service.RoleInput{ID: role.ID, Name: "Inventarista", Permissions: []string{"inventory:read"}})
	if err != nil || edited.Version != 2 {
		t.Fatalf("editar sube la version: %v %+v", err, edited)
	}
}

// R14: un rol que suma permisos de dinero exige step-up, y el token es de un solo uso (R15).
func TestR14_UpsertRole_MoneyPermissionsRequireStepUp(t *testing.T) {
	f := newAccessFixture(t)
	ctx := as("owner-a", tenantA)
	in := service.RoleInput{Name: "Reembolsos", Permissions: []string{"payments:refund"}}
	if _, err := f.svc.UpsertRole(ctx, in); !errors.Is(err, domain.ErrStepUpRequired) {
		t.Fatalf("sin step-up: %v", err)
	}
	if _, err := f.svc.UpsertRole(tenancy.WithStepUpToken(ctx, "inventado"), in); !errors.Is(err, domain.ErrStepUpInvalid) {
		t.Fatalf("token inventado: %v", err)
	}
	stepped := f.withStepUp(ctx, "owner-a", service.OpRoleUpsert)
	if _, err := f.svc.UpsertRole(stepped, in); err != nil {
		t.Fatalf("con step-up: %v", err)
	}
	in.Name = "Reembolsos 2"
	if _, err := f.svc.UpsertRole(stepped, in); !errors.Is(err, domain.ErrStepUpInvalid) {
		t.Fatalf("el token de step-up es de un solo uso: %v", err)
	}
}

func TestF08_6_ArchiveRoleInUse(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-mesero", "pos:sell")
	f.addMember(t, "staff-1", "BUSINESS_STAFF", tenantA, "role-mesero", domain.ScopeTenant, nil)
	if err := f.svc.ArchiveRole(as("owner-a", tenantA), "role-mesero"); !errors.Is(err, domain.ErrRoleInUse) {
		t.Fatalf("se esperaba ErrRoleInUse, llego %v", err)
	}
	f.addRole("role-libre", "pos:sell")
	if err := f.svc.ArchiveRole(as("owner-a", tenantA), "role-libre"); err != nil {
		t.Fatalf("archivar rol sin miembros: %v", err)
	}
}

// ── R23: reglas anti-escalada (V7, V8, V9) ────────────────────────────────────

// V8: nadie concede lo que no tiene (A1). Sin admin:roles:manage ni siquiera se entra.
func TestR23_CannotGrantUnheldPermission(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-gerente", "admin:roles:manage", "admin:users:manage", "pos:sell", "pos:void")
	f.addMember(t, "gerente", "BUSINESS_STAFF", tenantA, "role-gerente", domain.ScopeTenant, nil)
	ctx := f.withStepUp(as("gerente", tenantA), "gerente", service.OpRoleUpsert)

	_, err := f.svc.UpsertRole(ctx, service.RoleInput{Name: "Caja plus", Permissions: []string{"pos:sell", "payments:refund"}})
	if !errors.Is(err, domain.ErrPermissionNotHeld) {
		t.Fatalf("se esperaba PERMISSION_NOT_HELD, llego %v", err)
	}
	if _, err := f.svc.UpsertRole(ctx, service.RoleInput{Name: "Caja", Permissions: []string{"pos:sell"}}); err != nil {
		t.Fatalf("un subconjunto propio si se concede: %v", err)
	}
	// Invitar con un rol que excede lo propio también es A1.
	if _, err := f.svc.InviteStaff(as("gerente", tenantA), service.InviteInput{Email: "x@example.com", RoleID: "role-cashier"}); !errors.Is(err, domain.ErrPermissionNotHeld) {
		t.Fatalf("invitar con rol no poseido: %v", err)
	}

	f.addRole("role-sin-admin", "pos:sell")
	f.addMember(t, "cajero", "BUSINESS_STAFF", tenantA, "role-sin-admin", domain.ScopeTenant, nil)
	_, err = f.svc.UpsertRole(as("cajero", tenantA), service.RoleInput{Name: "Yo admin", Permissions: []string{"admin:roles:manage"}})
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("sin admin:roles:manage: %v", err)
	}
}

// V9: nadie se amplía a sí mismo (A2): ni su rol, ni su membresía, ni su estado.
func TestR23_NoSelfEscalation(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-gerente", "admin:roles:manage", "admin:users:manage", "pos:sell")
	f.addMember(t, "gerente", "BUSINESS_STAFF", tenantA, "role-gerente", domain.ScopeTenant, nil)
	ctx := as("gerente", tenantA)

	if _, err := f.svc.UpsertRole(ctx, service.RoleInput{ID: "role-gerente", Name: "role-gerente", Permissions: []string{"pos:sell"}}); !errors.Is(err, domain.ErrSelfAssignmentForbidden) {
		t.Fatalf("editar el rol propio: %v", err)
	}
	if _, err := f.svc.UpdateMembership(ctx, service.MembershipInput{UserID: "gerente", JobTitle: "Dueño"}); !errors.Is(err, domain.ErrSelfAssignmentForbidden) {
		t.Fatalf("editar la membresia propia: %v", err)
	}
	if err := f.svc.SetUserStatus(ctx, "gerente", domain.UserStatusSuspended); !errors.Is(err, domain.ErrSelfAssignmentForbidden) {
		t.Fatalf("suspenderse a si mismo: %v", err)
	}
}

// V7: el alcance no crece al delegar (A3).
func TestR23_ScopeCannotGrow(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-gerente", "admin:users:manage", "pos:sell", "pos:session:manage")
	f.addRole("role-caja", "pos:sell")
	f.addMember(t, "gerente-colon", "BUSINESS_STAFF", tenantA, "role-gerente", domain.ScopeBranches, []string{branchCo})
	ctx := as("gerente-colon", tenantA)

	_, err := f.svc.InviteStaff(ctx, service.InviteInput{Email: "todo@example.com", RoleID: "role-caja", Scope: domain.ScopeTenant})
	if !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("invitar con alcance TENANT: %v", err)
	}
	_, err = f.svc.InviteStaff(ctx, service.InviteInput{Email: "matriz@example.com", RoleID: "role-caja", Scope: domain.ScopeBranches, BranchIDs: []string{branchHQ}})
	if !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("invitar a una sucursal ajena: %v", err)
	}
	if len(f.roles.invitations) != 0 {
		t.Fatalf("no se debe crear ninguna invitacion: %v", f.roles.invitations)
	}
	res, err := f.svc.InviteStaff(ctx, service.InviteInput{Email: "colon@example.com", RoleID: "role-caja", Scope: domain.ScopeBranches, BranchIDs: []string{branchCo}, JobTitle: "Cajera"})
	if err != nil || res.Invitation.Scope != domain.ScopeBranches || !slices.Equal(res.Invitation.BranchIDs, []string{branchCo}) {
		t.Fatalf("invitar dentro de su alcance: %v %+v", err, res)
	}

	// Tampoco gestiona a quien está fuera de su alcance.
	f.addMember(t, "cajero-matriz", "BUSINESS_STAFF", tenantA, "role-caja", domain.ScopeBranches, []string{branchHQ})
	if err := f.svc.SetUserStatus(ctx, "cajero-matriz", domain.UserStatusSuspended); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("suspender fuera de su alcance: %v", err)
	}
	team, err := f.svc.ListUsers(ctx)
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	for _, u := range team {
		if u.ID == "cajero-matriz" || u.ID == "owner-a" {
			t.Fatalf("un gerente de Colón no ve a %s", u.ID)
		}
	}
}

// R24: una sucursal de otro negocio responde BRANCH_OUT_OF_SCOPE, sin revelar que existe.
func TestR24_ForeignBranchIsOutOfScope(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-caja", "pos:sell")
	_, err := f.svc.InviteStaff(as("owner-a", tenantA), service.InviteInput{Email: "x@example.com", RoleID: "role-caja", Scope: domain.ScopeBranches, BranchIDs: []string{branchXX}})
	if !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("sucursal de otro negocio: %v", err)
	}
}

// R22 + R24 en el servicio: el staff resuelve el rol asignado en su membresía y su alcance.
func TestR24_PermissionsCarryBranchScope(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-caja", "pos:sell", "payments:charge")
	f.addMember(t, "cajera", "BUSINESS_STAFF", tenantA, "role-caja", domain.ScopeBranches, []string{branchCo})
	perms, err := f.svc.PermissionsForUser(context.Background(), "cajera")
	if err != nil {
		t.Fatalf("PermissionsForUser: %v", err)
	}
	if perms.BranchScope != branchCo || !slices.Contains(perms.Permissions, "pos:sell") || slices.Contains(perms.Permissions, "pos:void") {
		t.Fatalf("permisos efectivos: %+v", perms)
	}
	if !slices.Contains(perms.Capabilities, "pos.counter") {
		t.Fatalf("capacidades del negocio: %v", perms.Capabilities)
	}
	owner, err := f.svc.PermissionsForUser(context.Background(), "owner-a")
	if err != nil || owner.BranchScope != auth.BranchScopeAll {
		t.Fatalf("el dueño tiene alcance TENANT: %v %+v", err, owner)
	}
}

// Un miembro suspendido pierde los permisos de negocio aunque su token siga firmado.
func TestR22_SuspendedMemberGetsBaseOnly(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-caja", "pos:sell")
	f.addMember(t, "cajera", "BUSINESS_STAFF", tenantA, "role-caja", domain.ScopeTenant, nil)
	if err := f.svc.SetUserStatus(as("owner-a", tenantA), "cajera", domain.UserStatusSuspended); err != nil {
		t.Fatalf("SetUserStatus: %v", err)
	}
	perms, err := f.svc.PermissionsForUser(context.Background(), "cajera")
	if err != nil || slices.Contains(perms.Permissions, "pos:sell") {
		t.Fatalf("suspendida conserva pos:sell: %v %+v", err, perms)
	}
}

// ── Equipo ────────────────────────────────────────────────────────────────────

// R13 y gobierno de dueños: solo un dueño da de baja a otro dueño, nadie a sí mismo, y el store
// nunca deja al negocio sin dueño activo (ErrLastOwner, defensa ante carreras).
func TestR13_CannotDeactivateLastOwner(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-gerente", "admin:users:manage")
	f.addMember(t, "gerente", "BUSINESS_STAFF", tenantA, "role-gerente", domain.ScopeTenant, nil)
	if err := f.svc.DeactivateUser(as("gerente", tenantA), "owner-a"); !errors.Is(err, domain.ErrTargetIsOwner) {
		t.Fatalf("un gerente no da de baja al dueño: %v", err)
	}
	if err := f.svc.DeactivateUser(as("owner-a", tenantA), "owner-a"); !errors.Is(err, domain.ErrSelfAssignmentForbidden) {
		t.Fatalf("el dueño no se da de baja a sí mismo: %v", err)
	}
	if err := f.roles.SetUserStatus(context.Background(), tenantA, "owner-a", domain.UserStatusDeactivated); !errors.Is(err, domain.ErrLastOwner) {
		t.Fatalf("el último dueño activo: %v", err)
	}
	f.addMember(t, "owner-2", "BUSINESS_OWNER", tenantA, "", domain.ScopeTenant, nil)
	if err := f.svc.DeactivateUser(as("owner-2", tenantA), "owner-a"); err != nil {
		t.Fatalf("con dos dueños, uno da de baja al otro: %v", err)
	}
}

// Un miembro de otro negocio responde NOT_FOUND (no se revela su existencia).
func TestF08_6_ForeignMemberIsNotFound(t *testing.T) {
	f := newAccessFixture(t)
	f.addMember(t, "ajeno", "BUSINESS_STAFF", tenantB, "", domain.ScopeTenant, nil)
	if err := f.svc.SetUserStatus(as("owner-a", tenantA), "ajeno", domain.UserStatusSuspended); !errors.Is(err, domain.ErrUserNotFound) {
		t.Fatalf("miembro ajeno: %v", err)
	}
	if _, err := f.svc.UpdateMembership(as("owner-a", tenantA), service.MembershipInput{UserID: "ajeno", JobTitle: "x"}); !errors.Is(err, domain.ErrUserNotFound) {
		t.Fatalf("membresia ajena: %v", err)
	}
}

// El tenant del metadato manda: un actor no opera otro negocio cambiando x-pp-tenant-id.
func TestF08_6_ContextTenantMustMatchActor(t *testing.T) {
	f := newAccessFixture(t)
	if _, err := f.svc.ListUsers(as("owner-a", tenantB)); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("tenant ajeno en el contexto: %v", err)
	}
	if _, err := f.svc.ListUsers(context.Background()); !errors.Is(err, domain.ErrUnauthenticated) {
		t.Fatalf("sin actor: %v", err)
	}
}

func TestF08_6_UpdateMembershipChangesRoleScopeAndTitle(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-caja", "pos:sell")
	f.addRole("role-bodega", "inventory:read")
	f.addMember(t, "staff-1", "BUSINESS_STAFF", tenantA, "role-caja", domain.ScopeTenant, nil)
	u, err := f.svc.UpdateMembership(as("owner-a", tenantA), service.MembershipInput{
		UserID: "staff-1", RoleID: "role-bodega", Scope: domain.ScopeBranches, BranchIDs: []string{branchCo}, JobTitle: "Bodeguero",
	})
	if err != nil || u.RoleID != "role-bodega" || u.Scope != domain.ScopeBranches || u.JobTitle != "Bodeguero" {
		t.Fatalf("UpdateMembership: %v %+v", err, u)
	}
	u, err = f.svc.UpdateMembership(as("owner-a", tenantA), service.MembershipInput{UserID: "staff-1", JobTitle: "-"})
	if err != nil || u.JobTitle != "" || u.RoleID != "role-bodega" {
		t.Fatalf("'-' borra el cargo y lo demás se conserva: %v %+v", err, u)
	}
	if _, err := f.svc.UpdateMembership(as("owner-a", tenantA), service.MembershipInput{UserID: "staff-1", JobTitle: strings.Repeat("x", 61)}); !errors.Is(err, domain.ErrInvalidJobTitle) {
		t.Fatalf("cargo de 61 caracteres: %v", err)
	}
	if _, err := f.svc.UpdateMembership(as("owner-a", tenantA), service.MembershipInput{UserID: "owner-a"}); !errors.Is(err, domain.ErrSelfAssignmentForbidden) {
		t.Fatalf("el dueño editándose: %v", err)
	}
}

// R14: dar a alguien un rol que suma dinero pide step-up.
func TestR14_UpdateMembershipAddingMoneyRequiresStepUp(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-lectura", "catalog:read")
	f.addMember(t, "staff-1", "BUSINESS_STAFF", tenantA, "role-lectura", domain.ScopeTenant, nil)
	ctx := as("owner-a", tenantA)
	if _, err := f.svc.UpdateMembership(ctx, service.MembershipInput{UserID: "staff-1", RoleID: "role-cashier"}); !errors.Is(err, domain.ErrStepUpRequired) {
		t.Fatalf("sin step-up: %v", err)
	}
	if _, err := f.svc.UpdateMembership(f.withStepUp(ctx, "owner-a", service.OpMembershipUpdate), service.MembershipInput{UserID: "staff-1", RoleID: "role-cashier"}); err != nil {
		t.Fatalf("con step-up: %v", err)
	}
}

// ── Invitaciones ──────────────────────────────────────────────────────────────

// La invitación vence a los 7 días y el token NUNCA vuelve al invitador: viaja solo en la
// solicitud de correo del outbox.
func TestF08_6_InviteStaffTokenOnlyInOutbox(t *testing.T) {
	f := newAccessFixture(t)
	res, err := f.svc.InviteStaff(f.withStepUp(as("owner-a", tenantA), "owner-a", service.OpStaffInvite),
		service.InviteInput{Email: "Cajero@Example.com", RoleID: "role-cashier", FullName: "Cajero Uno"})
	if err != nil {
		t.Fatalf("InviteStaff: %v", err)
	}
	if days := time.Until(res.Invitation.ExpiresAt).Hours() / 24; days < 6.9 || days > 7.1 {
		t.Fatalf("vence en %.2f dias", days)
	}
	if strings.Contains(res.Invitation.ID, "token") {
		t.Fatalf("el id de la invitación no es el token: %s", res.Invitation.ID)
	}
	if len(f.sessions.payloads) != 1 || !strings.Contains(f.sessions.payloads[0], "token-cajero@example.com") {
		t.Fatalf("el token debe viajar en la solicitud de correo: %v", f.sessions.payloads)
	}
}

// R14: invitar con un rol que mueve dinero (cajero cobra) pide step-up.
func TestR14_InviteMoneyRoleRequiresStepUp(t *testing.T) {
	f := newAccessFixture(t)
	if _, err := f.svc.InviteStaff(as("owner-a", tenantA), service.InviteInput{Email: "c@example.com", RoleID: "role-cashier"}); !errors.Is(err, domain.ErrStepUpRequired) {
		t.Fatalf("sin step-up: %v", err)
	}
}

func TestF08_6_AcceptInvitationCreatesStaffWithSession(t *testing.T) {
	f := newAccessFixture(t)
	if _, err := f.svc.InviteStaff(as("owner-a", tenantA), service.InviteInput{Email: "nuevo@example.com", RoleID: "role-viewer", Scope: domain.ScopeBranches, BranchIDs: []string{branchCo}}); err != nil {
		t.Fatalf("InviteStaff: %v", err)
	}
	res, err := f.svc.AcceptInvitation(context.Background(), "token-nuevo@example.com", "una-clave-muy-larga")
	if err != nil || !res.Success || res.Session == nil || res.Session.AccessToken == "" {
		t.Fatalf("AcceptInvitation: %v %+v", err, res)
	}
	perms, err := f.svc.PermissionsForUser(context.Background(), res.UserID)
	if err != nil || perms.BranchScope != branchCo || !slices.Contains(perms.Permissions, "analytics:read") {
		t.Fatalf("el staff queda con su rol y su alcance: %v %+v", err, perms)
	}
	again, err := f.svc.AcceptInvitation(context.Background(), "token-nuevo@example.com", "una-clave-muy-larga")
	if err != nil || again.Success || again.Reason != "ALREADY_USED" {
		t.Fatalf("token de un solo uso: %v %+v", err, again)
	}
}

func TestF08_6_AcceptInvitation_WeakPassword(t *testing.T) {
	f := newAccessFixture(t)
	if _, err := f.svc.InviteStaff(as("owner-a", tenantA), service.InviteInput{Email: "debil@example.com", RoleID: "role-viewer"}); err != nil {
		t.Fatalf("InviteStaff: %v", err)
	}
	res, err := f.svc.AcceptInvitation(context.Background(), "token-debil@example.com", "corta")
	if err != nil || res.Success || res.Reason != "WEAK_PASSWORD" {
		t.Fatalf("se esperaba WEAK_PASSWORD: %v %+v", err, res)
	}
}

// H8: quien ya tiene cuenta de cliente acepta con su contraseña y conserva su cuenta.
func TestH8_AcceptInvitation_ExistingCustomerKeepsAccount(t *testing.T) {
	f := newAccessFixture(t)
	hash, err := auth.HashPassword("clave-del-cliente-123")
	if err != nil {
		t.Fatal(err)
	}
	customer := &domain.User{ID: "cliente-1", Email: "cliente@example.com", PasswordHash: hash, Role: "CUSTOMER", Status: domain.UserStatusActive}
	if err := f.users.Create(context.Background(), customer); err != nil {
		t.Fatal(err)
	}
	if _, err := f.svc.InviteStaff(as("owner-a", tenantA), service.InviteInput{Email: "cliente@example.com", RoleID: "role-viewer"}); err != nil {
		t.Fatalf("InviteStaff: %v", err)
	}
	wrong, err := f.svc.AcceptInvitation(context.Background(), "token-cliente@example.com", "otra-clave-cualquiera")
	if err != nil || wrong.Success || wrong.Reason != "INVALID_CREDENTIALS" {
		t.Fatalf("clave equivocada: %v %+v", err, wrong)
	}
	res, err := f.svc.AcceptInvitation(context.Background(), "token-cliente@example.com", "clave-del-cliente-123")
	if err != nil || !res.Success || res.UserID != "cliente-1" {
		t.Fatalf("aceptar con la cuenta existente: %v %+v", err, res)
	}
	if customer.Role != "BUSINESS_STAFF" || customer.TenantID != tenantA || customer.PasswordHash != hash {
		t.Fatalf("la cuenta se vincula sin perder su clave: %+v", customer)
	}
}

func TestF08_6_RevokeAndResendInvitation(t *testing.T) {
	f := newAccessFixture(t)
	ctx := as("owner-a", tenantA)
	res, err := f.svc.InviteStaff(ctx, service.InviteInput{Email: "r@example.com", RoleID: "role-viewer"})
	if err != nil {
		t.Fatalf("InviteStaff: %v", err)
	}
	if _, err := f.svc.ResendInvitation(ctx, res.Invitation.ID); err != nil {
		t.Fatalf("Resend: %v", err)
	}
	if len(f.sessions.payloads) != 2 || !strings.Contains(f.sessions.payloads[1], "token2-r@example.com") {
		t.Fatalf("reenviar pide otro correo con token nuevo: %v", f.sessions.payloads)
	}
	if err := f.svc.RevokeInvitation(ctx, res.Invitation.ID); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
	if err := f.svc.RevokeInvitation(ctx, res.Invitation.ID); !errors.Is(err, domain.ErrInvitationNotFound) {
		t.Fatalf("revocar dos veces: %v", err)
	}
	accepted, err := f.svc.AcceptInvitation(context.Background(), "token2-r@example.com", "una-clave-muy-larga")
	if err != nil || accepted.Success {
		t.Fatalf("una invitación revocada no se canjea: %v %+v", err, accepted)
	}
}

// H10 + regla 14: un fallo del outbox no se descarta.
func TestH10_InviteStaff_OutboxErrorPropagates(t *testing.T) {
	f := newAccessFixture(t)
	f.sessions.failOutbox = errors.New("outbox write failure")
	if _, err := f.svc.InviteStaff(as("owner-a", tenantA), service.InviteInput{Email: "n@example.com", RoleID: "role-viewer"}); err == nil {
		t.Fatal("se esperaba el error del outbox")
	}
}

// ── Perfil, capacidades y sucursales ──────────────────────────────────────────

func TestR20_UpdateBusinessProfile(t *testing.T) {
	f := newAccessFixture(t)
	ctx := as("owner-a", tenantA)
	v, err := f.svc.UpdateBusinessProfile(ctx, service.ProfileInput{PrimaryVertical: "RESTAURANT", TraitAnswers: map[string]bool{"recipes": false}})
	if err != nil || v.PrimaryVertical != "food_and_beverage" {
		t.Fatalf("UpdateBusinessProfile: %v %+v", err, v)
	}
	if slices.ContainsFunc(v.Capabilities, func(c domain.CapabilityState) bool { return c.Capability == "inventory.recipes" }) {
		t.Fatal("recipes=false no deja inventory.recipes encendida")
	}
	if _, err := f.svc.UpdateBusinessProfile(ctx, service.ProfileInput{PrimaryVertical: "farmacia"}); !errors.Is(err, domain.ErrVerticalNotFound) {
		t.Fatalf("vertical desconocida: %v", err)
	}
	if _, err := f.svc.UpdateBusinessProfile(ctx, service.ProfileInput{PrimaryVertical: "retail", SecondaryVerticals: []string{"RESTAURANT", "BARBERSHOP", "COURIER"}}); !errors.Is(err, domain.ErrTooManyVerticals) {
		t.Fatalf("tres secundarias: %v", err)
	}
	if _, err := f.svc.UpdateBusinessProfile(ctx, service.ProfileInput{PrimaryVertical: "retail", TraitAnswers: map[string]bool{"inventado": true}}); !errors.Is(err, domain.ErrUnknownTrait) {
		t.Fatalf("rasgo desconocido: %v", err)
	}
}

// R21: apagar una capacidad quita sus permisos al instante; Q-32 impide encender comisiones.
func TestR21_SetCapabilities(t *testing.T) {
	f := newAccessFixture(t)
	ctx := as("owner-a", tenantA)
	if _, err := f.svc.SetCapabilities(ctx, map[string]bool{"inventory.stock": false}); err != nil {
		t.Fatalf("apagar inventario: %v", err)
	}
	perms, err := f.svc.PermissionsForUser(context.Background(), "owner-a")
	if err != nil || slices.Contains(perms.Permissions, "inventory:adjust") || slices.Contains(perms.Permissions, "inventory:read") ||
		!slices.Contains(perms.Permissions, "inventory:receive") /* inventory.purchasing sigue encendida */ {
		t.Fatalf("inventario apagado: %v %+v", err, perms)
	}
	if _, err := f.svc.SetCapabilities(ctx, map[string]bool{"payroll.commissions": true}); !errors.Is(err, domain.ErrCapabilityGated) {
		t.Fatalf("Q-32 abierta: %v", err)
	}
	if _, err := f.svc.SetCapabilities(ctx, map[string]bool{"inventada": true}); !errors.Is(err, domain.ErrUnknownCapability) {
		t.Fatalf("capacidad desconocida: %v", err)
	}
	if _, err := f.svc.SetCapabilities(ctx, map[string]bool{"finance.payments": false}); !errors.Is(err, domain.ErrStepUpRequired) {
		t.Fatalf("apagar finanzas pide step-up: %v", err)
	}
	if _, err := f.svc.SetCapabilities(f.withStepUp(ctx, "owner-a", service.OpCapabilitiesSet), map[string]bool{"finance.payments": false}); err != nil {
		t.Fatalf("apagar finanzas con step-up: %v", err)
	}
}

func TestR24_Branches(t *testing.T) {
	f := newAccessFixture(t)
	ctx := as("owner-a", tenantA)
	if _, err := f.svc.UpsertBranch(ctx, domain.Branch{Code: "12", Name: "Mal"}); !errors.Is(err, domain.ErrInvalidBranchCode) {
		t.Fatalf("código de 2 dígitos: %v", err)
	}
	if _, err := f.svc.UpsertBranch(ctx, domain.Branch{Code: "0001", Name: "Repetida"}); !errors.Is(err, domain.ErrBranchCodeTaken) {
		t.Fatalf("código repetido: %v", err)
	}
	b, err := f.svc.UpsertBranch(ctx, domain.Branch{Code: "0002", Name: " David "})
	if err != nil || b.TenantID != tenantA || b.Name != "David" {
		t.Fatalf("crear sucursal: %v %+v", err, b)
	}

	f.addRole("role-gerente", "admin:business:manage")
	f.addMember(t, "gerente-colon", "BUSINESS_STAFF", tenantA, "role-gerente", domain.ScopeBranches, []string{branchCo})
	list, err := f.svc.ListBranches(as("gerente-colon", tenantA), false)
	if err != nil || len(list) != 1 || list[0].ID != branchCo {
		t.Fatalf("con alcance BRANCHES solo ve las suyas: %v %+v", err, list)
	}
	if _, err := f.svc.UpsertBranch(as("gerente-colon", tenantA), domain.Branch{Code: "0003", Name: "Nueva"}); !errors.Is(err, domain.ErrBranchOutOfScope) {
		t.Fatalf("crear sucursales exige alcance TENANT: %v", err)
	}

	for _, id := range []string{branchCo, b.ID} {
		if _, err := f.svc.SetBranchActive(ctx, id, false); err != nil {
			t.Fatalf("desactivar %s: %v", id, err)
		}
	}
	if _, err := f.svc.SetBranchActive(ctx, branchHQ, false); !errors.Is(err, domain.ErrCannotDeactivateLastBranch) {
		t.Fatalf("la última activa: %v", err)
	}
}

// V1: una cuenta sin negocio recibe solo la base aunque su rol base guardado sea BUSINESS_OWNER
// (p. ej. un registro público que aún no completó CreateBusiness).
func TestR10_OwnerWithoutTenantGetsBaseOnly(t *testing.T) {
	f := newAccessFixture(t)
	u := &domain.User{ID: "sin-negocio", Email: "sin@example.com", Role: "BUSINESS_OWNER", Status: domain.UserStatusActive}
	if err := f.users.Create(context.Background(), u); err != nil {
		t.Fatal(err)
	}
	perms, err := f.svc.PermissionsForUser(context.Background(), u.ID)
	if err != nil {
		t.Fatalf("PermissionsForUser: %v", err)
	}
	if !slices.Equal(perms.EnabledModules, []string{"wallet", "marketplace"}) || perms.BranchScope != "" || len(perms.Capabilities) != 0 {
		t.Fatalf("sin negocio: %+v", perms)
	}
}

// La ruta de lectura (ValidateToken/GetUserPermissions) usa la caché de 15 s; una mutación de
// acceso de esta instancia la vacía al instante.
func TestR22_AccessCacheInvalidatedByMutation(t *testing.T) {
	f := newAccessFixture(t)
	f.addRole("role-caja", "pos:sell")
	f.addMember(t, "cajera", "BUSINESS_STAFF", tenantA, "role-caja", domain.ScopeTenant, nil)
	if p, err := f.svc.PermissionsForUser(context.Background(), "cajera"); err != nil || !slices.Contains(p.Permissions, "pos:sell") {
		t.Fatalf("primera lectura: %v %+v", err, p)
	}
	// Cambio por fuera del servicio (otra réplica): dentro del TTL se sigue viendo el valor cacheado.
	f.roles.roles["role-caja"].Permissions = []string{"catalog:read"}
	if p, _ := f.svc.PermissionsForUser(context.Background(), "cajera"); !slices.Contains(p.Permissions, "pos:sell") {
		t.Fatal("dentro del TTL se sirve la caché")
	}
	// Una mutación de acceso en esta instancia la vacía.
	if err := f.svc.SetUserStatus(as("owner-a", tenantA), "cajera", domain.UserStatusSuspended); err != nil {
		t.Fatal(err)
	}
	if p, _ := f.svc.PermissionsForUser(context.Background(), "cajera"); slices.Contains(p.Permissions, "pos:sell") {
		t.Fatalf("tras la mutación se recalcula: %+v", p)
	}
}

// Con TTL 0 la caché queda desactivada (cada lectura recalcula).
func TestR22_AccessCacheDisabled(t *testing.T) {
	f := newAccessFixture(t)
	f.svc.WithAccessCacheTTL(0)
	f.addRole("role-caja", "pos:sell")
	f.addMember(t, "cajera", "BUSINESS_STAFF", tenantA, "role-caja", domain.ScopeTenant, nil)
	if _, err := f.svc.PermissionsForUser(context.Background(), "cajera"); err != nil {
		t.Fatal(err)
	}
	f.roles.roles["role-caja"].Permissions = []string{"catalog:read"}
	if p, _ := f.svc.PermissionsForUser(context.Background(), "cajera"); slices.Contains(p.Permissions, "pos:sell") {
		t.Fatal("sin caché se ve el cambio al instante")
	}
}
