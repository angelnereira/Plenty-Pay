package auth

import (
	"sort"
	"strings"
)

// CoreCapability identifica los permisos de núcleo que no dependen de capacidades del negocio y están siempre activos.
const CoreCapability = "(núcleo)"

// PlatformCapability identifica los permisos de plataforma exclusivos de PLATFORM_ADMIN.
const PlatformCapability = "(plataforma)"

// PermissionCapabilityMap mapea cada permiso atómico a sus capacidades de negocio: el permiso
// está activo si CUALQUIERA de ellas está encendida. Fuente de verdad:
// docs/standards/security-standards.md §3.1 (TestCapabilities_MatchesSecurityStandards).
var PermissionCapabilityMap = map[string][]string{
	"wallet:read":                   {CoreCapability},
	"wallet:topup":                  {CoreCapability},
	"wallet:transfer":               {CoreCapability},
	"wallet:pay":                    {CoreCapability},
	"payments:charge":               {"finance.payments"},
	"payments:read":                 {"finance.payments"},
	"payments:refund":               {"finance.payments"},
	"payments:terminal:manage":      {"finance.terminals"},
	"payments:fees:read":            {"finance.payments"},
	"payments:fees:manage":          {"finance.payments"},
	"settlement:read":               {"finance.settlement"},
	"settlement:schedule:manage":    {"finance.settlement"},
	"settlement:reconcile":          {"finance.settlement"},
	"fiscal:read":                   {"finance.fiscal"},
	"fiscal:issue":                  {"finance.fiscal"},
	"fiscal:note:issue":             {"finance.fiscal"},
	"fiscal:profile:manage":         {"finance.fiscal"},
	"catalog:read":                  {CoreCapability},
	"catalog:write":                 {"catalog.products", "catalog.services"},
	"catalog:import":                {"catalog.products", "catalog.services"},
	"catalog:listing:manage":        {"catalog.listing"},
	"catalog:pricelist:manage":      {"catalog.price_lists"},
	"inventory:read":                {"inventory.stock"},
	"inventory:adjust":              {"inventory.stock"},
	"inventory:purchase:manage":     {"inventory.purchasing"},
	"inventory:receive":             {"inventory.purchasing"},
	"inventory:recipe:manage":       {"inventory.recipes"},
	"pos:read":                      {"pos.counter"},
	"pos:sell":                      {"pos.counter"},
	"pos:void":                      {"pos.counter"},
	"pos:refund":                    {"pos.counter"},
	"pos:session:manage":            {"pos.counter"},
	"pos:settings:manage":           {"pos.counter"},
	"pos:discount:apply":            {"pos.counter"},
	"pos:table:manage":              {"pos.tables"},
	"pos:kitchen:update":            {"pos.kitchen_display"},
	"pos:credit:approve":            {"pos.house_credit"},
	"orders:read:self":              {CoreCapability},
	"orders:create:self":            {CoreCapability},
	"orders:read":                   {"orders.marketplace"},
	"orders:manage":                 {"orders.marketplace"},
	"orders:quote:manage":           {"orders.quotes"},
	"appointments:read":             {"appointments.calendar"},
	"appointments:read:self":        {"appointments.calendar"},
	"appointments:book":             {"appointments.calendar"},
	"appointments:checkin":          {"appointments.queue"},
	"appointments:manage":           {"appointments.calendar"},
	"appointments:settings:manage":  {"appointments.calendar"},
	"logistics:read":                {"logistics.own_fleet"},
	"logistics:deliver":             {"logistics.own_fleet"},
	"logistics:manage":              {"logistics.own_fleet"},
	"logistics:geofence:manage":     {"logistics.geofences"},
	"logistics:fleet:manage":        {"logistics.fleet"},
	"logistics:route:plan":          {"logistics.routes"},
	"payroll:employee:read":         {"payroll.runs"},
	"payroll:employee:manage":       {"payroll.runs"},
	"payroll:attendance:record":     {"payroll.attendance"},
	"payroll:attendance:read":       {"payroll.attendance"},
	"payroll:run:create":            {"payroll.runs"},
	"payroll:run:approve":           {"payroll.runs"},
	"payroll:run:pay":               {"payroll.runs"},
	"payroll:payslip:read:self":     {"payroll.runs"},
	"payroll:commission:read:self":  {"payroll.commissions"},
	"payroll:commission:manage":     {"payroll.commissions"},
	"analytics:read":                {"analytics.dashboards"},
	"analytics:dashboard:manage":    {"analytics.dashboards"},
	"analytics:alert:manage":        {"analytics.dashboards"},
	"analytics:export":              {"analytics.export"},
	"admin:users:manage":            {CoreCapability},
	"admin:roles:manage":            {CoreCapability},
	"admin:business:manage":         {CoreCapability},
	"admin:integrations:manage":     {CoreCapability},
	"admin:audit:read":              {CoreCapability},
	"notifications:read:self":       {CoreCapability},
	"notifications:template:manage": {CoreCapability},
	"platform:tenants:review":       {PlatformCapability},
	"platform:users:manage":         {PlatformCapability},
	"platform:flags:manage":         {PlatformCapability},
	"platform:security:read":        {PlatformCapability},
	"platform:reconcile":            {PlatformCapability},
	"platform:support":              {PlatformCapability},
}

