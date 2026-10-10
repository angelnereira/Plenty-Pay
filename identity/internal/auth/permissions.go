package auth

import (
	"sort"
	"strings"
)

// Catálogo de permisos y presets de rol: copia ejecutable de docs/standards/security-standards.md §3.
// Si cambias algo aquí, cambia primero ese documento (ADR 0010). La prueba TestR10_* fija el contrato.
//
// Los módulos visibles en flutter_app NUNCA los decide el cliente: se derivan de los permisos (R10)
// y se entregan por GetUserPermissions (ADR 0009).

// AllPermissions es el catálogo completo. Un rol personalizado solo puede contener elementos de aquí (R12).
var AllPermissions = []string{
	"wallet:read", "wallet:topup", "wallet:transfer", "wallet:pay",
	"payments:charge", "payments:read", "payments:refund", "payments:terminal:manage", "payments:fees:read", "payments:fees:manage",
	"settlement:read", "settlement:schedule:manage", "settlement:reconcile",
	"catalog:read", "catalog:write", "catalog:import", "catalog:listing:manage",
	"inventory:read", "inventory:adjust", "inventory:purchase:manage", "inventory:receive",
	"pos:sell", "pos:void", "pos:refund", "pos:session:manage", "pos:settings:manage", "pos:discount:apply",
	"fiscal:read", "fiscal:issue", "fiscal:note:issue", "fiscal:profile:manage",
	"orders:read", "orders:manage", "orders:read:self", "orders:create:self",
	"logistics:read", "logistics:manage", "logistics:deliver", "logistics:geofence:manage",
	"payroll:employee:read", "payroll:employee:manage", "payroll:attendance:record", "payroll:attendance:read",
	"payroll:run:create", "payroll:run:approve", "payroll:run:pay", "payroll:payslip:read:self",
	"analytics:read", "analytics:dashboard:manage", "analytics:alert:manage", "analytics:export",
	"admin:users:manage", "admin:roles:manage", "admin:business:manage", "admin:integrations:manage", "admin:audit:read",
	"notifications:read:self", "notifications:template:manage",
	"platform:tenants:review", "platform:users:manage", "platform:flags:manage", "platform:security:read", "platform:reconcile", "platform:support",
}

var customerPermissions = []string{"wallet:read", "wallet:topup", "wallet:transfer", "wallet:pay", "catalog:read", "orders:read:self", "orders:create:self", "notifications:read:self"}

// Presets (security-standards.md §3.2). Las claves en minúscula son roles de staff; las mayúsculas, roles base.
var presets = map[string][]string{
	"CUSTOMER": customerPermissions,
	"cashier": {"pos:sell", "pos:session:manage", "payments:charge", "payments:read", "catalog:read", "inventory:read",
		"fiscal:issue", "payroll:attendance:record", "payroll:payslip:read:self"},
	"stock_keeper": {"inventory:read", "inventory:adjust", "inventory:purchase:manage", "inventory:receive", "catalog:read",
		"payroll:attendance:record", "payroll:payslip:read:self"},
	"courier": {"logistics:deliver", "logistics:read", "payroll:attendance:record", "payroll:payslip:read:self"},
	"accountant": {"fiscal:read", "fiscal:issue", "fiscal:note:issue", "settlement:read", "settlement:reconcile", "payments:read",
		"analytics:read", "analytics:export", "payroll:run:create"},
	"manager": {"catalog:read", "catalog:write", "catalog:import", "catalog:listing:manage",
		"inventory:read", "inventory:adjust", "inventory:purchase:manage", "inventory:receive",
		"pos:sell", "pos:void", "pos:refund", "pos:session:manage", "pos:settings:manage", "pos:discount:apply",
		"orders:read", "orders:manage", "logistics:read", "logistics:manage", "logistics:deliver", "logistics:geofence:manage",
		"payments:charge", "payments:read", "payments:refund", "settlement:read", "fiscal:read", "fiscal:issue", "fiscal:note:issue",
		"analytics:read", "payroll:attendance:read", "payroll:employee:read"},
}

func init() {
	var owner, platform []string
	for _, p := range AllPermissions {
		if strings.HasPrefix(p, "platform:") {
			platform = append(platform, p)
			continue
		}
		owner = append(owner, p)
	}
	presets["BUSINESS_OWNER"] = owner
	// PLATFORM_ADMIN: todo platform:* + lectura de módulos para soporte (auditada) + su propia wallet.
	presets["PLATFORM_ADMIN"] = append(append(platform, customerPermissions...),
		"payments:read", "settlement:read", "fiscal:read", "orders:read", "logistics:read", "analytics:read", "admin:audit:read")
	// BUSINESS_STAFF sin rol personalizado asignado (identity aún sin roles en BD, F08.6): preset de cajero.
	presets["BUSINESS_STAFF"] = presets["cashier"]
}

// PermissionsFor devuelve los permisos efectivos (copia ordenada, sin duplicados) de un rol base o preset.
// Todo usuario es además una persona con billetera propia: siempre recibe los permisos de CUSTOMER.
func PermissionsFor(role string) []string {
	base, ok := presets[role]
	if !ok {
		return []string{}
	}
	set := map[string]struct{}{}
	for _, p := range base {
		set[p] = struct{}{}
	}
	for _, p := range customerPermissions {
		set[p] = struct{}{}
	}
	out := make([]string, 0, len(set))
	for p := range set {
		out = append(out, p)
	}
	sort.Strings(out)
	return out
}

// moduleOrder es el orden de navegación (docs/ux/screen-catalog.md §1). Cada módulo lista los prefijos
// de permiso que lo hacen visible.
var moduleOrder = []struct {
	id       string
	prefixes []string
}{
	{"wallet", []string{"wallet:"}},
	{"marketplace", []string{"orders:create:self", "orders:read:self"}},
	{"pos", []string{"pos:"}},
	{"catalog", []string{"catalog:write", "catalog:import", "catalog:listing:manage"}},
	{"inventory", []string{"inventory:"}},
	{"orders", []string{"orders:read", "orders:manage"}},
	{"logistics", []string{"logistics:"}},
	{"finance", []string{"payments:", "settlement:", "fiscal:"}},
	{"payroll", []string{"payroll:"}},
	{"analytics", []string{"analytics:"}},
	{"admin", []string{"admin:"}},
	{"platform", []string{"platform:"}},
}

// ModulesForPermissions aplica R10: un módulo es visible si algún permiso coincide con uno de sus prefijos.
// "orders:read" no debe activar "orders" a partir de "orders:read:self": se compara exacto o por prefijo con ':'.
func ModulesForPermissions(perms []string) []string {
	out := []string{}
	for _, m := range moduleOrder {
		if matchesAny(perms, m.prefixes) {
			out = append(out, m.id)
		}
	}
	return out
}

func matchesAny(perms, prefixes []string) bool {
	for _, p := range perms {
		for _, pre := range prefixes {
			if strings.HasSuffix(pre, ":") {
				if strings.HasPrefix(p, pre) {
					return true
				}
			} else if p == pre {
				return true
			}
		}
	}
	return false
}

// ModulesForRole se conserva para compatibilidad: deriva módulos de los permisos del rol.
func ModulesForRole(role string) []string {
	return ModulesForPermissions(PermissionsFor(role))
}

// IsKnownPermission valida R12 (roles personalizados solo con permisos del catálogo, nunca platform:*).
func IsKnownPermission(p string) bool {
	for _, k := range AllPermissions {
		if k == p {
			return true
		}
	}
	return false
}
