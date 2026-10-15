package domain

import (
	"testing"
)

func TestFlag_Evaluate(t *testing.T) {
	flag := &Flag{
		Key:            "test.flag",
		Enabled:        true,
		RolloutPercent: 50,
		SafeDefault:    false,
	}

	// Flag deshabilitado
	flagDisabled := &Flag{Key: "test.disabled", Enabled: false}
	if flagDisabled.Evaluate(&FlagContext{UserID: "u1"}) {
		t.Fatal("flag deshabilitado no debe evaluar a true")
	}

	// Rollout determinista: mismo user siempre da el mismo resultado
	ctx1 := &FlagContext{UserID: "usr-abc-123"}
	res1 := flag.Evaluate(ctx1)
	for i := 0; i < 10; i++ {
		if flag.Evaluate(ctx1) != res1 {
			t.Fatal("evaluación debe ser determinista para el mismo usuario")
		}
	}

	// Whitelist de tenant
	tenantFlag := &Flag{
		Key:          "tenant.flag",
		Enabled:      true,
		AllowTenants: []string{"tenant-1", "tenant-2"},
	}
	if !tenantFlag.Evaluate(&FlagContext{TenantID: "tenant-1"}) {
		t.Fatal("tenant en whitelist debe evaluar a true")
	}
	if tenantFlag.Evaluate(&FlagContext{TenantID: "tenant-99"}) {
		t.Fatal("tenant fuera de whitelist debe evaluar a false")
	}

	// Whitelist de roles
	roleFlag := &Flag{
		Key:        "role.flag",
		Enabled:    true,
		AllowRoles: []string{"PLATFORM_ADMIN"},
	}
	if !roleFlag.Evaluate(&FlagContext{Role: "PLATFORM_ADMIN"}) {
		t.Fatal("rol en whitelist debe evaluar a true")
	}
	if roleFlag.Evaluate(&FlagContext{Role: "CUSTOMER"}) {
		t.Fatal("rol fuera de whitelist debe evaluar a false")
	}
}

func TestConfigValidator(t *testing.T) {
	intMin := int64(10)
	intMax := int64(100)
	intValidator := &SimpleTypeValidator{
		ExpectedType: "integer",
		MinInt:       &intMin,
		MaxInt:       &intMax,
	}

	if err := intValidator.Validate("50"); err != nil {
		t.Fatalf("50 debería ser válido: %v", err)
	}
	if err := intValidator.Validate("5"); err == nil {
		t.Fatal("5 debería fallar por menor a mínimo")
	}
	if err := intValidator.Validate("150"); err == nil {
		t.Fatal("150 debería fallar por mayor a máximo")
	}
	if err := intValidator.Validate("no-un-numero"); err == nil {
		t.Fatal("texto debería fallar para entero")
	}

	boolValidator := &SimpleTypeValidator{ExpectedType: "boolean"}
	if err := boolValidator.Validate("true"); err != nil {
		t.Fatal("true debe ser válido")
	}
	if err := boolValidator.Validate("false"); err != nil {
		t.Fatal("false debe ser válido")
	}
	if err := boolValidator.Validate("quizas"); err == nil {
		t.Fatal("quizas debe ser inválido para boolean")
	}

	jsonArrValidator := &SimpleTypeValidator{ExpectedType: "json_array"}
	if err := jsonArrValidator.Validate(`["2026-01-01", "2026-11-03"]`); err != nil {
		t.Fatalf("arreglo JSON debe ser válido: %v", err)
	}
	if err := jsonArrValidator.Validate(`{ "no": "arreglo" }`); err == nil {
		t.Fatal("objeto JSON no debe ser válido como arreglo")
	}
}

func TestCompareSemver(t *testing.T) {
	tests := []struct {
		v1, v2 string
		want   int
	}{
		{"1.0.0", "1.0.0", 0},
		{"1.0.0", "1.0.1", -1},
		{"1.2.0", "1.1.9", 1},
		{"2.0.0", "1.99.99", 1},
		{"0.9.5", "1.0.0", -1},
	}

	for _, tt := range tests {
		if got := CompareSemver(tt.v1, tt.v2); got != tt.want {
			t.Errorf("CompareSemver(%q, %q) = %d, want %d", tt.v1, tt.v2, got, tt.want)
		}
	}
}