// moneyPermissions marca los permisos con impacto monetario o de autorización crítica (🔒 en S-ADM-03).
var moneyPermissions = map[string]bool{
	"wallet:topup":               true,
	"wallet:transfer":            true,
	"wallet:pay":                 true,
	"payments:charge":            true,
	"payments:refund":            true,
	"payments:fees:manage":       true,
	"settlement:schedule:manage": true,
	"settlement:reconcile":       true,
	"pos:void":                   true,
	"pos:refund":                 true,
	"pos:discount:apply":         true,
	"pos:credit:approve":         true,
	"payroll:run:approve":        true,
	"payroll:run:pay":            true,
	"payroll:commission:manage":  true,
	"admin:roles:manage":         true,
	"admin:integrations:manage":  true,
}

// PermissionCatalogEntry describe un permiso para el editor visual S-ADM-03.
type PermissionCatalogEntry struct {
	Key        string
	Module     string
	Level      string // VIEW | OPERATE | MANAGE | APPROVE | CONFIGURE
	Capability string // vacío si es núcleo o plataforma
	Money      bool
	Platform   bool
}

// CapabilityCatalogEntry describe una capacidad funcional de negocio.
type CapabilityCatalogEntry struct {
	Key    string
	Module string
}

// VerticalEntry describe una vertical comercial (R20).
type VerticalEntry struct {
	Key                   string
	Family                string
	DefaultTraits         []string
	SuggestedCapabilities []string
	RoleTemplateKeys      []string
	Version               int32
}

// TraitEntry describe un rasgo operativo y las capacidades que activa.
type TraitEntry struct {
	Key          string
	Capabilities []string
}

// RoleTemplateEntry describe una plantilla universal o sectorial (S-ADM-03).
type RoleTemplateEntry struct {
	Key          string
	Version      int32
	Description  string
	Permissions  []string
	Universal    bool
	VerticalKeys []string
}

// GatedCapabilities son capacidades sujetas a preguntas abiertas legales (Q-21, Q-32, Q-33):
// no se activan por defecto desde verticales ni rasgos hasta su validación normativa.
var GatedCapabilities = map[string]bool{
	"pos.tips":              true, // Q-21
	"payroll.commissions":   true, // Q-32
	"appointments.deposits": true, // Q-33
}

// GatingQuestion es la pregunta abierta (docs/open-questions.md) que bloquea cada capacidad.
var GatingQuestion = map[string]string{
	"pos.tips":              "Q-21",
	"payroll.commissions":   "Q-32",
	"appointments.deposits": "Q-33",
}

// AllCapabilityEntries contiene las capacidades estándar del modelo (docs/domain/business-profiles-and-access.md §4).
var AllCapabilityEntries = []CapabilityCatalogEntry{
	{Key: "pos.counter", Module: "pos"},
	{Key: "pos.offline", Module: "pos"},
	{Key: "pos.customer_display", Module: "pos"},
	{Key: "pos.house_credit", Module: "pos"},
	{Key: "pos.loyalty", Module: "pos"},
	{Key: "pos.tables", Module: "pos"},
	{Key: "pos.kitchen_display", Module: "pos"},
	{Key: "pos.split_bill", Module: "pos"},
	{Key: "pos.tips", Module: "pos"},
	{Key: "pos.weighed_items", Module: "pos"},
	{Key: "orders.marketplace", Module: "orders"},
	{Key: "orders.quotes", Module: "orders"},
	{Key: "orders.b2b", Module: "orders"},
	{Key: "appointments.calendar", Module: "appointments"},
	{Key: "appointments.queue", Module: "appointments"},
	{Key: "appointments.online_booking", Module: "appointments"},
	{Key: "appointments.deposits", Module: "appointments"},
	{Key: "catalog.products", Module: "catalog"},
	{Key: "catalog.services", Module: "catalog"},
	{Key: "catalog.variants", Module: "catalog"},
	{Key: "catalog.modifiers", Module: "catalog"},
	{Key: "catalog.listing", Module: "catalog"},
	{Key: "catalog.price_lists", Module: "catalog"},
	{Key: "inventory.stock", Module: "inventory"},
	{Key: "inventory.lots", Module: "inventory"},
	{Key: "inventory.transfers", Module: "inventory"},
	{Key: "inventory.purchasing", Module: "inventory"},
	{Key: "inventory.recipes", Module: "inventory"},
	{Key: "logistics.own_fleet", Module: "logistics"},
	{Key: "logistics.carriers", Module: "logistics"},
	{Key: "logistics.geofences", Module: "logistics"},
	{Key: "logistics.fleet", Module: "logistics"},
	{Key: "logistics.freight", Module: "logistics"},
	{Key: "logistics.routes", Module: "logistics"},
	{Key: "finance.payments", Module: "finance"},
	{Key: "finance.terminals", Module: "finance"},
	{Key: "finance.settlement", Module: "finance"},
	{Key: "finance.fiscal", Module: "finance"},
	{Key: "payroll.attendance", Module: "payroll"},
	{Key: "payroll.kiosk", Module: "payroll"},
	{Key: "payroll.runs", Module: "payroll"},
	{Key: "payroll.commissions", Module: "payroll"},
	{Key: "payroll.tips_distribution", Module: "payroll"},
	{Key: "analytics.dashboards", Module: "analytics"},
	{Key: "analytics.ask", Module: "analytics"},
	{Key: "analytics.forecast", Module: "analytics"},
	{Key: "analytics.export", Module: "analytics"},
}

