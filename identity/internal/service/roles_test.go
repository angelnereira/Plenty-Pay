package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/service"
)

// fakeRoleStore implementa store.RoleStore en memoria.
type fakeRoleStore struct {
	roles       map[string]*domain.Role
	userRoles   map[string]string // userID -> roleID
	invitations map[string]*domain.Invitation
	users       map[string]*domain.User
	failWith    error
}

func newFakeRoleStore() *fakeRoleStore {
	return &fakeRoleStore{
		roles: map[string]*domain.Role{
			"role-cashier": {ID: "role-cashier", Name: "cashier", System: true, Permissions: []string{"pos:sell"}},
		},
		userRoles:   map[string]string{},
		invitations: map[string]*domain.Invitation{},
		users:       map[string]*domain.User{},
	}
}

func (f *fakeRoleStore) CreateRole(_ context.Context, tenantID, name string, permissions []string) (*domain.Role, error) {
	if f.failWith != nil {
		return nil, f.failWith
	}
	for _, r := range f.roles {
		if r.Name == name && r.TenantID == tenantID {
			return nil, domain.ErrRoleNameTaken
		}
	}
	r := &domain.Role{ID: "role-" + name, TenantID: tenantID, Name: name, Permissions: permissions}
	f.roles[r.ID] = r
	return r, nil
}

func (f *fakeRoleStore) ListRoles(_ context.Context, tenantID string) ([]domain.Role, error) {
	var out []domain.Role
	for _, r := range f.roles {
		if r.System || r.TenantID == tenantID {
			out = append(out, *r)
		}
	}
	return out, nil
}

func (f *fakeRoleStore) AssignRole(_ context.Context, userID, roleID string) error {
	if f.failWith != nil {
		return f.failWith
	}
	f.userRoles[userID] = roleID
	return nil
}

func (f *fakeRoleStore) RoleForUser(_ context.Context, userID string) (*domain.Role, error) {
	if f.failWith != nil {
		return nil, f.failWith
	}
	roleID, ok := f.userRoles[userID]
	if !ok {
		return nil, nil
	}
	return f.roles[roleID], nil
}

func (f *fakeRoleStore) CreateInvitation(_ context.Context, tenantID, email, fullName, roleID, _ string) (string, time.Time, error) {
	token := "token-" + email
	f.invitations[token] = &domain.Invitation{
		ID: token, TenantID: tenantID, Email: email, FullName: fullName, RoleID: roleID,
		ExpiresAt: time.Now().UTC().Add(7 * 24 * time.Hour),
	}
	return token, f.invitations[token].ExpiresAt, nil
}

func (f *fakeRoleStore) AcceptInvitation(_ context.Context, token, passwordHash string) (*domain.User, *domain.Role, error) {
	inv, ok := f.invitations[token]
	if !ok {
		return nil, nil, domain.ErrInvitationNotFound
	}
	if err := inv.Acceptable(time.Now().UTC()); err != nil {
		return nil, nil, err
	}
	user := &domain.User{ID: "user-" + token, Email: inv.Email, FullName: inv.FullName,
		PasswordHash: passwordHash, Role: "BUSINESS_STAFF", TenantID: inv.TenantID}
	now := time.Now().UTC()
	inv.AcceptedAt = &now
	f.users[user.ID] = user
	role := f.roles[inv.RoleID]
	return user, role, nil
}

func (f *fakeRoleStore) ListUsers(_ context.Context, tenantID string) ([]domain.User, error) {
	var out []domain.User
	for _, u := range f.users {
		if u.TenantID == tenantID {
			out = append(out, *u)
		}
	}
	return out, nil
}

func (f *fakeRoleStore) DeactivateUser(_ context.Context, userID string) error {
	u, ok := f.users[userID]
	if !ok {
		return domain.ErrUserNotFound
	}
	owners := 0
	for _, other := range f.users {
		if other.TenantID == u.TenantID && other.Role == "BUSINESS_OWNER" {
			owners++
		}
	}
	if u.Role == "BUSINESS_OWNER" && owners <= 1 {
		return domain.ErrLastOwner
	}
	return nil
}

func roleService(t *testing.T) (*service.IdentityService, *fakeRoleStore) {
	t.Helper()
	svc, _, _ := serviceWithSessions(t)
	rs := newFakeRoleStore()
	svc.WithRoles(rs)
	return svc, rs
}

// R12: un rol personalizado no puede llevar permisos de plataforma.
func TestR12_UpsertRole_RejectsPlatformPermissions(t *testing.T) {
	svc, _ := roleService(t)
	_, err := svc.UpsertRole(context.Background(), "tenant-1", "Supervisor",
		[]string{"pos:sell", "platform:tenants:review"})
	if !errors.Is(err, domain.ErrPlatformPermission) {
		t.Fatalf("se esperaba ErrPlatformPermission, llego %v", err)
	}
}

// R12: un permiso fuera del catalogo se rechaza.
func TestR12_UpsertRole_RejectsUnknownPermission(t *testing.T) {
	svc, _ := roleService(t)
	_, err := svc.UpsertRole(context.Background(), "tenant-1", "Inventado", []string{"inventado:si"})
	if !errors.Is(err, domain.ErrUnknownPermission) {
		t.Fatalf("se esperaba ErrUnknownPermission, llego %v", err)
	}
}

