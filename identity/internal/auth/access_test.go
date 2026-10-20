package auth_test

import (
	"reflect"
	"slices"
	"strings"
	"testing"

	"plentypay/identity/internal/auth"
)

func enabledFrom(derived map[string]string) map[string]bool {
	out := map[string]bool{}
	for c := range derived {
		out[c] = true
	}
	return out
}

func withBase(perms ...string) []string {
	return auth.PermissionsWithBase(perms)
}

// V1: persona sin negocio → solo la base y los módulos personales.
func TestR10_CustomerOnly(t *testing.T) {
	got := auth.ResolveAccess(auth.AccessInput{BaseRole: "CUSTOMER"})
	want := []string{"catalog:read", "notifications:read:self", "orders:create:self", "orders:read:self",
		"wallet:pay", "wallet:read", "wallet:topup", "wallet:transfer"}
	if !reflect.DeepEqual(got.Permissions, want) {
		t.Fatalf("permisos = %v, want %v", got.Permissions, want)
	}
	if !reflect.DeepEqual(got.Modules, []string{"wallet", "marketplace"}) {
		t.Fatalf("modulos = %v", got.Modules)
	}
	if got.BranchScope != "" || len(got.Capabilities) != 0 {
		t.Fatalf("un cliente no tiene alcance ni capacidades: %+v", got)
	}
}

// V2: dueño de una barbería con inventario, entregas y pedidos apagados.
func TestR21_OwnerLimitedByCapabilities(t *testing.T) {
	caps := enabledFrom(auth.DeriveCapabilities("BARBERSHOP", nil, nil))
	for _, c := range []string{"inventory.stock", "inventory.purchasing", "logistics.own_fleet", "orders.marketplace"} {
		if caps[c] {
			t.Fatalf("una barbería no nace con %s", c)
		}
	}
	got := auth.ResolveAccess(auth.AccessInput{BaseRole: "BUSINESS_OWNER", MembershipActive: true, EnabledCapabilities: caps})
	for _, p := range got.Permissions {
		if strings.HasPrefix(p, "inventory:") || strings.HasPrefix(p, "logistics:") || p == "orders:read" || p == "orders:manage" {
			t.Fatalf("permiso de capacidad apagada presente: %s", p)
		}
	}
	for _, p := range []string{"pos:sell", "appointments:manage", "catalog:write", "payments:charge", "admin:roles:manage", "payroll:run:create"} {
		if !slices.Contains(got.Permissions, p) {
			t.Fatalf("falta %s en %v", p, got.Permissions)
		}
	}
	want := []string{"wallet", "marketplace", "pos", "appointments", "catalog", "finance", "payroll", "analytics", "admin"}
	if !reflect.DeepEqual(got.Modules, want) {
		t.Fatalf("modulos = %v, want %v", got.Modules, want)
	}
	if got.BranchScope != auth.BranchScopeAll {
		t.Fatalf("el dueño siempre tiene alcance TENANT: %q", got.BranchScope)
	}
}

// V3: barbero con plantilla stylist y alcance «Sucursal Centro». La capacidad
// payroll.commissions está sujeta a Q-32: aquí se enciende explícitamente para
// verificar el mecanismo; ningún perfil la enciende por defecto.
func TestR24_StylistBranchScope(t *testing.T) {
	var stylist []string
	for _, tpl := range auth.RoleTemplates(nil) {
		if tpl.Key == "stylist" {
			stylist = tpl.Permissions
		}
	}
	if stylist == nil {
		t.Fatal("no existe la plantilla stylist")
	}
	caps := enabledFrom(auth.DeriveCapabilities("BARBERSHOP", nil, nil))
	if caps["payroll.commissions"] {
		t.Fatal("payroll.commissions no se enciende por perfil mientras Q-32 siga abierta")
	}
	caps["payroll.commissions"] = true
	const centro = "0b6f8f1e-0000-7000-8000-00000000c3n7"
	got := auth.ResolveAccess(auth.AccessInput{
		BaseRole: "BUSINESS_STAFF", MembershipActive: true, RolePermissions: stylist,
		EnabledCapabilities: caps, Scope: "BRANCHES", BranchIDs: []string{centro},
	})
	want := withBase("appointments:read:self", "appointments:checkin", "payroll:commission:read:self",
		"payroll:attendance:record", "payroll:payslip:read:self")
	if !reflect.DeepEqual(got.Permissions, want) {
		t.Fatalf("permisos = %v, want %v", got.Permissions, want)
	}
	if !reflect.DeepEqual(got.Modules, []string{"wallet", "marketplace", "appointments", "payroll"}) {
		t.Fatalf("modulos = %v", got.Modules)
	}
	if got.BranchScope != centro {
		t.Fatalf("alcance = %q, want %q", got.BranchScope, centro)
	}
}

