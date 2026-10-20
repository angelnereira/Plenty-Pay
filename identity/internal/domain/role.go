package domain

import (
	"errors"
	"strings"
	"time"
)

// Alcances territoriales de membresía (R24).
const (
	ScopeTenant   = "TENANT"
	ScopeBranches = "BRANCHES"
)

// Errores del dominio de roles, sucursales, invitaciones y gobierno (F08.6, ADR 0018).
var (
	ErrRoleNotFound               = errors.New("rol no encontrado")
	ErrRoleNameTaken              = errors.New("ya existe un rol con ese nombre")
	ErrPresetReadOnly             = errors.New("los roles predefinidos del sistema son de solo lectura")
	ErrRoleInUse                  = errors.New("no se puede archivar un rol con miembros activos")
	ErrUnknownPermission          = errors.New("permiso desconocido")
	ErrPlatformPermission         = errors.New("un rol personalizado no puede tener permisos de plataforma")
	ErrPermissionNotHeld          = errors.New("no puedes conceder permisos que no posees")
	ErrSelfAssignmentForbidden    = errors.New("no puedes modificar tu propio rol ni membresía")
	ErrBranchOutOfScope           = errors.New("sucursal fuera de tu alcance asignado")
	ErrBranchNotFound             = errors.New("sucursal no encontrada")
	ErrBranchCodeTaken            = errors.New("ya existe una sucursal con ese código fiscal")
	ErrInvalidBranchCode          = errors.New("el código de sucursal debe tener 4 dígitos numéricos (ej. 0000)")
	ErrCannotDeactivateLastBranch = errors.New("no puedes desactivar la única sucursal activa del negocio")
	ErrLastOwner                  = errors.New("no se puede desactivar al ultimo dueno del negocio")
	ErrInvitationNotFound         = errors.New("invitacion no encontrada")
	ErrInvitationUsed             = errors.New("la invitacion ya fue usada")
	ErrInvitationExpired          = errors.New("la invitacion vencio")
	ErrInvalidJobTitle            = errors.New("el cargo debe tener entre 1 y 60 caracteres")
	ErrInvalidBranch              = errors.New("la sucursal necesita nombre")
	ErrTargetIsOwner              = errors.New("la membresía del dueño no se edita desde el equipo")
	ErrUnauthenticated            = errors.New("la operación requiere una sesión")
	ErrForbidden                  = errors.New("no tienes permiso para esta operación")
	ErrNoTenant                   = errors.New("la operación requiere pertenecer a un negocio")
	ErrInvalidRequest             = errors.New("solicitud inválida")
	ErrStepUpRequired             = errors.New("esta operación requiere confirmación fuerte")
	ErrStepUpInvalid              = errors.New("la confirmación fuerte no es válida")
)

// MaxJobTitleChars es el largo máximo del cargo (InviteStaffRequest.job_title).
const MaxJobTitleChars = 60