// AllTraits lista los rasgos operativos y qué capacidades activan.
var AllTraits = []TraitEntry{
	{Key: "sells_goods", Capabilities: []string{"catalog.products", "pos.counter", "finance.payments", "finance.settlement"}},
	{Key: "sells_services", Capabilities: []string{"catalog.services", "pos.counter", "finance.payments", "finance.settlement"}},
	{Key: "tracks_inventory", Capabilities: []string{"inventory.stock"}},
	{Key: "product_variants", Capabilities: []string{"catalog.variants"}},
	{Key: "lots_expiry", Capabilities: []string{"inventory.lots"}},
	{Key: "weighed_items", Capabilities: []string{"pos.weighed_items"}},
	{Key: "modifiers", Capabilities: []string{"catalog.modifiers"}},
	{Key: "table_service", Capabilities: []string{"pos.tables", "pos.split_bill"}},
	{Key: "kitchen_production", Capabilities: []string{"pos.kitchen_display"}},
	{Key: "recipes", Capabilities: []string{"inventory.recipes"}},
	{Key: "appointments", Capabilities: []string{"appointments.calendar", "appointments.online_booking"}},
	{Key: "walk_in_queue", Capabilities: []string{"appointments.queue"}},
	{Key: "staff_commissions", Capabilities: []string{"payroll.commissions"}},
	{Key: "tips", Capabilities: []string{"pos.tips"}},
	{Key: "b2b_customers", Capabilities: []string{"catalog.price_lists", "orders.quotes", "orders.b2b"}},
	{Key: "house_credit", Capabilities: []string{"pos.house_credit"}},
	{Key: "loyalty", Capabilities: []string{"pos.loyalty"}},
	{Key: "purchasing", Capabilities: []string{"inventory.purchasing"}},
	{Key: "multi_branch", Capabilities: []string{"inventory.transfers"}},
	{Key: "own_delivery", Capabilities: []string{"logistics.own_fleet", "logistics.geofences"}},
	{Key: "third_party_delivery", Capabilities: []string{"logistics.carriers"}},
	{Key: "fleet_management", Capabilities: []string{"logistics.fleet", "logistics.routes"}},
	{Key: "freight", Capabilities: []string{"logistics.freight"}},
	{Key: "marketplace_seller", Capabilities: []string{"catalog.listing", "orders.marketplace"}},
	{Key: "fiscal_invoicing", Capabilities: []string{"finance.fiscal"}},
	{Key: "payroll", Capabilities: []string{"payroll.runs", "payroll.attendance", "payroll.kiosk"}},
}

