// Package authz define el modelo de roles/permisos/features que alimenta la
// app dinámica (mandato §7): identity → tenant → role → permissions →
// features. La autorización real ocurre en backend en cada RPC; el cliente
// solo recibe capacidades para pintar la UI.
package authz

// Permission es (recurso, acción). GRANULAR, no por pantalla.
type Permission struct {
	Resource string `json:"resource"` // ej. "pos", "inventory", "reports"
	Action   string `json:"action"`   // ej. "read", "write", "approve"
}

// Feature es un módulo conmutable por tenant (mandato §7).
type Feature struct {
	Key     string `json:"key"`
	Enabled bool   `json:"enabled"`
}

// RoleKey identifica roles built-in. Roles custom por tenant llegan con la
// persistencia (Etapa 1 completion / Etapa 3).
type RoleKey string

const (
	RoleOwner    RoleKey = "OWNER"
	RoleCashier  RoleKey = "CASHIER"
	RoleConsumer RoleKey = "CONSUMER"
	RoleDriver   RoleKey = "DRIVER"
)

// AllPermissionsByRole: única fuente de verdad del mapeo built-in.
func AllPermissionsByRole() map[RoleKey][]Permission {
	perm := func(res, act string) Permission { return Permission{Resource: res, Action: act} }
	return map[RoleKey][]Permission{
		RoleOwner: {
			perm("pos", "read"), perm("pos", "write"),
			perm("catalog", "read"), perm("catalog", "write"),
			perm("inventory", "read"), perm("inventory", "write"),
			perm("sales", "read"), perm("sales", "approve"),
			perm("reports", "read"), perm("employees", "write"),
			perm("payroll", "read"), perm("branches", "write"),
			perm("wallet", "read"), perm("settings", "write"),
		},
		RoleCashier: {
			perm("pos", "read"), perm("pos", "write"),
			perm("catalog", "read"), perm("inventory", "read"),
			perm("sales", "read"),
		},
		RoleConsumer: {
			perm("wallet", "read"), perm("wallet", "write"),
			perm("marketplace", "read"), perm("orders", "read"),
		},
		RoleDriver: {
			perm("deliveries", "read"), perm("deliveries", "write"),
		},
	}
}

// AllFeaturesByRole: qué módulos se habilitan por rol (la app pinta según esto).
func AllFeaturesByRole() map[RoleKey][]Feature {
	feat := func(k string) Feature { return Feature{Key: k, Enabled: true} }
	return map[RoleKey][]Feature{
		RoleOwner: {
			feat("dashboard"), feat("pos"), feat("sales"), feat("catalog"),
			feat("inventory"), feat("invoicing"), feat("employees"),
			feat("payroll"), feat("reports"), feat("branches"), feat("settings"),
			feat("wallet"), feat("marketplace"),
		},
		RoleCashier: {feat("pos"), feat("sales"), feat("catalog")},
		RoleConsumer: {feat("wallet"), feat("payments"), feat("history"),
			feat("marketplace"), feat("notifications")},
		RoleDriver: {feat("deliveries")},
	}
}

// ContextOf devuelve roles → permisos → features para un conjunto de roles.
func ContextOf(roles []RoleKey) (perms []Permission, features []Feature) {
	permByRole := AllPermissionsByRole()
	featByRole := AllFeaturesByRole()
	seenP := map[Permission]bool{}
	seenF := map[string]bool{}
	for _, r := range roles {
		for _, p := range permByRole[r] {
			if !seenP[p] {
				seenP[p] = true
				perms = append(perms, p)
			}
		}
		for _, f := range featByRole[r] {
			if !seenF[f.Key] {
				seenF[f.Key] = true
				features = append(features, f)
			}
		}
	}
	return perms, features
}

// HasPermission verifica (recurso, acción) contra un conjunto.
func HasPermission(perms []Permission, resource, action string) bool {
	for _, p := range perms {
		if p.Resource == resource && p.Action == action {
			return true
		}
	}
	return false
}