// Role es un rol del tenant o un preset de sistema.
type Role struct {
	ID              string
	TenantID        string // vacio = preset de sistema
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

// Branch representa una sucursal física o lógica del comercio con código DGI (R24).
type Branch struct {
	ID               string
	TenantID         string
	Code             string // 4 dígitos DGI ("0000" = Casa Matriz)
	Name             string
	Address          string
	LatitudeE6       int32
	LongitudeE6      int32
	OpeningHoursJSON string
	Active           bool
	Version          int32
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// Membership vincula un usuario a un comercio con rol, alcance y cargo (ADR 0018).
type Membership struct {
	ID        string
	UserID    string
	TenantID  string
	BaseRole  string // BUSINESS_OWNER | BUSINESS_STAFF
	RoleID    string
	Scope     string // TENANT | BRANCHES
	BranchIDs []string
	JobTitle  string
	Status    string // ACTIVE | SUSPENDED | DEACTIVATED
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Invitation es una invitacion de staff pendiente.
type Invitation struct {
	ID         string
	TenantID   string
	Email      string
	FullName   string
	RoleID     string
	RoleName   string
	InvitedBy  string
	Scope      string // TENANT | BRANCHES
	BranchIDs  []string
	JobTitle   string
	ExpiresAt  time.Time
	AcceptedAt *time.Time
	RevokedAt  *time.Time
	CreatedAt  time.Time
}

// Status calcula el estado legible de la invitación.
func (i *Invitation) Status(now time.Time) string {
	if i.RevokedAt != nil {
		return "REVOKED"
	}
	if i.AcceptedAt != nil {
		return "ACCEPTED"
	}
	if i.ExpiresAt.Before(now) {
		return "EXPIRED"
	}
	return "PENDING"
}

// Acceptable indica si la invitacion se puede canjear todavia (SPEC §4: 7 dias).
func (i *Invitation) Acceptable(now time.Time) error {
	if i.RevokedAt != nil {
		return ErrInvitationNotFound
	}
	if i.AcceptedAt != nil {
		return ErrInvitationUsed
	}
	if i.ExpiresAt.Before(now) {
		return ErrInvitationExpired
	}
	return nil
}

// ValidateJobTitle aplica el tope del cargo: vacío se permite (es opcional), si viene
// tiene entre 1 y 60 caracteres sin contar espacios de los extremos.
func ValidateJobTitle(title string) error {
	if n := len([]rune(strings.TrimSpace(title))); n > MaxJobTitleChars {
		return ErrInvalidJobTitle
	}
	return nil
}

// ValidateBranch comprueba los datos mínimos de una sucursal (código DGI y nombre).
func ValidateBranch(b *Branch) error {
	if err := ValidateBranchCode(b.Code); err != nil {
		return err
	}
	if strings.TrimSpace(b.Name) == "" {
		return ErrInvalidBranch
	}
	return nil
}

// ValidateBranchCode verifica que el código fiscal DGI tenga exactamente 4 dígitos numéricos ("0000"–"9999").
func ValidateBranchCode(code string) error {
	c := strings.TrimSpace(code)
	if len(c) != 4 {
		return ErrInvalidBranchCode
	}
	for _, r := range c {
		if r < '0' || r > '9' {
			return ErrInvalidBranchCode
		}
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

// ValidateGrantablePermissions aplica la regla A1 (R23): ningún actor puede crear un rol ni
// conceder permisos que no posea en sus propios permisos efectivos (salvo BUSINESS_OWNER o PLATFORM_ADMIN).
func ValidateGrantablePermissions(actorRole string, actorPermissions, targetPermissions []string) error {
	if actorRole == "BUSINESS_OWNER" || actorRole == "PLATFORM_ADMIN" {
		return nil
	}
	held := make(map[string]struct{}, len(actorPermissions))
	for _, p := range actorPermissions {
		held[p] = struct{}{}
	}
	for _, p := range targetPermissions {
		if _, ok := held[p]; !ok {
			return ErrPermissionNotHeld
		}
	}
	return nil
}

// ValidateNotSelfAssignment aplica la regla A2 (R23): nadie modifica su propio rol ni membresía.
func ValidateNotSelfAssignment(actorUserID, targetUserID string) error {
	if actorUserID != "" && actorUserID == targetUserID {
		return ErrSelfAssignmentForbidden
	}
	return nil
}

// ValidateScopeDelegation aplica la regla A3 (R23): quien posee alcance BRANCHES solo puede delegar
// alcance BRANCHES sobre un subconjunto no vacío de sus propias sucursales.
func ValidateScopeDelegation(actorScope string, actorBranchIDs []string, targetScope string, targetBranchIDs []string) error {
	if targetScope == "" {
		targetScope = ScopeTenant
	}
	if targetScope != ScopeTenant && targetScope != ScopeBranches {
		return ErrBranchOutOfScope
	}
	if targetScope == ScopeBranches && len(targetBranchIDs) == 0 {
		return ErrBranchOutOfScope
	}
	if actorScope == "" || actorScope == ScopeTenant || actorScope == "*" {
		return nil
	}
	// Actor acotado a sucursales: no puede conceder TENANT ni sucursales fuera de las suyas.
	if targetScope == ScopeTenant {
		return ErrBranchOutOfScope
	}
	allowed := make(map[string]struct{}, len(actorBranchIDs))
	for _, id := range actorBranchIDs {
		allowed[id] = struct{}{}
	}
	for _, id := range targetBranchIDs {
		if _, ok := allowed[id]; !ok {
			return ErrBranchOutOfScope
		}
	}
	return nil
}
