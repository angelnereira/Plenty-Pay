package server

import (
	"context"
	"testing"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"plentypay/infra-management/internal/pb"
	"plentypay/infra-management/internal/service"
	"plentypay/infra-management/internal/store"
)

func newTestServer() *Server {
	mem := store.NewMemoryStore()
	svc := service.NewInfraService(mem, "https://api.plentypay.internal", "wss://api.plentypay.internal/v1/realtime")
	return NewServer(svc)
}

func extractReason(err error) string {
	st, ok := status.FromError(err)
	if !ok {
		return ""
	}
	for _, detail := range st.Details() {
		if ei, ok := detail.(*errdetails.ErrorInfo); ok {
			return ei.Reason
		}
	}
	return ""
}

func TestServer_EvaluateAndUpsertFlags(t *testing.T) {
	srv := newTestServer()
	ctx := context.Background()

	// Evaluar flags
	evalResp, err := srv.EvaluateFlags(ctx, &pb.EvaluateFlagsRequest{
		Keys: []string{"rail.yappy.enabled", "marketplace.enabled"},
	})
	if err != nil {
		t.Fatalf("EvaluateFlags falló: %v", err)
	}
	if !evalResp.Values["rail.yappy.enabled"] || !evalResp.Values["marketplace.enabled"] {
		t.Fatalf("valores de flags esperados true: %+v", evalResp.Values)
	}

	// Upsert con rollout inválido (> 100) -> INVALID_FLAG_RULE
	_, err = srv.UpsertFlag(ctx, &pb.UpsertFlagRequest{
		Flag: &pb.Flag{
			Key:            "bad.rollout",
			RolloutPercent: 200,
		},
	})
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("esperaba InvalidArgument, obtuve: %v", err)
	}
	if reason := extractReason(err); reason != "INVALID_FLAG_RULE" {
		t.Fatalf("esperaba reason INVALID_FLAG_RULE, obtuve: %q", reason)
	}

	// Upsert válido
	upResp, err := srv.UpsertFlag(ctx, &pb.UpsertFlagRequest{
		Flag: &pb.Flag{
			Key:            "new.feature",
			Description:    "Nueva función",
			Enabled:        true,
			RolloutPercent: 100,
		},
	})
	if err != nil || upResp.Key != "new.feature" {
		t.Fatalf("UpsertFlag válido falló: %v, %+v", err, upResp)
	}
}

func TestServer_ConfigValidationRejection(t *testing.T) {
	srv := newTestServer()
	ctx := context.Background()

	// Valor inválido (texto no entero en un límite) -> INVALID_CONFIG_VALUE
	_, err := srv.SetConfig(ctx, &pb.SetConfigRequest{
		Entry: &pb.ConfigEntry{
			Key:   "limits.payment.max_minor",
			Value: "un-millon-de-dolares",
		},
	})
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("esperaba InvalidArgument, obtuve: %v", err)
	}
	if reason := extractReason(err); reason != "INVALID_CONFIG_VALUE" {
		t.Fatalf("esperaba reason INVALID_CONFIG_VALUE, obtuve: %q", reason)
	}

	// Valor válido
	setResp, err := srv.SetConfig(ctx, &pb.SetConfigRequest{
		Entry: &pb.ConfigEntry{
			Key:   "limits.payment.max_minor",
			Value: "2500000",
		},
	})
	if err != nil || setResp.Value != "2500000" {
		t.Fatalf("SetConfig válido falló: %v, %+v", err, setResp)
	}

	// GetConfig
	getResp, err := srv.GetConfig(ctx, &pb.GetConfigRequest{
		Keys: []string{"limits.payment.max_minor"},
	})
	if err != nil || len(getResp.Entries) != 1 || getResp.Entries[0].Value != "2500000" {
		t.Fatalf("GetConfig inconsistente: %v, %+v", err, getResp)
	}
}

func TestServer_GetClientConfigAndMaintenance(t *testing.T) {
	srv := newTestServer()
	ctx := context.Background()

	// Fijar versión mínima a 2.0.0
	_, _ = srv.SetConfig(ctx, &pb.SetConfigRequest{
		Entry: &pb.ConfigEntry{Key: "client.min_app_version", Value: "2.0.0"},
	})

	// App 1.0.0 -> update_required = true
	cfg, err := srv.GetClientConfig(ctx, &pb.GetClientConfigRequest{
		Platform:   "android",
		AppVersion: "1.0.0",
	})
	if err != nil {
		t.Fatalf("GetClientConfig falló: %v", err)
	}
	if !cfg.UpdateRequired {
		t.Fatalf("esperaba update_required=true para versión 1.0.0: %+v", cfg)
	}
	if cfg.ApiBaseUrl == "" || cfg.RealtimeUrl == "" {
		t.Fatalf("URLs del gateway requeridas: %+v", cfg)
	}

	// Activar mantenimiento
	mState, err := srv.SetMaintenanceMode(ctx, &pb.SetMaintenanceModeRequest{
		Enabled: true,
		Message: "Servicio en mantenimiento por ventana de despliegue",
		Scope:   "global",
	})
	if err != nil || !mState.Enabled {
		t.Fatalf("SetMaintenanceMode: %v, %+v", err, mState)
	}

	gotM, err := srv.GetMaintenanceState(ctx, &pb.GetMaintenanceStateRequest{})
	if err != nil || !gotM.Enabled || gotM.Message != "Servicio en mantenimiento por ventana de despliegue" {
		t.Fatalf("GetMaintenanceState inconsistente: %v, %+v", err, gotM)
	}

	// ListServices
	svcs, err := srv.ListServices(ctx, &pb.ListServicesRequest{})
	if err != nil || len(svcs.Services) < 15 {
		t.Fatalf("ListServices: %v, len=%d", err, len(svcs.Services))
	}
}
