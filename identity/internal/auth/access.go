package auth

import (
	"sort"
	"strings"
)

// Alcance territorial tal como viaja en x-pp-branch-scope (R24, grpc-conventions.md §2).
const (
	// BranchScopeAll es el alcance TENANT: todas las sucursales, también las futuras.
	BranchScopeAll = "*"
)

// AccessInput es lo que la resolución del permiso efectivo necesita de una persona
// (docs/domain/business-profiles-and-access.md §8). No lleva el estado del negocio ni el
// step-up: esos los aplica cada servicio en la operación (R11), no quitan permisos.
type AccessInput struct {
	// BaseRole es el UserRole: PLATFORM_ADMIN | BUSINESS_OWNER | BUSINESS_STAFF | CUSTOMER.
	BaseRole string
	// MembershipActive indica que la persona tiene una membresía ACTIVE en un negocio.
	MembershipActive bool
	// RolePermissions son los permisos del rol ASIGNADO al staff (R22). Se ignoran para el dueño.
	RolePermissions []string
	// EnabledCapabilities son las capacidades encendidas del negocio; nil = negocio sin
	// capacidades registradas (DefaultEnabledCapabilities).
	EnabledCapabilities map[string]bool
	// Scope es TENANT o BRANCHES; BranchIDs son las sucursales ACTIVAS del alcance.
	Scope     string
	BranchIDs []string
}

// Access es el permiso efectivo de una persona en esta petición.
type Access struct {
	Permissions  []string // ordenados, sin duplicados
	Modules      []string // orden de navegación (R10)
	BranchScope  string   // "*", ids separados por coma, o "" (sin sucursales / sin negocio)
	Capabilities []string // capacidades encendidas del negocio, ordenadas
}

// ResolveAccess calcula el permiso efectivo de forma pura y determinista (R10, R21, R22, R24):
//
//	base ← CUSTOMER; PLATFORM_ADMIN → su preset; sin membresía activa → base;
//	dueño → catálogo − platform:*; staff → permisos del rol asignado (nunca un preset por defecto);
//	del negocio ← permisos con al menos una capacidad encendida; efectivos ← base ∪ del negocio.
func ResolveAccess(in AccessInput) Access {
	if in.BaseRole == "PLATFORM_ADMIN" {
		perms := PermissionsFor("PLATFORM_ADMIN")
		return Access{Permissions: perms, Modules: ModulesForPermissions(perms)}
	}
	isMember := in.BaseRole == "BUSINESS_OWNER" || in.BaseRole == "BUSINESS_STAFF"
	if !isMember || !in.MembershipActive {
		perms := PermissionsWithBase(nil)
		return Access{Permissions: perms, Modules: ModulesForPermissions(perms)}
	}

	var fromRole []string
	scope := in.Scope
	if in.BaseRole == "BUSINESS_OWNER" {
		fromRole = presets["BUSINESS_OWNER"]
		scope = "TENANT" // el dueño siempre tiene alcance TENANT
	} else {
		for _, p := range in.RolePermissions {
			if !IsPlatformPermission(p) { // R12: un rol del negocio nunca concede platform:*
				fromRole = append(fromRole, p)
			}
		}
	}
	enabled := in.EnabledCapabilities
	if enabled == nil {
		enabled = DefaultEnabledCapabilities()
	}
	perms := PermissionsWithBase(FilterPermissionsByCapabilities(fromRole, enabled))

	caps := make([]string, 0, len(enabled))
	for c, on := range enabled {
		if on {
			caps = append(caps, c)
		}
	}
	sort.Strings(caps)

	return Access{
		Permissions:  perms,
		Modules:      ModulesForPermissions(perms),
		BranchScope:  EncodeBranchScope(scope, in.BranchIDs),
		Capabilities: caps,
	}
}

// EncodeBranchScope serializa el alcance para x-pp-branch-scope: "*" para TENANT; para
// BRANCHES, los ids ordenados separados por coma ("" si no queda ninguna sucursal activa).
func EncodeBranchScope(scope string, branchIDs []string) string {
	if scope == "" || scope == "TENANT" {
		return BranchScopeAll
	}
	ids := append([]string(nil), branchIDs...)
	sort.Strings(ids)
	return strings.Join(ids, ",")
}
