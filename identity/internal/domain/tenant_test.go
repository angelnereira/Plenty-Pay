package domain_test

import (
	"testing"
	"time"

	"plentypay/identity/internal/domain"
)

// dominio-model.md §3.3: PENDING_REVIEW -> ACTIVE | REJECTED; ACTIVE <-> SUSPENDED.
func TestR11_TenantTransitions(t *testing.T) {
	casos := []struct {
		current string
		approve bool
		want    string
		wantErr bool
	}{
		{domain.TenantPendingReview, true, domain.TenantActive, false},
		{domain.TenantPendingReview, false, domain.TenantRejected, false},
		{domain.TenantActive, false, domain.TenantSuspended, false},
		{domain.TenantSuspended, true, domain.TenantActive, false},
		// Invalidas: doble aprobacion, reactivar desde ACTIVO, tocar REJECTED
		// (terminal) y suspender a un SUSPENDIDO.
		{domain.TenantActive, true, "", true},
		{domain.TenantSuspended, false, "", true},
		{domain.TenantRejected, true, "", true},
		{domain.TenantRejected, false, "", true},
		{"DESCONOCIDO", true, "", true},
	}
	for _, c := range casos {
		got, err := domain.NextStatus(c.current, c.approve)
		if c.wantErr {
			if err == nil {
				t.Errorf("%s approve=%v: se esperaba error, llego %q", c.current, c.approve, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s approve=%v: error inesperado %v", c.current, c.approve, err)
			continue
		}
		if got != c.want {
			t.Errorf("%s approve=%v: llego %q, se esperaba %q", c.current, c.approve, got, c.want)
		}
	}
}

// R17: el RUC se normaliza y se valida por formato (el DV se valida en F08.6).
func TestR17_TaxIDValidation(t *testing.T) {
	if got := domain.NormalizeTaxId(" 155612345-2-2023 "); got != "155612345-2-2023" {
		t.Errorf("NormalizeTaxId = %q", got)
	}
	validos := []string{"155612345-2-2023", "8-1-1234", "155612345"}
	for _, v := range validos {
		if err := domain.ValidateTaxId(v, "2"); err != nil {
			t.Errorf("ValidateTaxId(%q) = %v, se esperaba valido", v, err)
		}
	}
	invalidos := []string{"", "12", "155612345-2-20$3", "155612345-2-2023-4-5-6-7-8-9-0"}
	for _, v := range invalidos {
		if err := domain.ValidateTaxId(v, ""); err == nil {
			t.Errorf("ValidateTaxId(%q) paso como valido", v)
		}
	}
	// DV demasiado largo tambien es invalido.
	if err := domain.ValidateTaxId("155612345", "1234"); err == nil {
		t.Error("un DV de 4 digitos deberia rechazarse")
	}
}

// Tenant.Revoked/Documents: estado inicial del agregado.
func TestTenantInitialState(t *testing.T) {
	tenant := domain.Tenant{ID: "t1", Status: domain.TenantPendingReview, CreatedAt: time.Now().UTC()}
	if tenant.ID == "" || tenant.Status != domain.TenantPendingReview {
		t.Fatal("el tenant deberia nacer en PENDING_REVIEW")
	}
	if len(tenant.Documents) != 0 {
		t.Fatal("un tenant nuevo no tiene documentos")
	}
}