// AllVerticals lista el catálogo de verticales comerciales.
var AllVerticals = []VerticalEntry{
	{
		Key: "retail", Family: "COMMERCE", Version: 1,
		DefaultTraits:         []string{"sells_goods", "tracks_inventory", "purchasing", "loyalty", "fiscal_invoicing"},
		SuggestedCapabilities: []string{"catalog.products", "pos.counter", "inventory.stock", "inventory.purchasing", "pos.loyalty", "finance.payments", "finance.settlement", "finance.fiscal", "analytics.dashboards"},
		RoleTemplateKeys:      []string{"sales_associate"},
	},
	{
		Key: "food_and_beverage", Family: "FOOD", Version: 1,
		DefaultTraits:         []string{"sells_goods", "table_service", "kitchen_production", "modifiers", "recipes", "fiscal_invoicing"},
		SuggestedCapabilities: []string{"catalog.products", "catalog.modifiers", "pos.counter", "pos.tables", "pos.kitchen_display", "pos.split_bill", "inventory.stock", "inventory.recipes", "finance.payments", "finance.settlement", "finance.fiscal", "analytics.dashboards"},
		RoleTemplateKeys:      []string{"waiter", "host", "kitchen", "bartender"},
	},
	{
		Key: "services_appointments", Family: "SERVICES", Version: 1,
		DefaultTraits:         []string{"sells_services", "appointments", "walk_in_queue", "fiscal_invoicing"},
		SuggestedCapabilities: []string{"catalog.services", "appointments.calendar", "appointments.queue", "pos.counter", "finance.payments", "finance.settlement", "finance.fiscal", "analytics.dashboards"},
		RoleTemplateKeys:      []string{"stylist", "receptionist", "salon_manager"},
	},
	{
		Key: "professional_services", Family: "SERVICES", Version: 1,
		DefaultTraits:         []string{"sells_services", "appointments", "b2b_customers", "fiscal_invoicing"},
		SuggestedCapabilities: []string{"catalog.services", "appointments.calendar", "orders.quotes", "catalog.price_lists", "finance.payments", "finance.settlement", "finance.fiscal", "analytics.dashboards"},
		RoleTemplateKeys:      []string{"receptionist"},
	},
	{
		Key: "wholesale_distribution", Family: "COMMERCE", Version: 1,
		DefaultTraits:         []string{"sells_goods", "tracks_inventory", "b2b_customers", "house_credit", "purchasing", "own_delivery", "fiscal_invoicing"},
		SuggestedCapabilities: []string{"catalog.products", "catalog.price_lists", "orders.quotes", "orders.b2b", "inventory.stock", "inventory.purchasing", "pos.counter", "pos.house_credit", "logistics.own_fleet", "finance.payments", "finance.settlement", "finance.fiscal", "analytics.dashboards"},
		RoleTemplateKeys:      []string{"sales_rep", "credit_officer", "warehouse_lead", "dispatcher"},
	},
	{
		Key: "logistics_courier", Family: "LOGISTICS", Version: 1,
		DefaultTraits:         []string{"own_delivery", "third_party_delivery", "fleet_management", "b2b_customers", "fiscal_invoicing"},
		SuggestedCapabilities: []string{"logistics.own_fleet", "logistics.carriers", "logistics.geofences", "logistics.fleet", "logistics.routes", "finance.payments", "finance.settlement", "finance.fiscal", "analytics.dashboards"},
		RoleTemplateKeys:      []string{"fleet_manager", "dispatcher", "billing_clerk"},
	},
	{
		Key: "beauty_wellness", Family: "SERVICES", Version: 1,
		DefaultTraits:         []string{"sells_services", "appointments", "walk_in_queue", "sells_goods", "loyalty", "fiscal_invoicing"},
		SuggestedCapabilities: []string{"catalog.services", "catalog.products", "appointments.calendar", "appointments.queue", "pos.counter", "pos.loyalty", "finance.payments", "finance.settlement", "finance.fiscal", "analytics.dashboards"},
		RoleTemplateKeys:      []string{"stylist", "receptionist", "salon_manager"},
	},
	{
		Key: "health_clinic", Family: "SERVICES", Version: 1,
		DefaultTraits:         []string{"sells_services", "appointments", "lots_expiry", "fiscal_invoicing"},
		SuggestedCapabilities: []string{"catalog.services", "appointments.calendar", "inventory.stock", "inventory.lots", "pos.counter", "finance.payments", "finance.settlement", "finance.fiscal", "analytics.dashboards"},
		RoleTemplateKeys:      []string{"receptionist"},
	},
	{
		Key: "education_courses", Family: "SERVICES", Version: 1,
		DefaultTraits:         []string{"sells_services", "appointments", "fiscal_invoicing"},
		SuggestedCapabilities: []string{"catalog.services", "appointments.calendar", "pos.counter", "finance.payments", "finance.settlement", "finance.fiscal", "analytics.dashboards"},
		RoleTemplateKeys:      []string{"receptionist"},
	},
	{
		Key: "general_commercial", Family: "GENERAL", Version: 1,
		DefaultTraits:         []string{"sells_goods", "tracks_inventory", "fiscal_invoicing"},
		SuggestedCapabilities: []string{"catalog.products", "pos.counter", "inventory.stock", "finance.payments", "finance.settlement", "finance.fiscal", "analytics.dashboards"},
		RoleTemplateKeys:      []string{"sales_associate"},
	},
}