// V4: un rol con inventory:adjust en un restaurante que apagó inventario; al
// encenderlo vuelve sin editar el rol.
func TestR21_DisabledCapabilityDropsPermission(t *testing.T) {
	caps := enabledFrom(auth.DeriveCapabilities("RESTAURANT", nil, nil))
	role := []string{"inventory:adjust", "pos:sell"}
	caps["inventory.stock"] = false
	off := auth.ResolveAccess(auth.AccessInput{BaseRole: "BUSINESS_STAFF", MembershipActive: true, RolePermissions: role, EnabledCapabilities: caps})
	if slices.Contains(off.Permissions, "inventory:adjust") {
		t.Fatal("inventory:adjust no debe estar con inventario apagado")
	}
	caps["inventory.stock"] = true
	on := auth.ResolveAccess(auth.AccessInput{BaseRole: "BUSINESS_STAFF", MembershipActive: true, RolePermissions: role, EnabledCapabilities: caps})
	if !slices.Contains(on.Permissions, "inventory:adjust") {
		t.Fatal("inventory:adjust debe volver al encender inventario")
	}
}

// V5: el estado del negocio no quita permisos (R11 lo aplica cada servicio).
func TestR11_PendingTenantKeepsPermissions(t *testing.T) {
	cashier := auth.Presets()["cashier"]
	got := auth.ResolveAccess(auth.AccessInput{BaseRole: "BUSINESS_STAFF", MembershipActive: true, RolePermissions: cashier})
	if !slices.Contains(got.Permissions, "payments:charge") {
		t.Fatalf("payments:charge debe estar aunque el negocio esté PENDING_REVIEW: %v", got.Permissions)
	}
}

// V6: rol propio «Cajero nocturno» = cashier − fiscal:issue + pos:read → exactamente
// esos permisos + base; nunca el preset cashier.
func TestR22_AssignedCustomRoleResolves_Pure(t *testing.T) {
	var role []string
	for _, p := range auth.Presets()["cashier"] {
		if p != "fiscal:issue" {
			role = append(role, p)
		}
	}
	role = append(role, "pos:read")
	got := auth.ResolveAccess(auth.AccessInput{BaseRole: "BUSINESS_STAFF", MembershipActive: true, RolePermissions: role})
	if !reflect.DeepEqual(got.Permissions, withBase(role...)) {
		t.Fatalf("permisos = %v", got.Permissions)
	}
	if slices.Contains(got.Permissions, "fiscal:issue") {
		t.Fatal("el preset cashier no debe filtrarse")
	}
}

// R22: staff sin rol asignado → solo la base (deny-by-default).
func TestR22_StaffWithoutRoleGetsBase(t *testing.T) {
	got := auth.ResolveAccess(auth.AccessInput{BaseRole: "BUSINESS_STAFF", MembershipActive: true})
	if !reflect.DeepEqual(got.Permissions, withBase()) {
		t.Fatalf("permisos = %v", got.Permissions)
	}
}

// R22: membresía suspendida o desactivada → solo la base.
func TestR22_InactiveMembershipGetsBase(t *testing.T) {
	got := auth.ResolveAccess(auth.AccessInput{BaseRole: "BUSINESS_OWNER", MembershipActive: false})
	if !reflect.DeepEqual(got.Permissions, withBase()) {
		t.Fatalf("permisos = %v", got.Permissions)
	}
}

