package domain

import (
	"errors"
	"strings"
	"time"
)

// Errores del dominio de roles e invitaciones (F08.6).
var (
	ErrRoleNotFound       = errors.New("rol no encontrado")
	ErrRoleNameTaken      = errors.New("ya existe un rol con ese nombre")
	ErrUnknownPermission  = errors.New("permiso desconocido")
	ErrPlatformPermission = errors.New("un rol personalizado no puede tener permisos de plataforma")
	ErrLastOwner          = errors.New("no se puede desactivar al ultimo dueno del negocio")
	ErrInvitationNotFound = errors.New("invitacion no encontrada")
	ErrInvitationUsed     = errors.New("la invitacion ya fue usada")
	ErrInvitationExpired  = errors.New("la invitacion vencio")
)

// Role es un rol del tenant o un preset de sistema.
type Role struct {
	ID          string
	TenantID    string // vacio = preset de sistema
	Name        string
	System      bool
	Permissions []string
}

// Invitation es una invitacion de staff pendiente.
type Invitation struct {
	ID         string
	TenantID   string
	Email      string
	FullName   string
	RoleID     string
	ExpiresAt  time.Time
	AcceptedAt *time.Time
}

// Acceptable indica si la invitacion se puede canjear todavia (SPEC §4: 7 dias).
func (i *Invitation) Acceptable(now time.Time) error {
	if i.AcceptedAt != nil {
		return ErrInvitationUsed
	}
	if i.ExpiresAt.Before(now) {
		return ErrInvitationExpired
	}
	return nil
}

// ValidateCustomRolePermissions aplica R12: solo permisos del catalogo y nunca
// platform:* (el catalogo si los contiene, por eso hace falta la exclusion).
// isKnown valida la pertenencia al catalogo (auth.IsKnownPermission).
func ValidateCustomRolePermissions(perms []string, isKnown func(string) bool) error {
	for _, p := range perms {
		if p == "" {
			return ErrUnknownPermission
		}
		if strings.HasPrefix(p, "platform:") {
			return ErrPlatformPermission
		}
		if isKnown != nil && !isKnown(p) {
			return ErrUnknownPermission
		}
	}
	return nil
}