// verticalAliases mapea los nombres mayúsculos de docs/domain/business-profiles-and-access.md §3.1 a las claves canónicas.
var verticalAliases = map[string]string{
	"RETAIL_STORE":          "retail",
	"GROCERY":               "retail",
	"APPAREL_STORE":         "retail",
	"WHOLESALE":             "wholesale_distribution",
	"ONLINE_SELLER":         "retail",
	"RESTAURANT":            "food_and_beverage",
	"QUICK_SERVICE":         "food_and_beverage",
	"BEAUTY_SALON":          "beauty_wellness",
	"BARBERSHOP":            "services_appointments",
	"COURIER":               "logistics_courier",
	"FREIGHT":               "logistics_courier",
	"PROFESSIONAL_SERVICES": "professional_services",
	"OTHER":                 "general_commercial",
}

// LookupVertical busca una vertical por clave canónica o alias.
func LookupVertical(key string) (*VerticalEntry, bool) {
	if key == "" {
		return &AllVerticals[len(AllVerticals)-1], true // general_commercial por defecto
	}
	canonical := strings.TrimSpace(key)
	if alias, ok := verticalAliases[strings.ToUpper(canonical)]; ok {
		canonical = alias
	} else {
		canonical = strings.ToLower(canonical)
	}
	for i := range AllVerticals {
		if AllVerticals[i].Key == canonical {
			return &AllVerticals[i], true
		}
	}
	return nil, false
}

// IsKnownCapability valida si una capacidad existe en el catálogo.
func IsKnownCapability(capKey string) bool {
	for _, c := range AllCapabilityEntries {
		if c.Key == capKey {
			return true
		}
	}
	return false
}

// AllCapabilityKeys devuelve todas las claves de capacidad conocidas (ordenadas).
func AllCapabilityKeys() []string {
	out := make([]string, len(AllCapabilityEntries))
	for i, c := range AllCapabilityEntries {
		out[i] = c.Key
	}
	sort.Strings(out)
	return out
}

// Fuentes de una capacidad (CapabilityState.source del .proto).
const (
	SourceVertical = "VERTICAL"
	SourceTrait    = "TRAIT"
	SourceManual   = "MANUAL"
	SourcePlan     = "PLAN"
)

// MaxSecondaryVerticals es el tope de verticales secundarias (R20).
const MaxSecondaryVerticals = 2

// baseCapabilities son las del núcleo comercial que todo negocio tiene al nacer (cobrar,
// liquidar, facturar, ver su tablero y llevar asistencia y planilla).
var baseCapabilities = []string{
	"finance.payments", "finance.settlement", "finance.fiscal",
	"analytics.dashboards", "payroll.attendance", "payroll.runs",
}

// traitByKey devuelve el rasgo del catálogo.
func traitByKey(key string) (TraitEntry, bool) {
	for _, tr := range AllTraits {
		if tr.Key == key {
			return tr, true
		}
	}
	return TraitEntry{}, false
}

// IsKnownTrait valida que el rasgo exista en el catálogo.
func IsKnownTrait(key string) bool {
	_, ok := traitByKey(key)
	return ok
}

// EffectiveTraits aplica la regla 2 del perfil: unión de los rasgos por defecto de las
// verticales elegidas y, encima, las respuestas explícitas del dueño (true o false ganan).
func EffectiveTraits(primaryVertical string, secondaryVerticals []string, traitAnswers map[string]bool) map[string]bool {
	out := map[string]bool{}
	for _, vKey := range append([]string{primaryVertical}, secondaryVerticals...) {
		v, ok := LookupVertical(vKey)
		if !ok {
			continue
		}
		for _, t := range v.DefaultTraits {
			out[t] = true
		}
	}
	for t, on := range traitAnswers {
		if !IsKnownTrait(t) {
			continue
		}
		if on {
			out[t] = true
		} else {
			delete(out, t)
		}
	}
	return out
}

// DeriveCapabilities calcula las capacidades del perfil (R20, R21): núcleo + capacidades de
// los rasgos efectivos + sugerencias de las verticales que ningún rasgo apagado contradiga.
// Devuelve capacidad -> fuente. Las capacidades sujetas a preguntas abiertas (GatedCapabilities)
// nunca se encienden por perfil.
func DeriveCapabilities(primaryVertical string, secondaryVerticals []string, traitAnswers map[string]bool) map[string]string {
	out := map[string]string{}
	for _, c := range baseCapabilities {
		out[c] = SourceVertical
	}
	// Capacidades que un rasgo respondido "no" apaga, salvo que otro rasgo activo las encienda.
	vetoed := map[string]bool{}
	for t, on := range traitAnswers {
		if tr, ok := traitByKey(t); ok && !on {
			for _, c := range tr.Capabilities {
				vetoed[c] = true
			}
		}
	}
	effective := EffectiveTraits(primaryVertical, secondaryVerticals, traitAnswers)
	for t := range effective {
		tr, _ := traitByKey(t)
		source := SourceVertical
		if traitAnswers[t] {
			source = SourceTrait
		}
		for _, c := range tr.Capabilities {
			delete(vetoed, c)
			if GatedCapabilities[c] {
				continue
			}
			if out[c] != SourceTrait {
				out[c] = source
			}
		}
	}
	for _, vKey := range append([]string{primaryVertical}, secondaryVerticals...) {
		v, ok := LookupVertical(vKey)
		if !ok {
			continue
		}
		for _, c := range v.SuggestedCapabilities {
			if GatedCapabilities[c] || vetoed[c] {
				continue
			}
			if _, set := out[c]; !set {
				out[c] = SourceVertical
			}
		}
	}
	return out
}

