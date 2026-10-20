package service

import (
	"context"
	"errors"
	"time"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
)

// RoleResult es el rol devuelto por el servicio.
type RoleResult struct {
	ID          string
	TenantID    string
	Name        string
	System      bool
	Permissions []string
}

// InviteResult es el resultado de invitar staff.
type InviteResult struct {
	Success      bool
	Reason       string
	ErrorMessage string
	InvitationID string
	ExpiresAt    time.Time
	// Token solo viaja en la respuesta al invitador (se guarda hasheado).
	Token string
}

// AcceptResult es el resultado de canjear una invitacion.
type AcceptResult struct {
	Success      bool
	Reason       string
	ErrorMessage string
	UserID       string
	Role         *RoleResult
	Session      *AuthResult
}

// presetNames son los roles de sistema: no se pueden crear con ese nombre
// (SPEC §4 UpsertRole: los presets no son editables).
var presetNames = map[string]bool{
	"cashier": true, "stock_keeper": true, "manager": true,
	"accountant": true, "courier": true, "viewer": true, "supervisor": true,
}

// UpsertRole crea un rol personalizado del tenant (R12).
func (s *IdentityService) UpsertRole(ctx context.Context, tenantID, name string, permissions []string) (*RoleResult, error) {
	if s.roles == nil {
		return nil, nil
	}
	if name == "" {
		return nil, nil
	}
	if presetNames[name] {
		return nil, nil // preset de sistema: no editable
	}
	if err := domain.ValidateCustomRolePermissions(permissions, auth.IsKnownPermission); err != nil {
		return nil, err
	}
	role, err := s.roles.CreateRole(ctx, tenantID, name, permissions)
	if err != nil {
		if errors.Is(err, domain.ErrRoleNameTaken) {
			return nil, err
		}
		return nil, err
	}
	return toRoleResult(role), nil
}

// ListRoles devuelve presets + roles del tenant.
func (s *IdentityService) ListRoles(ctx context.Context, tenantID string) ([]RoleResult, error) {
	if s.roles == nil {
		return nil, nil
	}
	list, err := s.roles.ListRoles(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := make([]RoleResult, 0, len(list))
	for i := range list {
		out = append(out, *toRoleResult(&list[i]))
	}
	return out, nil
}

// AssignRole asigna un rol a un usuario del tenant.
func (s *IdentityService) AssignRole(ctx context.Context, userID, roleID string) error {
	if s.roles == nil {
		return nil
	}
	return s.roles.AssignRole(ctx, userID, roleID)
}

// InviteStaff invita a una persona al equipo (SPEC §4: 7 dias).
func (s *IdentityService) InviteStaff(ctx context.Context, tenantID, email, fullName, roleID, invitedBy string) (*InviteResult, error) {
	if s.roles == nil {
		return &InviteResult{ErrorMessage: "error interno"}, nil
	}
	if email == "" || roleID == "" {
		return &InviteResult{Reason: "INVALID_REQUEST", ErrorMessage: "correo y rol son obligatorios"}, nil
	}
	token, expiresAt, err := s.roles.CreateInvitation(ctx, tenantID, email, fullName, roleID, invitedBy)
	if err != nil {
		return nil, err
	}
	// SPEC §6: outbox -> correo de invitacion.
	if s.sessions != nil {
		if err := s.sessions.WriteOutboxEvent(ctx, "pp.identity.notification.requested.v1", invitedBy, tenantID,
			notificationPayload(invitedBy, "STAFF_INVITED")); err != nil {
			if s.reporter != nil {
				s.reporter.Defect(ctx, "outbox write failed for staff invitation", wrapErr(err, "write outbox invitation"))
			}
			return nil, err
		}
	}
	return &InviteResult{
		Success: true, InvitationID: token, ExpiresAt: expiresAt, Token: token,
	}, nil
}

// AcceptInvitation canjea el token y devuelve la sesion del nuevo staff.
func (s *IdentityService) AcceptInvitation(ctx context.Context, token, password string) (*AcceptResult, error) {
	if s.roles == nil {
		return &AcceptResult{ErrorMessage: "error interno"}, nil
	}
	if err := domain.ValidatePassword(password); err != nil {
		return &AcceptResult{Reason: "WEAK_PASSWORD", ErrorMessage: "la contrasena debe tener entre 12 y 128 caracteres"}, nil
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		if s.reporter != nil {
			s.reporter.Defect(ctx, "password hashing failed", wrapErr(err, "hash password"))
		}
		return &AcceptResult{ErrorMessage: "error interno"}, nil
	}
	user, role, err := s.roles.AcceptInvitation(ctx, token, hash)
	if err != nil {
		if errors.Is(err, domain.ErrInvitationExpired) {
			return &AcceptResult{Reason: "INVITATION_EXPIRED", ErrorMessage: "la invitacion vencio"}, nil
		}
		if errors.Is(err, domain.ErrInvitationUsed) {
			return &AcceptResult{Reason: "INVITATION_EXPIRED", ErrorMessage: "la invitacion ya fue usada"}, nil
		}
		if errors.Is(err, domain.ErrInvitationNotFound) {
			return &AcceptResult{Reason: "TOKEN_INVALID", ErrorMessage: "invitacion no encontrada"}, nil
		}
		if errors.Is(err, domain.ErrEmailTaken) {
			return &AcceptResult{Reason: "EMAIL_TAKEN", ErrorMessage: "ese correo ya esta registrado"}, nil
		}
		return nil, err
	}
	session, err := s.issueTokens(ctx, user, "")
	if err != nil {
		return nil, err
	}
	out := &AcceptResult{Success: true, UserID: user.ID, Session: session}
	if role != nil {
		out.Role = toRoleResult(role)
	}
	return out, nil
}

// ListUsers devuelve el equipo del tenant.
func (s *IdentityService) ListUsers(ctx context.Context, tenantID string) ([]domain.User, error) {
	if s.roles == nil {
		return nil, nil
	}
	return s.roles.ListUsers(ctx, tenantID)
}

// DeactivateUser desactiva a un miembro. R13: el ultimo dueno no.
func (s *IdentityService) DeactivateUser(ctx context.Context, userID string) error {
	if s.roles == nil {
		return nil
	}
	err := s.roles.DeactivateUser(ctx, userID)
	if errors.Is(err, domain.ErrLastOwner) {
		return err
	}
	return err
}

func toRoleResult(r *domain.Role) *RoleResult {
	if r == nil {
		return nil
	}
	return &RoleResult{ID: r.ID, TenantID: r.TenantID, Name: r.Name, System: r.System, Permissions: r.Permissions}
}
