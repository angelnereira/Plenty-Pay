package routes_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"plentypay/api-gateway/internal/metadata"
	"plentypay/api-gateway/internal/pb"
	"plentypay/api-gateway/internal/routes"
)

// Los segmentos literales del modelo de acceso ganan al comodín /v1/business/{tenant_id}.
func TestR24_AccessRoutesResolveBeforeTenantWildcard(t *testing.T) {
	cases := map[string]string{
		"GET /v1/business/profile":                       "GetBusinessProfile",
		"GET /v1/business/branches":                      "ListBranches",
		"GET /v1/business/staff":                         "ListUsers",
		"GET /v1/business/invitations":                   "ListInvitations",
		"GET /v1/business/roles":                         "ListRoles",
		"PUT /v1/business/staff/u1/membership":           "UpdateMembership",
		"POST /v1/business/branches/b1/deactivate":       "DeactivateBranch",
		"POST /v1/business/invitations/i1/resend":        "ResendInvitation",
		"DELETE /v1/business/roles/r1":                   "ArchiveRole",
		"GET /v1/business/0199f0c8-1111-7000-8000-00001": "GetTenant",
		"POST /v1/invitations/preview":                   "PreviewInvitation",
	}
	for req, rpc := range cases {
		method, path, _ := strings.Cut(req, " ")
		r, ok := routes.Find(method, path)
		if !ok || !strings.HasSuffix(r.RPC, "/"+rpc) {
			t.Errorf("%s → %v %s, se esperaba %s", req, ok, r.RPC, rpc)
		}
	}
}

// SPEC §3.8: sin el permiso de la ruta, el gateway responde 403 sin llamar al servicio.
func TestR23_RoutePermissionCheckedAtGateway(t *testing.T) {
	r, ok := routes.Find("POST", "/v1/business/branches")
	if !ok || r.Permission != "admin:business:manage" {
		t.Fatalf("la ruta declara su permiso: %+v", r)
	}
	h := routes.Handler(nil, r) // sin conexión: si llegara a invocar, entraría en pánico
	req := httptest.NewRequest(http.MethodPost, "/v1/business/branches", strings.NewReader(`{"branch":{"code":"0001","name":"Colón"}}`))
	req = req.WithContext(metadata.NewContext(context.Background(), metadata.Caller{UserID: "u", TenantID: "t", Permissions: []string{"pos:sell"}}))
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "PERMISSION_DENIED") {
		t.Fatalf("respuesta %d %s", rec.Code, rec.Body.String())
	}
}

// Los parámetros booleanos del query se traducen al proto (include_inactive).
func TestR24_ListBranchesIncludeInactiveQuery(t *testing.T) {
	r, _ := routes.Find("GET", "/v1/business/branches")
	req := httptest.NewRequest(http.MethodGet, "/v1/business/branches?include_inactive=true", nil)
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatalf("DecodeRequest: %v", err)
	}
	if !msg.(*pb.ListBranchesRequest).GetIncludeInactive() {
		t.Fatal("include_inactive=true no llegó al proto")
	}
	if _, err := r.DecodeRequest(httptest.NewRequest(http.MethodGet, "/v1/business/branches?include_inactive=quizas", nil)); err == nil {
		t.Fatal("un booleano inválido debe rechazarse")
	}
}

// Los int32 del query (page_size) se fijan con su tipo (antes se fijaban como int64).
func TestF09_3_Int32QueryParam(t *testing.T) {
	r, _ := routes.Find("GET", "/v1/business/invitations")
	msg, err := r.DecodeRequest(httptest.NewRequest(http.MethodGet, "/v1/business/invitations?page_size=25", nil))
	if err != nil || msg.(*pb.ListInvitationsRequest).GetPageSize() != 25 {
		t.Fatalf("page_size: %v %+v", err, msg)
	}
}

// Regresión 2026-10-20: con path y cuerpo, protojson reiniciaba el mensaje y borraba el id del path
// (aprobar negocio y cambiar membresía respondían INTERNAL por uuid vacío). El path manda.
func TestF09_3_PathParamSurvivesBodyAndWins(t *testing.T) {
	r, _ := routes.Find("PUT", "/v1/business/staff/u-ruta/membership")
	req := httptest.NewRequest(http.MethodPut, "/v1/business/staff/u-ruta/membership", strings.NewReader(`{"user_id":"u-cuerpo","role_id":"r1","scope":"TENANT"}`))
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatalf("DecodeRequest: %v", err)
	}
	m := msg.(*pb.UpdateMembershipRequest)
	if m.GetUserId() != "u-ruta" || m.GetRoleId() != "r1" {
		t.Fatalf("mensaje = %+v", m)
	}
	rv, _ := routes.Find("POST", "/v1/platform/tenants/t-1/review")
	msg, err = rv.DecodeRequest(httptest.NewRequest(http.MethodPost, "/v1/platform/tenants/t-1/review", strings.NewReader(`{"approve":true}`)))
	if err != nil || msg.(*pb.ReviewBusinessRequest).GetTenantId() != "t-1" || !msg.(*pb.ReviewBusinessRequest).GetApprove() {
		t.Fatalf("review: %v %+v", err, msg)
	}
}

// ADR 0020: el estado del PIN es de lectura con sesión; crearlo o cambiarlo se marca 🔒 (identity
// consume el token de identity.pin.set) y exige Idempotency-Key.
func TestR28_StepUpPinRoutes(t *testing.T) {
	get, ok := routes.Find("GET", "/v1/me/step-up-pin")
	if !ok || !strings.HasSuffix(get.RPC, "/GetStepUpPinStatus") || !get.RequireAuth || get.StepUp {
		t.Fatalf("GET /v1/me/step-up-pin: %+v", get)
	}
	put, ok := routes.Find("PUT", "/v1/me/step-up-pin")
	if !ok || !strings.HasSuffix(put.RPC, "/SetStepUpPin") || !put.RequireAuth || !put.StepUp || !put.Idempotency {
		t.Fatalf("PUT /v1/me/step-up-pin: %+v", put)
	}
	msg, err := put.DecodeRequest(httptest.NewRequest(http.MethodPut, "/v1/me/step-up-pin", strings.NewReader(`{"pin":"482915"}`)))
	if err != nil || msg.(*pb.SetStepUpPinRequest).GetPin() != "482915" {
		t.Fatalf("el cuerpo llega al proto: %v %v", err, msg)
	}
}
