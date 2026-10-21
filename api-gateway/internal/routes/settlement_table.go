package routes

import (
	"google.golang.org/protobuf/proto"

	"plentypay/api-gateway/internal/pb"
)

// settlementRoutes son las rutas de liquidación a comercios (SPEC §4.3, settlement/SPEC.md §4).
// El negocio y la persona viajan en los metadatos; settlement vuelve a verificar permisos.
var settlementRoutes = []Route{
	{
		Method: "GET", Path: "/v1/settlement/summary", RPC: "/plentypay.settlement.v1.Settlement/GetPayoutSummary",
		Backend: BackendSettlement, RequireAuth: true, Permission: "settlement:read",
		NewRequest:  func() proto.Message { return &pb.GetPayoutSummaryRequest{} },
		NewResponse: func() proto.Message { return &pb.PayoutSummary{} },
	},
	{
		Method: "GET", Path: "/v1/settlement/schedule", RPC: "/plentypay.settlement.v1.Settlement/GetPayoutSchedule",
		Backend: BackendSettlement, RequireAuth: true, Permission: "settlement:read",
		NewRequest:  func() proto.Message { return &pb.GetPayoutScheduleRequest{} },
		NewResponse: func() proto.Message { return &pb.PayoutSchedule{} },
	},
	{
		// 🔒 settlement.destination.update cuando cambia el destino (settlement R5).
		Method: "PUT", Path: "/v1/settlement/schedule", RPC: "/plentypay.settlement.v1.Settlement/SetPayoutSchedule",
		Backend: BackendSettlement, RequireAuth: true, StepUp: true, Idempotency: true, Permission: "settlement:schedule:manage",
		NewRequest:  func() proto.Message { return &pb.SetPayoutScheduleRequest{} },
		NewResponse: func() proto.Message { return &pb.PayoutSchedule{} },
	},
	{
		Method: "GET", Path: "/v1/settlement/batches", RPC: "/plentypay.settlement.v1.Settlement/ListBatches",
		Backend: BackendSettlement, RequireAuth: true, Permission: "settlement:read",
		QueryParams: map[string]string{"status": "status", "page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListBatchesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListBatchesResponse{} },
	},
	{
		Method: "GET", Path: "/v1/settlement/batches/{batch_id}", RPC: "/plentypay.settlement.v1.Settlement/GetBatch",
		Backend: BackendSettlement, RequireAuth: true, Permission: "settlement:read",
		PathParams:  map[string]string{"batch_id": "batch_id"},
		NewRequest:  func() proto.Message { return &pb.GetBatchRequest{} },
		NewResponse: func() proto.Message { return &pb.SettlementBatch{} },
	},
	{
		// «Liquidar ahora» (S-FIN-05).
		Method: "POST", Path: "/v1/settlement/batches", RPC: "/plentypay.settlement.v1.Settlement/CreateBatch",
		Backend: BackendSettlement, RequireAuth: true, Idempotency: true, Permission: "settlement:schedule:manage",
		NewRequest:  func() proto.Message { return &pb.CreateBatchRequest{} },
		NewResponse: func() proto.Message { return &pb.SettlementBatch{} },
	},
	{
		// Consola de plataforma: lotes bancarios por confirmar de todos los negocios (Q-10).
		Method: "GET", Path: "/v1/platform/settlement/batches", RPC: "/plentypay.settlement.v1.Settlement/ListBatches",
		Backend: BackendSettlement, RequireAuth: true, Permission: "platform:reconcile",
		QueryParams: map[string]string{"status": "status", "page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListBatchesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListBatchesResponse{} },
	},
	{
		Method: "POST", Path: "/v1/platform/settlement/batches/{batch_id}/confirm", RPC: "/plentypay.settlement.v1.Settlement/ConfirmPayout",
		Backend: BackendSettlement, RequireAuth: true, Idempotency: true, Permission: "platform:reconcile",
		PathParams:  map[string]string{"batch_id": "batch_id"},
		NewRequest:  func() proto.Message { return &pb.ConfirmPayoutRequest{} },
		NewResponse: func() proto.Message { return &pb.SettlementBatch{} },
	},
	{
		Method: "POST", Path: "/v1/platform/settlement/batches/{batch_id}/fail", RPC: "/plentypay.settlement.v1.Settlement/FailPayout",
		Backend: BackendSettlement, RequireAuth: true, Idempotency: true, Permission: "platform:reconcile",
		PathParams:  map[string]string{"batch_id": "batch_id"},
		NewRequest:  func() proto.Message { return &pb.FailPayoutRequest{} },
		NewResponse: func() proto.Message { return &pb.SettlementBatch{} },
	},
}

func init() { Table = append(Table, settlementRoutes...) }
