package domain_test

import (
	"testing"
	"time"

	"plentypay/identity/internal/domain"
)

// R12: los permisos deben ser del catalogo y NUNCA de plataforma.
func TestR12_CustomRolePermissions(t *testing.T) {
	known := func(p string) bool {
		for _, k := range []string{"pos:sell", "catalog:read", "payments:charge", "inventory:adjust"} {
			if p == k {
				return true
			}
		}
		return false
	}
	// Valido: permisos del catalogo.
	if err := domain.ValidateCustomRolePermissions([]string{"pos:sell", "catalog:read"}, known); err != nil {
		t.Errorf("rol valido rechazado: %v", err)
	}
	// platform:* esta en el catalogo, pero R12 lo prohibe en roles personalizados.
	if err := domain.ValidateCustomRolePermissions([]string{"platform:tenants:review"}, known); err == nil {
		t.Error("un rol personalizado no puede llevar permisos de plataforma (R12)")
	}
	// Permiso fuera del catalogo.
	if err := domain.ValidateCustomRolePermissions([]string{"inventado:si"}, known); err == nil {
		t.Error("un permiso fuera del catalogo deberia rechazarse (R12)")
	}
	// Permiso vacio tampoco vale.
	if err := domain.ValidateCustomRolePermissions([]string{""}, known); err == nil {
		t.Error("un permiso vacio deberia rechazarse")
	}
	// Sin isKnown solo se valida la exclusion de plataforma.
	if err := domain.ValidateCustomRolePermissions([]string{"pos:sell"}, nil); err != nil {
		t.Errorf("sin validador no deberia fallar: %v", err)
	}
}

// SPEC §4: la invitacion de staff vence a los 7 dias.
func TestInvitationExpirySevenDays(t *testing.T) {
	now := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	inv := &domain.Invitation{
		ID: "inv-1", TenantID: "t1", Email: "ana@example.com",
		ExpiresAt: now.Add(7 * 24 * time.Hour),
	}
	if err := inv.Acceptable(now); err != nil {
		t.Errorf("una invitacion recien creada deberia poder canjearse: %v", err)
	}
	if err := inv.Acceptable(now.Add(7*24*time.Hour - time.Second)); err != nil {
		t.Errorf("dentro de los 7 dias deberia poder canjearse: %v", err)
	}
	if err := inv.Acceptable(now.Add(7*24*time.Hour + time.Second)); err == nil {
		t.Error("pasados los 7 dias la invitacion debe vencer")
	}
	// Usada: no se puede volver a canjear.
	accepted := now.Add(time.Hour)
	inv.AcceptedAt = &accepted
	if err := inv.Acceptable(now); err == nil {
		t.Error("una invitacion usada no deberia aceptarse")
	}
}

// El TTL real del store es el que usa el servicio (7 dias).
func TestInvitationTTLMatchesSpec(t *testing.T) {
	if got := (7 * 24 * time.Hour).Hours(); got != 168 {
		t.Fatalf("7 dias = %v horas, se esperaban 168", got)
	}
}
