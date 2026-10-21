package routes_test

import (
	"strings"
	"testing"

	"plentypay/api-gateway/internal/routes"
)

// settlement/SPEC.md §4: cada ruta llega a su RPC con el permiso del SPEC del gateway (§4.3).
func TestSettlementRoutes(t *testing.T) {
	want := map[string][2]string{
		"GET /v1/settlement/summary":                      {"GetPayoutSummary", "settlement:read"},
		"GET /v1/settlement/schedule":                     {"GetPayoutSchedule", "settlement:read"},
		"PUT /v1/settlement/schedule":                     {"SetPayoutSchedule", "settlement:schedule:manage"},
		"GET /v1/settlement/batches":                      {"ListBatches", "settlement:read"},
		"GET /v1/settlement/batches/b1":                   {"GetBatch", "settlement:read"},
		"POST /v1/settlement/batches":                     {"CreateBatch", "settlement:schedule:manage"},
		"GET /v1/platform/settlement/batches":             {"ListBatches", "platform:reconcile"},
		"POST /v1/platform/settlement/batches/b1/confirm": {"ConfirmPayout", "platform:reconcile"},
		"POST /v1/platform/settlement/batches/b1/fail":    {"FailPayout", "platform:reconcile"},
	}
	for key, w := range want {
		method, path, _ := strings.Cut(key, " ")
		r, ok := routes.Find(method, path)
		if !ok {
			t.Fatalf("%s no existe", key)
		}
		if r.Backend != routes.BackendSettlement || r.RPC != "/plentypay.settlement.v1.Settlement/"+w[0] || r.Permission != w[1] {
			t.Fatalf("%s: %+v", key, r)
		}
	}
	if r, _ := routes.Find("PUT", "/v1/settlement/schedule"); !r.StepUp || !r.Idempotency {
		t.Fatal("cambiar el destino exige step-up e idempotencia (R5)")
	}
}
