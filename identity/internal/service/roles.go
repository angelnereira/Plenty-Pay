package service

import (
	"context"
	"errors"
	"slices"
	"strings"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/store"
)

// RoleResult es el rol devuelto por el servicio.
type RoleResult struct {
	ID              string
	TenantID        string
	Name            string
	System          bool
	Permissions     []string
	TemplateKey     string
	TemplateVersion int32
	Description     string
	Version         int32
	Archived        bool
	MemberCount     int32
}

// RoleInput es el rol que crea (ID vacío) o edita el negocio.
type RoleInput struct {
	ID              string
	Name            string
	Description     string
	TemplateKey     string
	TemplateVersion int32
	Permissions     []string
}

// InviteInput es una invitación de staff con alcance y cargo (ADR 0018).
type InviteInput struct {
	Email     string
	FullName  string
	RoleID    string
	Scope     string
	BranchIDs []string
	JobTitle  string
}

// InviteResult es el resultado de invitar staff. El token NO viaja aquí: llega a la persona
// invitada por la solicitud de correo del outbox (se guarda solo su hash).
type InviteResult struct {
	Invitation *domain.Invitation
}

// AcceptResult es el resultado de canjear una invitacion.
type AcceptResult struct {
	Success      bool
	Reason       string
	ErrorMessage string
	UserID       string
	Session      *AuthResult
}

// MembershipInput es un cambio de membresía: vacío = no cambia; JobTitle "-" = borrar.
type MembershipInput struct {
	UserID    string
	RoleID    string
	Scope     string
	BranchIDs []string
	JobTitle  string
}

// presetNames son los roles de sistema: un rol del negocio no puede llamarse igual.
var presetNames = map[string]bool{
	"cashier": true, "stock_keeper": true, "manager": true,
	"accountant": true, "courier": true, "viewer": true, "supervisor": true,
}

// validateGrant aplica A1 (nadie concede lo que no tiene) sobre los permisos efectivos del actor.
func validateGrant(a *actor, perms []string) error {
	return domain.ValidateGrantablePermissions(a.User.Role, a.Access.Permissions, perms)
}

// validateScope aplica A3: el alcance no crece al delegar.
func validateScope(a *actor, scope string, branchIDs []string) error {
	actorScope, actorBranches := a.scope()
	return domain.ValidateScopeDelegation(actorScope, actorBranches, scope, branchIDs)
}

// addsMoney indica si next suma algún permiso de dinero que prev no tenía (🔒, security-standards.md §4).
func addsMoney(prev, next []string) bool {
	for _, p := range next {
		if auth.HasMoneyImpact(p) && !slices.Contains(prev, p) {
			return true
		}
	}
	return false
}

// UpsertRole crea o edita un rol del negocio (R12, A1, A2; step-up si suma permisos de dinero).
func (s *IdentityService) UpsertRole(ctx context.Context, in RoleInput) (*RoleResult, error) {
	a, err := s.requirePermission(ctx, "admin:roles:manage")
	if err != nil {
		return nil, err
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return nil, domain.ErrInvalidRequest
	}
	if presetNames[strings.ToLower(in.Name)] {
		return nil, domain.ErrPresetReadOnly
	}
	if err := domain.ValidateCustomRolePermissions(in.Permissions, auth.IsKnownPermission); err != nil {
		return nil, err
	}
	if err := validateGrant(a, in.Permissions); err != nil {
		return nil, err
	}
	var previous []string
	if in.ID != "" {
		// A2: nadie edita el rol que tiene asignado.
		if a.Membership != nil && a.Membership.RoleID == in.ID {
			return nil, domain.ErrSelfAssignmentForbidden
		}
		current, err := s.roles.RoleByID(ctx, a.TenantID, in.ID)
		if err != nil {
			return nil, err
		}
		if current.System {
			return nil, domain.ErrPresetReadOnly
		}
		previous = current.Permissions
	}
	if in.TemplateKey != "" && !slices.ContainsFunc(auth.RoleTemplates(nil), func(t auth.RoleTemplateEntry) bool { return t.Key == in.TemplateKey }) {
		return nil, domain.ErrInvalidRequest
	}
	if addsMoney(previous, in.Permissions) {
		if err := s.requireStepUp(ctx, a, OpRoleUpsert); err != nil {
			return nil, err
		}
	}
	role, err := s.roles.UpsertRole(ctx, &domain.Role{
		ID: in.ID, TenantID: a.TenantID, Name: in.Name, Description: strings.TrimSpace(in.Description),
		TemplateKey: in.TemplateKey, TemplateVersion: in.TemplateVersion, Permissions: in.Permissions,
	})
	if err != nil {
		return nil, err
	}
	return toRoleResult(role), nil
}

