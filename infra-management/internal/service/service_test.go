package service

import (
	"context"
	"testing"
	"time"

	"plentypay/infra-management/internal/domain"
	"plentypay/infra-management/internal/store"
)

func TestService_EvaluateFlagsAndFastPropagation(t *testing.T) {
	mem := store.NewMemoryStore()
	svc := NewInfraService(mem, "http://api.plentypay.test", "ws://api.plentypay.test/v1/realtime")
	defer svc.Close()
	ctx := context.Background()

	// Evaluar flags iniciales
	vals, err := svc.EvaluateFlags(ctx, []string{"rail.yappy.enabled", "payments.enabled", "analytics.ask.enabled"}, nil)
	if err != nil {
		t.Fatalf("EvaluateFlags: %v", err)
	}
	if !vals["rail.yappy.enabled"] || !vals["payments.enabled"] || vals["analytics.ask.enabled"] {
		t.Fatalf("valores de flags inconsistentes: %+v", vals)
	}

	// F05.7: Pausa de cobros vía UpsertFlag visible en el servicio en <= 5 s (SPEC §5 R6)
	_, err = svc.UpsertFlag(ctx, &domain.Flag{
		Key:            "rail.yappy.enabled",
		Description:    "Deshabilitado por mantenimiento del riel",
		Enabled:        false,
		RolloutPercent: 0,
		SafeDefault:    false,
	})
	if err != nil {
		t.Fatalf("UpsertFlag: %v", err)
	}

	// Verificar propagación rápida
	propagated := false
	start := time.Now()
	for time.Since(start) < 5*time.Second {
		v, _ := svc.EvaluateFlags(ctx, []string{"rail.yappy.enabled"}, nil)
		if !v["rail.yappy.enabled"] {
			propagated = true
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	if !propagated {
		t.Fatal("F05.7: cambio de flag no se propagó al servicio en <= 5 s")
	}
}

func TestService_ConfigValidationRejection(t *testing.T) {
	mem := store.NewMemoryStore()
	svc := NewInfraService(mem, "", "")
	defer svc.Close()
	ctx := context.Background()

	// F05.8: Configuración con JSON Schema rechaza valor inválido
	_, err := svc.SetConfig(ctx, &domain.ConfigEntry{
		Key:   "limits.payment.max_minor",
		Value: "valor-invalido",
	})
	if err == nil {
		t.Fatal("F05.8: SetConfig debía rechazar valor no entero")
	}

	// Valor válido
	okEntry, err := svc.SetConfig(ctx, &domain.ConfigEntry{
		Key:   "limits.payment.max_minor",
		Value: "5000000",
	})
	if err != nil || okEntry.Value != "5000000" {
		t.Fatalf("SetConfig valor válido falló: %v, %+v", err, okEntry)
	}
}

func TestService_GetClientConfigForcesUpdate(t *testing.T) {
	mem := store.NewMemoryStore()
	svc := NewInfraService(mem, "https://api.plentypay.internal", "wss://api.plentypay.internal/v1/realtime")
	defer svc.Close()
	ctx := context.Background()

	// Fijar versión mínima 2.0.0
	_, _ = svc.SetConfig(ctx, &domain.ConfigEntry{
		Key:   "client.min_app_version",
		Value: "2.0.0",
	})
	_, _ = svc.SetConfig(ctx, &domain.ConfigEntry{
		Key:   "client.latest_app_version",
		Value: "2.1.0",
	})

	// App en versión 1.5.0 debe recibir update_required = true (F05.9)
	cfgOld, err := svc.GetClientConfig(ctx, "android", "1.5.0")
	if err != nil {
		t.Fatalf("GetClientConfig: %v", err)
	}
	if !cfgOld.UpdateRequired {
		t.Fatalf("F05.9: app con versión inferior a mínima debe tener update_required=true: %+v", cfgOld)
	}
	if cfgOld.MinimumAppVersion != "2.0.0" || cfgOld.LatestAppVersion != "2.1.0" {
		t.Fatalf("versiones inconsistentes: %+v", cfgOld)
	}

	// App en versión 2.0.0 o superior no requiere actualización
	cfgNew, err := svc.GetClientConfig(ctx, "ios", "2.0.0")
	if err != nil {
		t.Fatalf("GetClientConfig: %v", err)
	}
	if cfgNew.UpdateRequired {
		t.Fatalf("app con versión igual a mínima no debe exigir actualización: %+v", cfgNew)
	}
}

func TestService_MaintenanceModeAndListServices(t *testing.T) {
	mem := store.NewMemoryStore()
	svc := NewInfraService(mem, "", "")
	defer svc.Close()
	ctx := context.Background()

	// Mantenimiento
	mState, err := svc.SetMaintenanceMode(ctx, &domain.MaintenanceState{
		Enabled: true,
		Scope:   "global",
		Message: "Actualización de plataforma",
	})
	if err != nil || !mState.Enabled {
		t.Fatalf("SetMaintenanceMode: %v, %+v", err, mState)
	}

	gotState, err := svc.GetMaintenanceState(ctx)
	if err != nil || !gotState.Enabled {
		t.Fatalf("GetMaintenanceState: %v, %+v", err, gotState)
	}

	// ListServices
	svcs, err := svc.ListServices(ctx)
	if err != nil || len(svcs) < 15 {
		t.Fatalf("ListServices: %v, len=%d", err, len(svcs))
	}
}