// RoleTemplates devuelve las plantillas universales (7) y las sectoriales.
func RoleTemplates(verticalKeys []string) []RoleTemplateEntry {
	universal := []RoleTemplateEntry{
		{
			Key: "manager", Version: 1, Universal: true,
			Description: "Gerente: opera y gestiona integralmente el comercio sin administrar roles ni credenciales.",
			Permissions: presets["manager"],
		},
		{
			Key: "supervisor", Version: 1, Universal: true,
			Description: "Supervisor de turno: autoriza anulaciones, devoluciones y descuentos en caja (sin venta directa por SoD).",
			Permissions: presets["supervisor"],
		},
		{
			Key: "cashier", Version: 1, Universal: true,
			Description: "Cajero: registra ventas en mostrador, cobra y emite comprobantes fiscales.",
			Permissions: presets["cashier"],
		},
		{
			Key: "stock_keeper", Version: 1, Universal: true,
			Description: "Almacenista: gestiona recepciones de mercancía, conteos y ajustes de inventario.",
			Permissions: presets["stock_keeper"],
		},
		{
			Key: "courier", Version: 1, Universal: true,
			Description: "Repartidor: consulta asignaciones y confirma entregas en ruta.",
			Permissions: presets["courier"],
		},
		{
			Key: "accountant", Version: 1, Universal: true,
			Description: "Contador: consulta y emite documentos fiscales, concilia liquidaciones y prepara nómina.",
			Permissions: presets["accountant"],
		},
		{
			Key: "viewer", Version: 1, Universal: true,
			Description: "Solo lectura: consulta catálogo, inventario, ventas, finanzas y analítica sin modificar datos.",
			Permissions: presets["viewer"],
		},
	}

	sectorial := []RoleTemplateEntry{
		{
			Key: "waiter", Version: 1, Universal: false, VerticalKeys: []string{"food_and_beverage"},
			Description: "Mesero: gestiona mesas, toma pedidos y cobra en salón.",
			Permissions: []string{"pos:read", "pos:sell", "pos:table:manage", "payments:charge", "catalog:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "host", Version: 1, Universal: false, VerticalKeys: []string{"food_and_beverage"},
			Description: "Anfitrión: asigna mesas y recibe reservas.",
			Permissions: []string{"pos:read", "pos:table:manage", "appointments:read", "appointments:checkin", "catalog:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "kitchen", Version: 1, Universal: false, VerticalKeys: []string{"food_and_beverage"},
			Description: "Cocina: visualiza y actualiza el estado de preparación de comandas.",
			Permissions: []string{"pos:read", "pos:kitchen:update", "inventory:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "bartender", Version: 1, Universal: false, VerticalKeys: []string{"food_and_beverage"},
			Description: "Barman: atiende barra, prepara pedidos y cobra en mostrador.",
			Permissions: []string{"pos:read", "pos:sell", "pos:kitchen:update", "payments:charge", "catalog:read", "inventory:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "stylist", Version: 1, Universal: false, VerticalKeys: []string{"services_appointments", "beauty_wellness"},
			Description: "Profesional / Estilista / Barbero: consulta su agenda propia, atiende citas y revisa sus comisiones.",
			Permissions: []string{"appointments:read:self", "appointments:checkin", "catalog:read", "payroll:attendance:record", "payroll:payslip:read:self", "payroll:commission:read:self"},
		},
		{
			Key: "receptionist", Version: 1, Universal: false, VerticalKeys: []string{"services_appointments", "beauty_wellness", "professional_services", "health_clinic", "education_courses"},
			Description: "Recepción: agenda citas, registra llegadas y cobra servicios en mostrador.",
			Permissions: []string{"appointments:read", "appointments:book", "appointments:checkin", "appointments:manage", "pos:read", "pos:sell", "payments:charge", "fiscal:issue", "catalog:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "salon_manager", Version: 1, Universal: false, VerticalKeys: []string{"services_appointments", "beauty_wellness"},
			Description: "Encargado de salón: administra agenda completa, catálogo de servicios, caja y turnos del equipo.",
			Permissions: []string{"appointments:read", "appointments:book", "appointments:checkin", "appointments:manage", "appointments:settings:manage", "pos:read", "pos:sell", "pos:session:manage", "pos:discount:apply", "payments:charge", "payments:read", "catalog:read", "catalog:write", "inventory:read", "inventory:adjust", "payroll:attendance:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "sales_rep", Version: 1, Universal: false, VerticalKeys: []string{"wholesale_distribution"},
			Description: "Vendedor B2B: elabora cotizaciones, toma pedidos mayoristas y consulta listas de precios.",
			Permissions: []string{"catalog:read", "inventory:read", "orders:read", "orders:manage", "orders:quote:manage", "payments:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "credit_officer", Version: 1, Universal: false, VerticalKeys: []string{"wholesale_distribution"},
			Description: "Analista de crédito: aprueba ventas a crédito comercial y concilia pagos.",
			Permissions: []string{"pos:read", "pos:credit:approve", "orders:read", "payments:read", "settlement:read", "fiscal:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "warehouse_lead", Version: 1, Universal: false, VerticalKeys: []string{"wholesale_distribution"},
			Description: "Jefe de bodega: dirige compras, recepciones, ajustes y despacho a logística.",
			Permissions: []string{"inventory:read", "inventory:adjust", "inventory:purchase:manage", "inventory:receive", "orders:read", "logistics:read", "logistics:manage", "catalog:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "dispatcher", Version: 1, Universal: false, VerticalKeys: []string{"wholesale_distribution", "logistics_courier"},
			Description: "Despachador: planifica rutas, geocercas y asigna entregas a la flota.",
			Permissions: []string{"logistics:read", "logistics:manage", "logistics:geofence:manage", "logistics:route:plan", "orders:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "fleet_manager", Version: 1, Universal: false, VerticalKeys: []string{"logistics_courier"},
			Description: "Jefe de flota: administra vehículos, repartidores, rutas y geocercas.",
			Permissions: []string{"logistics:read", "logistics:manage", "logistics:fleet:manage", "logistics:route:plan", "logistics:geofence:manage", "payroll:attendance:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "billing_clerk", Version: 1, Universal: false, VerticalKeys: []string{"logistics_courier"},
			Description: "Facturador de carga: emite facturas fiscales y gestiona cobros de envíos.",
			Permissions: []string{"fiscal:read", "fiscal:issue", "fiscal:note:issue", "payments:read", "payments:charge", "orders:read", "logistics:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
		{
			Key: "sales_associate", Version: 1, Universal: false, VerticalKeys: []string{"retail", "general_commercial"},
			Description: "Asesor de piso: consulta existencias, atiende clientes y registra ventas en mostrador.",
			Permissions: []string{"pos:read", "pos:sell", "catalog:read", "inventory:read", "payroll:attendance:record", "payroll:payslip:read:self"},
		},
	}

	if len(verticalKeys) == 0 {
		return append(universal, sectorial...)
	}
	vSet := map[string]bool{}
	for _, vk := range verticalKeys {
		if v, ok := LookupVertical(vk); ok {
			vSet[v.Key] = true
		} else {
			vSet[strings.ToLower(vk)] = true
		}
	}
	out := make([]RoleTemplateEntry, len(universal))
	copy(out, universal)
	for _, st := range sectorial {
		for _, vk := range st.VerticalKeys {
			if vSet[vk] {
				out = append(out, st)
				break
			}
		}
	}
	return out
}

// PermissionModule devuelve el módulo de navegación al que pertenece un permiso.
func PermissionModule(perm string) string {
	prefix := perm
	if idx := strings.IndexByte(perm, ':'); idx > 0 {
		prefix = perm[:idx]
	}
	switch prefix {
	case "payments", "settlement", "fiscal":
		return "finance"
	case "notifications":
		return "admin"
	default:
		return prefix
	}
}

// PermissionLevel clasifica un permiso en uno de los 5 niveles didácticos de S-ADM-03:
// VIEW | OPERATE | MANAGE | APPROVE | CONFIGURE.
func PermissionLevel(perm string) string {
	switch perm {
	case "pos:void", "pos:refund", "pos:discount:apply", "pos:credit:approve",
		"payments:refund", "settlement:reconcile", "payroll:run:approve", "payroll:run:pay",
		"platform:tenants:review", "platform:reconcile":
		return "APPROVE"
	case "pos:settings:manage", "appointments:settings:manage", "fiscal:profile:manage",
		"payments:fees:manage", "payments:terminal:manage", "settlement:schedule:manage",
		"logistics:geofence:manage", "analytics:alert:manage", "admin:business:manage",
		"admin:roles:manage", "admin:integrations:manage", "notifications:template:manage",
		"platform:flags:manage":
		return "CONFIGURE"
	}
	if strings.Contains(perm, ":read") || perm == "platform:support" {
		return "VIEW"
	}
	if strings.HasSuffix(perm, ":sell") || strings.HasSuffix(perm, ":charge") ||
		strings.HasSuffix(perm, ":issue") || strings.HasSuffix(perm, ":deliver") ||
		strings.HasSuffix(perm, ":record") || strings.HasSuffix(perm, ":checkin") ||
		strings.HasSuffix(perm, ":book") || strings.HasSuffix(perm, ":update") ||
		strings.HasSuffix(perm, ":receive") || strings.HasSuffix(perm, ":topup") ||
		strings.HasSuffix(perm, ":transfer") || strings.HasSuffix(perm, ":pay") ||
		strings.HasSuffix(perm, ":create:self") {
		return "OPERATE"
	}
	return "MANAGE"
}

// HasMoneyImpact indica si un permiso requiere confirmación fuerte 🔒 al asignarse.
func HasMoneyImpact(perm string) bool {
	return moneyPermissions[perm]
}

// RoleHasMoneyImpact indica si alguno de los permisos del rol requiere confirmación fuerte 🔒.
func RoleHasMoneyImpact(perms []string) bool {
	for _, p := range perms {
		if moneyPermissions[p] {
			return true
		}
	}
	return false
}

// BuildPermissionCatalog construye el catálogo ordenado de permisos para GetAccessCatalog.
// Capability lleva las capacidades separadas por coma (basta cualquiera); vacío = núcleo o plataforma.
func BuildPermissionCatalog() []PermissionCatalogEntry {
	out := make([]PermissionCatalogEntry, 0, len(AllPermissions))
	for _, p := range AllPermissions {
		caps := PermissionCapabilityMap[p]
		capKey := ""
		if !IsCorePermission(p) && !IsPlatformPermission(p) {
			capKey = strings.Join(caps, ",")
		}
		out = append(out, PermissionCatalogEntry{
			Key:        p,
			Module:     PermissionModule(p),
			Level:      PermissionLevel(p),
			Capability: capKey,
			Money:      HasMoneyImpact(p),
			Platform:   IsPlatformPermission(p),
		})
	}
	return out
}

// ModuleOrderIDs devuelve los IDs de módulos en orden de navegación (R10).
func ModuleOrderIDs() []string {
	out := make([]string, len(moduleOrder))
	for i, m := range moduleOrder {
		out[i] = m.id
	}
	return out
}

// CapabilitiesForPermission devuelve las capacidades asociadas a un permiso (cualquiera basta).
func CapabilitiesForPermission(perm string) ([]string, bool) {
	caps, ok := PermissionCapabilityMap[perm]
	return caps, ok
}

// IsCorePermission indica si el permiso es de núcleo (siempre activo para cualquier persona con acceso).
func IsCorePermission(perm string) bool {
	caps := PermissionCapabilityMap[perm]
	return len(caps) == 1 && caps[0] == CoreCapability
}

// IsPlatformPermission indica si el permiso es exclusivo de administración de plataforma.
func IsPlatformPermission(perm string) bool {
	caps := PermissionCapabilityMap[perm]
	return len(caps) == 1 && caps[0] == PlatformCapability
}

// DefaultEnabledCapabilities es el conjunto que se asume cuando un negocio aún no tiene
// capacidades registradas: todas las del catálogo salvo las sujetas a preguntas abiertas.
func DefaultEnabledCapabilities() map[string]bool {
	out := make(map[string]bool, len(AllCapabilityEntries))
	for _, c := range AllCapabilityEntries {
		if !GatedCapabilities[c.Key] {
			out[c.Key] = true
		}
	}
	return out
}

// FilterPermissionsByCapabilities aplica R21: conserva los permisos de núcleo y plataforma y
// los de negocio con al menos una capacidad encendida. Un permiso fuera del catálogo se descarta.
// enabledCaps nil = negocio sin capacidades registradas (DefaultEnabledCapabilities).
func FilterPermissionsByCapabilities(perms []string, enabledCaps map[string]bool) []string {
	if enabledCaps == nil {
		enabledCaps = DefaultEnabledCapabilities()
	}
	out := []string{}
	for _, p := range perms {
		caps, ok := PermissionCapabilityMap[p]
		if !ok {
			continue
		}
		if IsCorePermission(p) || IsPlatformPermission(p) {
			out = append(out, p)
			continue
		}
		for _, c := range caps {
			if enabledCaps[c] {
				out = append(out, p)
				break
			}
		}
	}
	return out
}