// ListRoles devuelve presets + roles del negocio del actor (lo necesita también quien invita).
func (s *IdentityService) ListRoles(ctx context.Context) ([]RoleResult, error) {
	a, err := s.requirePermission(ctx, "admin:roles:manage", "admin:users:manage")
	if err != nil {
		return nil, err
	}
	list, err := s.roles.ListRoles(ctx, a.TenantID)
	if err != nil {
		return nil, err
	}
	out := make([]RoleResult, 0, len(list))
	for i := range list {
		out = append(out, *toRoleResult(&list[i]))
	}
	return out, nil
}

// ArchiveRole archiva un rol sin miembros (ROLE_IN_USE si los tiene).
func (s *IdentityService) ArchiveRole(ctx context.Context, roleID string) error {
	a, err := s.requirePermission(ctx, "admin:roles:manage")
	if err != nil {
		return err
	}
	if roleID == "" {
		return domain.ErrInvalidRequest
	}
	return s.roles.ArchiveRole(ctx, a.TenantID, roleID)
}

// AssignRole es la ruta de compatibilidad: cambia solo el rol de la membresía.
func (s *IdentityService) AssignRole(ctx context.Context, userID, roleID string) (*domain.User, error) {
	if _, err := s.requirePermission(ctx, "admin:roles:manage"); err != nil {
		return nil, err
	}
	return s.updateMembership(ctx, MembershipInput{UserID: userID, RoleID: roleID}, "admin:roles:manage")
}

// UpdateMembership cambia rol, alcance y cargo de un miembro (A1, A2, A3; step-up si suma dinero).
func (s *IdentityService) UpdateMembership(ctx context.Context, in MembershipInput) (*domain.User, error) {
	return s.updateMembership(ctx, in, "admin:users:manage")
}

func (s *IdentityService) updateMembership(ctx context.Context, in MembershipInput, perm string) (*domain.User, error) {
	a, err := s.requirePermission(ctx, perm)
	if err != nil {
		return nil, err
	}
	target, err := s.manageableMember(ctx, a, in.UserID)
	if err != nil {
		return nil, err
	}
	next := store.MembershipUpdate{
		TenantID: a.TenantID, UserID: target.UserID, RoleID: target.RoleID,
		Scope: target.Scope, BranchIDs: target.BranchIDs, JobTitle: target.JobTitle, Change: store.ChangeUpdated,
	}
	var prevPerms, nextPerms []string
	if target.RoleID != "" {
		if r, err := s.roles.RoleByID(ctx, a.TenantID, target.RoleID); err == nil {
			prevPerms = r.Permissions
		} else if !errors.Is(err, domain.ErrRoleNotFound) {
			return nil, err
		}
	}
	nextPerms = prevPerms
	if in.RoleID != "" && in.RoleID != target.RoleID {
		role, err := s.roles.RoleByID(ctx, a.TenantID, in.RoleID)
		if err != nil {
			return nil, err
		}
		if err := validateGrant(a, role.Permissions); err != nil {
			return nil, err
		}
		next.RoleID, next.Change, nextPerms = role.ID, store.ChangeRole, role.Permissions
	}
	if in.Scope != "" {
		if err := validateScope(a, in.Scope, in.BranchIDs); err != nil {
			return nil, err
		}
		if err := s.validateBranchesInTenant(ctx, a.TenantID, in.BranchIDs); err != nil {
			return nil, err
		}
		if in.Scope != target.Scope || !sameSet(in.BranchIDs, target.BranchIDs) {
			if next.Change == store.ChangeUpdated {
				next.Change = store.ChangeScope
			}
		}
		next.Scope, next.BranchIDs = in.Scope, in.BranchIDs
		if in.Scope == domain.ScopeTenant {
			next.BranchIDs = nil
		}
	}
	switch in.JobTitle {
	case "":
	case "-":
		next.JobTitle = ""
	default:
		if err := domain.ValidateJobTitle(in.JobTitle); err != nil {
			return nil, err
		}
		next.JobTitle = strings.TrimSpace(in.JobTitle)
	}
	if addsMoney(prevPerms, nextPerms) {
		if err := s.requireStepUp(ctx, a, OpMembershipUpdate); err != nil {
			return nil, err
		}
	}
	return s.roles.UpdateMembership(ctx, next)
}

