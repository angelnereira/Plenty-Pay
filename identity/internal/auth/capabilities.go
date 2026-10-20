package auth

// CoreCapability identifica los permisos de núcleo que no dependen de capacidades del negocio y están siempre activos.
const CoreCapability = "(núcleo)"

// PlatformCapability identifica los permisos de plataforma exclusivos de PLATFORM_ADMIN.
const PlatformCapability = "(plataforma)"

// PermissionCapabilityMap mapea cada permiso atómico a su capacidad de negocio asociada.
// Fuente de verdad: docs/standards/security-standards.md §3.1.
var PermissionCapabilityMap = map[string]string{
	"wallet:read":                    CoreCapability,
	"wallet:topup":                   CoreCapability,
	"wallet:transfer":                CoreCapability,
	"wallet:pay":                     CoreCapability,
	"payments:charge":                "finance.payments",
	"payments:read":                  "finance.payments",
	"payments:refund":                "finance.payments",
	"payments:terminal:manage":       "finance.terminals",
	"payments:fees:read":             "finance.payments",
	"payments:fees:manage":           "finance.payments",
	"settlement:read":                "finance.settlement",
	"settlement:schedule:manage":     "finance.settlement",
	"settlement:reconcile":           "finance.settlement",
	"fiscal:read":                    "finance.fiscal",
	"fiscal:issue":                   "finance.fiscal",
	"fiscal:note:issue":              "finance.fiscal",
	"fiscal:profile:manage":          "finance.fiscal",
	"catalog:read":                   CoreCapability,
	"catalog:write":                  "catalog.products",
	"catalog:import":                 "catalog.products",
	"catalog:listing:manage":         "catalog.listing",
	"catalog:pricelist:manage":       "catalog.price_lists",
	"inventory:read":                 "inventory.stock",
	"inventory:adjust":               "inventory.stock",
	"inventory:purchase:manage":      "inventory.purchasing",
	"inventory:receive":              "inventory.purchasing",
	"inventory:recipe:manage":        "inventory.recipes",
	"pos:read":                       "pos.counter",
	"pos:sell":                       "pos.counter",
	"pos:void":                       "pos.counter",
	"pos:refund":                     "pos.counter",
	"pos:session:manage":             "pos.counter",
	"pos:settings:manage":            "pos.counter",
	"pos:discount:apply":             "pos.counter",
	"pos:table:manage":               "pos.tables",
	"pos:kitchen:update":             "pos.kitchen_display",
	"pos:credit:approve":             "pos.house_credit",
	"orders:read:self":               CoreCapability,
	"orders:create:self":             CoreCapability,
	"orders:read":                    "orders.marketplace",
	"orders:manage":                  "orders.marketplace",
	"orders:quote:manage":            "orders.quotes",
	"appointments:read":              "appointments.calendar",
	"appointments:read:self":         "appointments.calendar",
	"appointments:book":              "appointments.calendar",
	"appointments:checkin":           "appointments.queue",
	"appointments:manage":            "appointments.calendar",
	"appointments:settings:manage":   "appointments.calendar",
	"logistics:read":                 "logistics.own_fleet",
	"logistics:deliver":              "logistics.own_fleet",
	"logistics:manage":               "logistics.own_fleet",
	"logistics:geofence:manage":      "logistics.geofences",
	"logistics:fleet:manage":         "logistics.fleet",
	"logistics:route:plan":           "logistics.routes",
	"payroll:employee:read":          "payroll.runs",
	"payroll:employee:manage":        "payroll.runs",
	"payroll:attendance:record":      "payroll.attendance",
	"payroll:attendance:read":        "payroll.attendance",
	"payroll:run:create":             "payroll.runs",
	"payroll:run:approve":            "payroll.runs",
	"payroll:run:pay":                "payroll.runs",
	"payroll:payslip:read:self":      "payroll.runs",
	"payroll:commission:read:self":   "payroll.commissions",
	"payroll:commission:manage":      "payroll.commissions",
	"analytics:read":                 "analytics.dashboards",
	"analytics:dashboard:manage":     "analytics.dashboards",
	"analytics:alert:manage":         "analytics.dashboards",
	"analytics:export":               "analytics.export",
	"admin:users:manage":             CoreCapability,
	"admin:roles:manage":             CoreCapability,
	"admin:business:manage":          CoreCapability,
	"admin:integrations:manage":      CoreCapability,
	"admin:audit:read":               CoreCapability,
	"notifications:read:self":        CoreCapability,
	"notifications:template:manage":  CoreCapability,
	"platform:tenants:review":        PlatformCapability,
	"platform:users:manage":          PlatformCapability,
	"platform:flags:manage":          PlatformCapability,
	"platform:security:read":         PlatformCapability,
	"platform:reconcile":             PlatformCapability,
	"platform:support":               PlatformCapability,
}

// CapabilityForPermission devuelve la capacidad asociada a un permiso.
func CapabilityForPermission(perm string) (string, bool) {
	cap, ok := PermissionCapabilityMap[perm]
	return cap, ok
}

// IsCorePermission indica si el permiso es de núcleo (siempre activo para cualquier persona con acceso).
func IsCorePermission(perm string) bool {
	return PermissionCapabilityMap[perm] == CoreCapability
}

// IsPlatformPermission indica si el permiso es exclusivo de administración de plataforma.
func IsPlatformPermission(perm string) bool {
	return PermissionCapabilityMap[perm] == PlatformCapability
}

// FilterPermissionsByCapabilities filtra una lista de permisos según las capacidades activas del negocio.
// Los permisos de núcleo siempre se conservan.
func FilterPermissionsByCapabilities(perms []string, enabledCaps map[string]bool) []string {
	var out []string
	for _, p := range perms {
		cap, ok := PermissionCapabilityMap[p]
		if !ok {
			continue
		}
		if cap == CoreCapability || enabledCaps[cap] {
			out = append(out, p)
		}
	}
	return out
}