// SPEC §4: los presets de sistema no son editables.
func TestR12_UpsertRole_PresetNotEditable(t *testing.T) {
	svc, _ := roleService(t)
	role, err := svc.UpsertRole(context.Background(), "tenant-1", "cashier", []string{"pos:sell"})
	if err != nil || role != nil {
		t.Fatalf("no deberia poder crearse un rol con nombre de preset: %v %+v", err, role)
	}
}

// Un rol personalizado valido se crea y aparece en el listado del tenant.
func TestF08_6_UpsertRoleValid(t *testing.T) {
	svc, _ := roleService(t)
	role, err := svc.UpsertRole(context.Background(), "tenant-1", "Supervisor",
		[]string{"pos:sell", "payments:read", "catalog:read"})
	if err != nil || role == nil {
		t.Fatalf("rol valido: %v %+v", err, role)
	}
	if role.System {
		t.Fatal("un rol del tenant no es de sistema")
	}
	if len(role.Permissions) != 3 {
		t.Fatalf("permisos: %v", role.Permissions)
	}
	list, err := svc.ListRoles(context.Background(), "tenant-1")
	if err != nil || len(list) != 2 { // preset + el nuevo
		t.Fatalf("ListRoles: %v %d", err, len(list))
	}
}

// Invitacion: expira a los 7 dias y el token solo viaja al invitador.
func TestF08_6_InviteStaffExpiresInSevenDays(t *testing.T) {
	svc, _ := roleService(t)
	res, err := svc.InviteStaff(context.Background(), "tenant-1", "cajero@example.com", "Cajero Uno", "role-cashier", "owner-1")
	if err != nil || !res.Success {
		t.Fatalf("InviteStaff: %v %+v", err, res)
	}
	if res.Token == "" {
		t.Fatal("el token debe devolverse al invitador (se guarda hasheado)")
	}
	if days := time.Until(res.ExpiresAt).Hours() / 24; days < 6.9 || days > 7.1 {
		t.Fatalf("la invitacion deberia vencer en 7 dias, venia en %.2f", days)
	}
}

// AcceptInvitation: crea el usuario BUSINESS_STAFF con su rol y sesion.
func TestF08_6_AcceptInvitation(t *testing.T) {
	svc, rs := roleService(t)
	inv, _ := svc.InviteStaff(context.Background(), "tenant-1", "nuevo@example.com", "Nuevo", "role-cashier", "owner-1")
	if err := svc.AssignRole(context.Background(), "user-nuevo@example.com", "role-cashier"); err != nil {
		t.Fatalf("AssignRole: %v", err)
	}

	res, err := svc.AcceptInvitation(context.Background(), inv.Token, "una-clave-muy-larga")
	if err != nil || !res.Success {
		t.Fatalf("AcceptInvitation: %v %+v", err, res)
	}
	if res.Role == nil || res.Role.Name != "cashier" {
		t.Fatalf("el staff deberia quedar con el rol invitado: %+v", res.Role)
	}
	if res.Session == nil || res.Session.AccessToken == "" {
		t.Fatal("aceptar la invitacion deberia devolver sesion")
	}
	// Token de un solo uso.
	again, err := svc.AcceptInvitation(context.Background(), inv.Token, "una-clave-muy-larga")
	if err != nil || again.Success {
		t.Fatalf("el token no deberia poder reusarse: %v %+v", err, again)
	}
	if rs.invitations[inv.Token].AcceptedAt == nil {
		t.Fatal("la invitacion deberia quedar marcada como aceptada")
	}
}

// AcceptInvitation con contrasena debil -> WEAK_PASSWORD y no se crea nada.
func TestF08_6_AcceptInvitation_WeakPassword(t *testing.T) {
	svc, _ := roleService(t)
	inv, _ := svc.InviteStaff(context.Background(), "tenant-1", "debil@example.com", "Debil", "role-cashier", "owner-1")
	res, err := svc.AcceptInvitation(context.Background(), inv.Token, "corta")
	if err != nil || res.Success || res.Reason != "WEAK_PASSWORD" {
		t.Fatalf("se esperaba WEAK_PASSWORD: %v %+v", err, res)
	}
}

// R13: el ultimo dueno del negocio no puede ser desactivado.
func TestR13_CannotDeactivateLastOwner(t *testing.T) {
	svc, rs := roleService(t)
	rs.users["owner-1"] = &domain.User{ID: "owner-1", Role: "BUSINESS_OWNER", TenantID: "tenant-1"}

	err := svc.DeactivateUser(context.Background(), "owner-1")
	if !errors.Is(err, domain.ErrLastOwner) {
		t.Fatalf("se esperaba ErrLastOwner, llego %v", err)
	}

	// Con un segundo dueno si se puede.
	rs.users["owner-2"] = &domain.User{ID: "owner-2", Role: "BUSINESS_OWNER", TenantID: "tenant-1"}
	if err := svc.DeactivateUser(context.Background(), "owner-1"); err != nil {
		t.Fatalf("con dos duenos deberia poder desactivarse: %v", err)
	}
}

// H10: InviteStaff no descarta el error de escritura en outbox (regla 14).
func TestH10_InviteStaff_OutboxErrorPropagates(t *testing.T) {
	svc, ss, _ := serviceWithSessions(t)
	rs := newFakeRoleStore()
	svc.WithRoles(rs)
	ss.failOutbox = errors.New("outbox write failure")

	inv, err := svc.InviteStaff(context.Background(), "tenant-1", "nuevo@example.com", "Nuevo", "role-cashier", "owner-1")
	if err == nil {
		t.Fatalf("se esperaba error de outbox pero fue exitoso: %+v", inv)
	}
}