// manageableMember carga la membresía del miembro y aplica A2 (no a uno mismo), que sea del
// mismo negocio (NOT_FOUND si no, sin revelar existencia), que no sea el dueño y A3 (un actor
// con alcance BRANCHES solo gestiona a gente dentro de sus sucursales).
func (s *IdentityService) manageableMember(ctx context.Context, a *actor, userID string) (*domain.Membership, error) {
	if userID == "" {
		return nil, domain.ErrInvalidRequest
	}
	if err := domain.ValidateNotSelfAssignment(a.User.ID, userID); err != nil {
		return nil, err
	}
	m, err := s.roles.MembershipForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if m == nil || m.TenantID != a.TenantID {
		return nil, domain.ErrUserNotFound
	}
	if m.BaseRole == "BUSINESS_OWNER" {
		return nil, domain.ErrTargetIsOwner
	}
	if err := validateScope(a, m.Scope, m.BranchIDs); err != nil {
		return nil, err
	}
	return m, nil
}

// InviteStaff invita a una persona con rol, alcance y cargo (A1, A3; step-up si el rol mueve dinero).
// Vence a los 7 días (SPEC §4); el enlace llega por la solicitud de correo del outbox.
func (s *IdentityService) InviteStaff(ctx context.Context, in InviteInput) (*InviteResult, error) {
	a, err := s.requirePermission(ctx, "admin:users:manage")
	if err != nil {
		return nil, err
	}
	email := domain.NormalizeEmail(in.Email)
	if err := domain.ValidateEmail(email); err != nil {
		return nil, err
	}
	if in.RoleID == "" {
		return nil, domain.ErrRoleNotFound
	}
	role, err := s.roles.RoleByID(ctx, a.TenantID, in.RoleID)
	if err != nil {
		return nil, err
	}
	if err := validateGrant(a, role.Permissions); err != nil {
		return nil, err
	}
	scope := in.Scope
	if scope == "" {
		scope = domain.ScopeTenant
	}
	if err := validateScope(a, scope, in.BranchIDs); err != nil {
		return nil, err
	}
	branchIDs := in.BranchIDs
	if scope == domain.ScopeTenant {
		branchIDs = nil
	}
	if err := s.validateBranchesInTenant(ctx, a.TenantID, branchIDs); err != nil {
		return nil, err
	}
	if err := domain.ValidateJobTitle(in.JobTitle); err != nil {
		return nil, err
	}
	if auth.RoleHasMoneyImpact(role.Permissions) {
		if err := s.requireStepUp(ctx, a, OpStaffInvite); err != nil {
			return nil, err
		}
	}
	inv, token, err := s.roles.CreateInvitation(ctx, &domain.Invitation{
		TenantID: a.TenantID, Email: email, FullName: strings.TrimSpace(in.FullName), RoleID: role.ID,
		InvitedBy: a.User.ID, Scope: scope, BranchIDs: branchIDs, JobTitle: strings.TrimSpace(in.JobTitle),
	})
	if err != nil {
		return nil, err
	}
	inv.RoleName = role.Name
	if err := s.requestInvitationEmail(ctx, inv, token); err != nil {
		return nil, err
	}
	return &InviteResult{Invitation: inv}, nil
}