// R12: un rol del negocio con platform:* nunca lo concede, aunque llegue guardado.
func TestR12_RolePermissionsNeverGrantPlatform(t *testing.T) {
	got := auth.ResolveAccess(auth.AccessInput{BaseRole: "BUSINESS_STAFF", MembershipActive: true, RolePermissions: []string{"platform:tenants:review"}})
	if slices.Contains(got.Permissions, "platform:tenants:review") {
		t.Fatal("platform:* no se concede por rol del negocio")
	}
}

// R24: alcance BRANCHES sin sucursales activas viaja vacío (los servicios no ven ninguna).
func TestR24_BranchScopeEncoding(t *testing.T) {
	if got := auth.EncodeBranchScope("TENANT", nil); got != "*" {
		t.Fatalf("TENANT = %q", got)
	}
	if got := auth.EncodeBranchScope("BRANCHES", []string{"b", "a"}); got != "a,b" {
		t.Fatalf("BRANCHES = %q", got)
	}
	if got := auth.EncodeBranchScope("BRANCHES", nil); got != "" {
		t.Fatalf("BRANCHES vacío = %q", got)
	}
}

// R20: las respuestas explícitas del dueño ganan sobre la vertical; un rasgo
// apagado no deja su capacidad encendida por la sugerencia de la vertical.
func TestR20_TraitAnswersOverrideVertical(t *testing.T) {
	caps := auth.DeriveCapabilities("retail", nil, map[string]bool{"tracks_inventory": false, "table_service": true})
	if _, ok := caps["inventory.stock"]; ok {
		t.Fatal("tracks_inventory=false debe apagar inventory.stock aunque la vertical lo sugiera")
	}
	if caps["pos.tables"] != auth.SourceTrait {
		t.Fatalf("table_service=true enciende pos.tables con fuente TRAIT: %v", caps["pos.tables"])
	}
	traits := auth.EffectiveTraits("retail", nil, map[string]bool{"tracks_inventory": false})
	if traits["tracks_inventory"] || !traits["sells_goods"] {
		t.Fatalf("rasgos efectivos = %v", traits)
	}
}

// Q-21/Q-32/Q-33: ninguna vertical ni rasgo enciende capacidades sujetas a preguntas abiertas.
func TestR20_GatedCapabilitiesNeverDerived(t *testing.T) {
	all := map[string]bool{}
	for _, tr := range auth.AllTraits {
		all[tr.Key] = true
	}
	for _, v := range auth.AllVerticals {
		caps := auth.DeriveCapabilities(v.Key, nil, all)
		for g := range auth.GatedCapabilities {
			if _, ok := caps[g]; ok {
				t.Fatalf("vertical %s enciende %s", v.Key, g)
			}
		}
	}
}

// Cada plantilla de rol solo contiene permisos del catálogo y nunca platform:* (R12, buena práctica 8).
func TestR12_RoleTemplatesUseCatalog(t *testing.T) {
	for _, tpl := range auth.RoleTemplates(nil) {
		for _, p := range tpl.Permissions {
			if !auth.IsKnownPermission(p) || auth.IsPlatformPermission(p) {
				t.Fatalf("plantilla %s contiene %s", tpl.Key, p)
			}
		}
	}
	for _, v := range auth.AllVerticals {
		for _, c := range v.SuggestedCapabilities {
			if !auth.IsKnownCapability(c) {
				t.Fatalf("vertical %s sugiere capacidad desconocida %s", v.Key, c)
			}
		}
	}
	for _, perm := range auth.AllPermissions {
		caps, _ := auth.CapabilitiesForPermission(perm)
		for _, c := range caps {
			if c != auth.CoreCapability && c != auth.PlatformCapability && !auth.IsKnownCapability(c) {
				t.Fatalf("%s apunta a capacidad desconocida %s", perm, c)
			}
		}
	}
}
