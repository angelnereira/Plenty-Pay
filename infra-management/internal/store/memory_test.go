package store

import (
	"context"
	"errors"
	"testing"
	"time"

	"plentypay/infra-management/internal/domain"
)

func TestMemoryStore_InitialFlagsAndConfigs(t *testing.T) {
	s := NewMemoryStore()
	ctx := context.Background()

	// Flags iniciales existen
	flag, err := s.GetFlag(ctx, "rail.yappy.enabled")
	if err != nil || !flag.Enabled {
		t.Fatalf("rail.yappy.enabled debe existir y estar enabled: %v, %+v", err, flag)
	}

	flags, err := s.ListFlags(ctx)
	if err != nil || len(flags) < 7 {
		t.Fatalf("deben existir al menos 7 flags iniciales, hay %d", len(flags))
	}

	// Configs iniciales existen
	configs, err := s.GetConfig(ctx, []string{"limits.payment.max_minor", "legal.pa.itbms.standard_bps"}, "global")
	if err != nil || len(configs) != 2 {
		t.Fatalf("configs iniciales deben existir: %v, %+v", err, configs)
	}
}

func TestMemoryStore_UpsertFlagAndSubscribe(t *testing.T) {
	s := NewMemoryStore()
	ctx := context.Background()

	ch, cancel := s.Subscribe(ctx)
	defer cancel()

	// Rollout inválido (> 100) debe ser rechazado
	badFlag := &domain.Flag{
		Key:            "bad.flag",
		RolloutPercent: 150,
	}
	if err := s.UpsertFlag(ctx, badFlag); !errors.Is(err, domain.ErrInvalidFlagRule) {
		t.Fatalf("rollout > 100 debe fallar con ErrInvalidFlagRule, obtuve: %v", err)
	}

	// Flag válido
	validFlag := &domain.Flag{
		Key:            "new.feature",
		Enabled:        true,
		RolloutPercent: 50,
	}
	if err := s.UpsertFlag(ctx, validFlag); err != nil {
		t.Fatalf("UpsertFlag falló: %v", err)
	}

	select {
	case ev := <-ch:
		if ev.Type != "flag" || ev.Key != "new.feature" {
			t.Fatalf("evento inesperado: %+v", ev)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout esperando notificación de cambio de flag")
	}
}

func TestMemoryStore_ConfigValidationRejection(t *testing.T) {
	s := NewMemoryStore()
	ctx := context.Background()

	// Valor inválido para limits.payment.max_minor (debe ser entero > 0)
	invalidEntry := &domain.ConfigEntry{
		Key:   "limits.payment.max_minor",
		Value: "-500", // negativo no permitido
	}
	if err := s.SetConfig(ctx, invalidEntry); !errors.Is(err, domain.ErrInvalidConfigValue) {
		t.Fatalf("valor negativo debe ser rechazado con ErrInvalidConfigValue, obtuve: %v", err)
	}

	invalidText := &domain.ConfigEntry{
		Key:   "limits.payment.max_minor",
		Value: "no-es-numero",
	}
	if err := s.SetConfig(ctx, invalidText); !errors.Is(err, domain.ErrInvalidConfigValue) {
		t.Fatalf("texto en entero debe ser rechazado con ErrInvalidConfigValue, obtuve: %v", err)
	}

	// Valor válido
	validEntry := &domain.ConfigEntry{
		Key:   "limits.payment.max_minor",
		Value: "2000000",
	}
	if err := s.SetConfig(ctx, validEntry); err != nil {
		t.Fatalf("valor válido no debe fallar: %v", err)
	}

	retrieved, err := s.GetConfig(ctx, []string{"limits.payment.max_minor"}, "global")
	if err != nil || len(retrieved) != 1 || retrieved[0].Value != "2000000" {
		t.Fatalf("GetConfig no retornó el valor actualizado: %v, %+v", err, retrieved)
	}
}

func TestMemoryStore_MaintenanceMode(t *testing.T) {
	s := NewMemoryStore()
	ctx := context.Background()

	m, err := s.GetMaintenance(ctx)
	if err != nil || m.Enabled {
		t.Fatalf("mantenimiento inicial debe ser false: %+v", m)
	}

	until := time.Now().UTC().Add(2 * time.Hour)
	err = s.SetMaintenance(ctx, &domain.MaintenanceState{
		Enabled: true,
		Scope:   "global",
		Message: "Mantenimiento programado por actualización",
		Until:   until,
	})
	if err != nil {
		t.Fatalf("SetMaintenance falló: %v", err)
	}

	m2, _ := s.GetMaintenance(ctx)
	if !m2.Enabled || m2.Message != "Mantenimiento programado por actualización" {
		t.Fatalf("mantenimiento actualizado inconsistente: %+v", m2)
	}
}