// requestInvitationEmail escribe la solicitud de correo con el enlace (SPEC §6; el mensaje
// notifications.SendRequest llega en F20.2). El token solo viaja en este evento.
func (s *IdentityService) requestInvitationEmail(ctx context.Context, inv *domain.Invitation, token string) error {
	if s.sessions == nil {
		return nil
	}
	if err := s.sessions.WriteOutboxEvent(ctx, "pp.identity.notification.requested.v1", inv.ID, inv.TenantID,
		notificationPayload(inv.InvitedBy, "STAFF_INVITED:"+token)); err != nil {
		return observability.Wrap(err, "write invitation notification")
	}
	return nil
}

// AcceptInvitation canjea el token (H8): quien ya tiene cuenta de cliente la conserva y entra con su
// contraseña actual; quien no, crea su cuenta de staff. Devuelve la sesión.
func (s *IdentityService) AcceptInvitation(ctx context.Context, token, password string) (*AcceptResult, error) {
	if s.roles == nil {
		return &AcceptResult{Reason: "INTERNAL", ErrorMessage: "error interno"}, nil
	}
	inv, err := s.roles.InvitationByToken(ctx, token)
	if err != nil {
		if errors.Is(err, domain.ErrInvitationNotFound) {
			return rejectAccept("TOKEN_INVALID", "invitacion no encontrada"), nil
		}
		return nil, err
	}
	if err := inv.Acceptable(s.now().UTC()); err != nil {
		return acceptError(err)
	}

	existing, err := s.users.FindByEmail(ctx, inv.Email)
	switch {
	case err == nil:
		if !auth.VerifyPassword(password, existing.PasswordHash) {
			return rejectAccept("INVALID_CREDENTIALS", "correo o contrasena incorrectos"), nil
		}
		if existing.Role != "CUSTOMER" || existing.TenantID != "" {
			return rejectAccept("ALREADY_HAS_TENANT", "esa cuenta ya pertenece a un negocio"), nil
		}
		if _, err := s.roles.AcceptInvitation(ctx, token, existing.ID, ""); err != nil {
			return acceptError(err)
		}
	case errors.Is(err, domain.ErrUserNotFound):
		if err := domain.ValidatePassword(password); err != nil {
			return rejectAccept("WEAK_PASSWORD", "la contrasena debe tener entre 12 y 128 caracteres"), nil
		}
		hash, err := auth.HashPassword(password)
		if err != nil {
			return nil, observability.Wrap(err, "hash password")
		}
		if _, err := s.roles.AcceptInvitation(ctx, token, "", hash); err != nil {
			return acceptError(err)
		}
	default:
		return nil, observability.Wrap(err, "find invited user")
	}

	user, err := s.users.FindByEmail(ctx, inv.Email)
	if err != nil {
		return nil, observability.Wrap(err, "reload accepted user")
	}
	session, err := s.issueTokens(ctx, user, s.startSession(ctx, user.ID))
	if err != nil {
		return nil, err
	}
	return &AcceptResult{Success: true, UserID: user.ID, Session: session}, nil
}

func rejectAccept(reason, message string) *AcceptResult {
	return &AcceptResult{Reason: reason, ErrorMessage: message}
}

// acceptError traduce los rechazos esperables del canje; el resto es un defecto.
func acceptError(err error) (*AcceptResult, error) {
	switch {
	case errors.Is(err, domain.ErrInvitationExpired):
		return rejectAccept("TOKEN_INVALID", "la invitacion vencio"), nil
	case errors.Is(err, domain.ErrInvitationUsed):
		return rejectAccept("ALREADY_USED", "la invitacion ya fue usada"), nil
	case errors.Is(err, domain.ErrInvitationNotFound):
		return rejectAccept("TOKEN_INVALID", "invitacion no encontrada"), nil
	case errors.Is(err, domain.ErrEmailTaken):
		return rejectAccept("EMAIL_TAKEN", "ese correo ya esta registrado"), nil
	case errors.Is(err, domain.ErrTenantAlreadyExists):
		return rejectAccept("ALREADY_HAS_TENANT", "esa cuenta ya pertenece a un negocio"), nil
	}
	return nil, observability.Wrap(err, "accept invitation")
}

// ListInvitations devuelve las invitaciones pendientes (o vencidas sin canjear) del negocio.
func (s *IdentityService) ListInvitations(ctx context.Context) ([]domain.Invitation, error) {
	a, err := s.requirePermission(ctx, "admin:users:manage")
	if err != nil {
		return nil, err
	}
	return s.roles.ListInvitations(ctx, a.TenantID)
}

// RevokeInvitation invalida el enlace de una invitación pendiente.
func (s *IdentityService) RevokeInvitation(ctx context.Context, invitationID string) error {
	a, err := s.requirePermission(ctx, "admin:users:manage")
	if err != nil {
		return err
	}
	if invitationID == "" {
		return domain.ErrInvalidRequest
	}
	return s.roles.RevokeInvitation(ctx, a.TenantID, invitationID)
}

// ResendInvitation emite un enlace nuevo (7 días) y vuelve a pedir el correo.
func (s *IdentityService) ResendInvitation(ctx context.Context, invitationID string) (*domain.Invitation, error) {
	a, err := s.requirePermission(ctx, "admin:users:manage")
	if err != nil {
		return nil, err
	}
	if invitationID == "" {
		return nil, domain.ErrInvalidRequest
	}
	inv, token, err := s.roles.ResendInvitation(ctx, a.TenantID, invitationID)
	if err != nil {
		return nil, err
	}
	if err := s.requestInvitationEmail(ctx, inv, token); err != nil {
		return nil, err
	}
	return inv, nil
}

// ListUsers devuelve el equipo del negocio del actor; con alcance BRANCHES, solo su gente (A3).
func (s *IdentityService) ListUsers(ctx context.Context) ([]domain.User, error) {
	a, err := s.requirePermission(ctx, "admin:users:manage")
	if err != nil {
		return nil, err
	}
	list, err := s.roles.ListUsers(ctx, a.TenantID)
	if err != nil {
		return nil, err
	}
	scope, mine := a.scope()
	if scope == domain.ScopeTenant {
		return list, nil
	}
	out := list[:0]
	for _, u := range list {
		if domain.ValidateScopeDelegation(scope, mine, u.Scope, u.BranchIDs) == nil {
			out = append(out, u)
		}
	}
	return out, nil
}

// SetUserStatus suspende, reactiva o da de baja a un miembro (A2, R13). Fuera de ACTIVE se revocan
// sus sesiones en la misma transacción.
func (s *IdentityService) SetUserStatus(ctx context.Context, userID, status string) error {
	a, err := s.requirePermission(ctx, "admin:users:manage")
	if err != nil {
		return err
	}
	if err := domain.ValidateNotSelfAssignment(a.User.ID, userID); err != nil {
		return err
	}
	m, err := s.roles.MembershipForUser(ctx, userID)
	if err != nil {
		return err
	}
	if m == nil || m.TenantID != a.TenantID {
		return domain.ErrUserNotFound
	}
	if m.BaseRole == "BUSINESS_OWNER" && !a.isOwner() {
		return domain.ErrTargetIsOwner // solo un dueño gestiona a otro dueño
	}
	if err := validateScope(a, m.Scope, m.BranchIDs); err != nil {
		return err
	}
	if err := s.roles.SetUserStatus(ctx, a.TenantID, userID, status); err != nil {
		return err
	}
	if status != domain.UserStatusActive {
		s.revoked.invalidateAlive() // R9: las sesiones revocadas dejan de valer ya, no en 15 s
	}
	return nil
}

// DeactivateUser da de baja a un miembro (R13: nunca al último dueño activo).
func (s *IdentityService) DeactivateUser(ctx context.Context, userID string) error {
	return s.SetUserStatus(ctx, userID, domain.UserStatusDeactivated)
}

func sameSet(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for _, x := range a {
		if !slices.Contains(b, x) {
			return false
		}
	}
	return true
}

func toRoleResult(r *domain.Role) *RoleResult {
	if r == nil {
		return nil
	}
	return &RoleResult{
		ID: r.ID, TenantID: r.TenantID, Name: r.Name, System: r.System, Permissions: r.Permissions,
		TemplateKey: r.TemplateKey, TemplateVersion: r.TemplateVersion, Description: r.Description,
		Version: r.Version, Archived: r.Archived, MemberCount: r.MemberCount,
	}
}
