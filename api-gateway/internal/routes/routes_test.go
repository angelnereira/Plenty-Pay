package routes_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"plentypay/api-gateway/internal/pb"
	"plentypay/api-gateway/internal/routes"
)

const testdataDir = "testdata"

// golden lee un archivo de testdata (con -update se reescribe).
func golden(t *testing.T, name string, actual []byte) {
	t.Helper()
	path := filepath.Join(testdataDir, name)
	if os.Getenv("UPDATE_GOLDEN") != "" {
		if err := os.MkdirAll(testdataDir, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, actual, 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("golden %s: %v (regenere con UPDATE_GOLDEN=1)", name, err)
	}
	if strings.TrimSpace(string(want)) != strings.TrimSpace(string(actual)) {
		t.Errorf("golden %s:\n  quería: %s\n  salió:  %s", name, want, actual)
	}
}

func jsonOneLine(b []byte) []byte {
	var v any
	if err := json.Unmarshal(b, &v); err != nil {
		return b
	}
	out, _ := json.Marshal(v)
	return out
}

// Una fila de la tabla se busca por método y path (con comodines).
func TestTableFind(t *testing.T) {
	casos := []struct {
		method, path string
		want         bool
	}{
		{"POST", "/v1/auth/login", true},
		{"GET", "/v1/auth/login", false},
		{"GET", "/v1/business/0199f0c8-1111-7000-8000-000000000001", true},
		{"GET", "/v1/business", false},
		{"DELETE", "/v1/business/staff/0199f0c8-1111-7000-8000-000000000002", true},
		{"GET", "/v1/business/roles/0199f0c8-1111-7000-8000-000000000003", true},
		{"GET", "/no/existe", false},
	}
	for _, c := range casos {
		if _, ok := routes.Find(c.method, c.path); ok != c.want {
			t.Errorf("Find(%s, %s) = %v, se esperaba %v", c.method, c.path, ok, c.want)
		}
	}
}

// Cada ruta de la tabla tiene RPC, path con barra y fábrica de mensaje.
func TestTableRoutesWellFormed(t *testing.T) {
	for _, r := range routes.Table {
		if r.Path == "" || !strings.HasPrefix(r.Path, "/v1/") {
			t.Errorf("ruta %s %s: path inválido", r.Method, r.Path)
		}
		// El RPC pertenece al servicio del contenedor destino de la ruta.
		prefix := map[string]string{
			routes.BackendIdentity: "/plentypay.identity.v1.Identity/",
			routes.BackendPayments: "/plentypay.payments.v1.Payments/",
			routes.BackendLedger:   "/plentypay.ledger.v1.Ledger/",
		}[r.Backend]
		if r.RPC == "" || prefix == "" || !strings.HasPrefix(r.RPC, prefix) {
			t.Errorf("ruta %s %s: RPC %q inválido para el destino %q", r.Method, r.Path, r.RPC, r.Backend)
		}
		if r.NewRequest == nil {
			t.Errorf("ruta %s %s: sin fábrica de request", r.Method, r.Path)
			continue
		}
		// El nombre del mensaje debe existir en el proto (comillas: compila).
		if r.NewRequest() == nil {
			t.Errorf("ruta %s %s: la fábrica devuelve nil", r.Method, r.Path)
		}
		// Métodos y paths no repetidos.
	}
	seen := map[string]bool{}
	for _, r := range routes.Table {
		k := r.Method + " " + r.Path
		if seen[k] {
			t.Errorf("ruta duplicada en la tabla: %s", k)
		}
		seen[k] = true
	}
}

// ── Golden: request JSON → proto ──────────────────────────────────────────────

// POST /v1/auth/login
func TestGoldenLoginRequest(t *testing.T) {
	r, ok := routes.Find("POST", "/v1/auth/login")
	if !ok {
		t.Fatal("ruta no encontrada")
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/login", strings.NewReader(
		`{"email":"ana@example.com","password":"una-clave-muy-larga"}`))
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatalf("DecodeRequest: %v", err)
	}
	login, ok := msg.(*pb.LoginRequest)
	if !ok {
		t.Fatalf("mensaje inesperado: %T", msg)
	}
	if login.GetEmail() != "ana@example.com" || login.GetPassword() != "una-clave-muy-larga" {
		t.Fatalf("campos: %+v", login)
	}
}

// POST /v1/auth/register (consents del registro público).
func TestGoldenRegisterRequest(t *testing.T) {
	r, _ := routes.Find("POST", "/v1/auth/register")
	body := `{"full_name":"Ana","email":"ana@example.com","password":"una-clave-muy-larga",
	  "consents":[{"purpose":"AGE_CONFIRMATION","text_version":"2026-10-14","granted":true},
	              {"purpose":"TERMS","text_version":"2026-10-14","granted":true}]}`
	msg, err := r.DecodeRequest(httptest.NewRequest(http.MethodPost, "/v1/auth/register", strings.NewReader(body)))
	if err != nil {
		t.Fatalf("DecodeRequest: %v", err)
	}
	reg, ok := msg.(*pb.RegisterRequest)
	if !ok {
		t.Fatalf("mensaje inesperado: %T", msg)
	}
	if len(reg.GetConsents()) != 2 {
		t.Fatalf("consents: %d", len(reg.GetConsents()))
	}
	if reg.GetConsents()[0].GetPurpose() != "AGE_CONFIRMATION" {
		t.Fatalf("primer consentimiento: %+v", reg.GetConsents()[0])
	}
	// El cuerpo no debe aceptar campos desconocidos (R3 del SPEC).
	if _, err := r.DecodeRequest(httptest.NewRequest(http.MethodPost, "/v1/auth/register",
		strings.NewReader(`{"email":"a@b.co","inventado":1}`))); err == nil {
		t.Error("un campo desconocido debería rechazarse")
	}
}

// GET /v1/business/{tenant_id} → parámetro de ruta al campo del proto.
func TestGoldenGetTenantPathParam(t *testing.T) {
	r, _ := routes.Find("GET", "/v1/business/0199f0c8-1111-7000-8000-000000000009")
	msg, err := r.DecodeRequest(httptest.NewRequest(http.MethodGet, "/v1/business/0199f0c8-1111-7000-8000-000000000009", nil))
	if err != nil {
		t.Fatalf("DecodeRequest: %v", err)
	}
	gt, ok := msg.(*pb.GetTenantRequest)
	if !ok {
		t.Fatalf("mensaje inesperado: %T", msg)
	}
	if gt.GetTenantId() != "0199f0c8-1111-7000-8000-000000000009" {
		t.Fatalf("tenant_id = %q", gt.GetTenantId())
	}
}

// GET /v1/business/staff/{tenant_id}?page_size=&page_token= → ruta + query.
func TestGoldenListUsersPathAndQuery(t *testing.T) {
	r, _ := routes.Find("GET", "/v1/business/staff/0199f0c8-1111-7000-8000-00000000000a")
	req := httptest.NewRequest(http.MethodGet, "/v1/business/staff/0199f0c8-1111-7000-8000-00000000000a?page_size=50&page_token=abc", nil)
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatalf("DecodeRequest: %v", err)
	}
	lu := msg.(*pb.ListUsersRequest)
	if lu.GetTenantId() != "0199f0c8-1111-7000-8000-00000000000a" {
		t.Fatalf("tenant_id = %q", lu.GetTenantId())
	}
	// page_size es int32 en el proto: el query debe convertir.
	if lu.GetPageSize() != 50 {
		t.Fatalf("page_size = %d (el query debe convertir a int32)", lu.GetPageSize())
	}
}

// ── Golden: proto → JSON ──────────────────────────────────────────────────────

func TestGoldenGetTenantResponse(t *testing.T) {
	msg := &pb.Tenant{
		TenantId:  "0199f0c8-1111-7000-8000-000000000001",
		LegalName: "Ana Sociedad S.A.", TradeName: "AnaStore",
		TaxId: "155612345-2-2023", Dv: "2",
		Status: pb.TenantStatus_TENANT_STATUS_ACTIVE, Country: "PA",
		ReviewNotes: "KYB ok",
	}
	body, err := routes.EncodeResponse(msg)
	if err != nil {
		t.Fatalf("EncodeResponse: %v", err)
	}
	golden(t, "get_tenant.response.json", jsonOneLine(body))
}

func TestGoldenListRolesResponse(t *testing.T) {
	msg := &pb.ListRolesResult{Roles: []*pb.Role{
		{RoleId: "r1", TenantId: "t1", Name: "cashier", System: true, Permissions: []string{"pos:sell"}},
		{RoleId: "r2", TenantId: "t1", Name: "Supervisor", Permissions: []string{"pos:sell", "payments:read"}},
	}}
	body, err := routes.EncodeResponse(msg)
	if err != nil {
		t.Fatalf("EncodeResponse: %v", err)
	}
	golden(t, "list_roles.response.json", jsonOneLine(body))
}

// ── Traducción de errores: toda la tabla de grpc-conventions.md §4 ───────────

// TestTranslateError cubre fila por fila la tabla §4 (F09.4).
func TestTranslateError(t *testing.T) {
	casos := []struct {
		code       codes.Code
		status     int
		wantReason string
	}{
		{codes.InvalidArgument, 400, "INVALID_ARGUMENT"},
		{codes.OutOfRange, 400, "INVALID_ARGUMENT"},
		{codes.Unauthenticated, 401, "UNAUTHENTICATED"},
		{codes.PermissionDenied, 403, "PERMISSION_DENIED"},
		{codes.NotFound, 404, "NOT_FOUND"},
		{codes.FailedPrecondition, 409, "FAILED_PRECONDITION"},
		{codes.AlreadyExists, 409, "ALREADY_EXISTS"},
		{codes.Aborted, 409, "ABORTED"},
		{codes.ResourceExhausted, 429, "RATE_LIMITED"},
		{codes.Unavailable, 503, "SERVICE_UNAVAILABLE"},
		{codes.DeadlineExceeded, 504, "DEADLINE_EXCEEDED"},
		{codes.Unimplemented, 501, "UNIMPLEMENTED"},
		{codes.Internal, 500, "INTERNAL"},
	}
	for _, c := range casos {
		rec := httptest.NewRecorder()
		routes.TranslateError(rec, status.Error(c.code, "detalle interno"))
		if rec.Code != c.status {
			t.Errorf("%v → HTTP %d, la tabla §4 dice %d", c.code, rec.Code, c.status)
		}
		if got := reasonFrom(rec.Body.String()); got != c.wantReason {
			t.Errorf("%v → reason %q, se esperaba %q", c.code, got, c.wantReason)
		}
	}
}

// El reason estable del ErrorInfo manda sobre el canonico del codigo.
func TestTranslateErrorUsesErrorInfoReason(t *testing.T) {
	st := status.New(codes.NotFound, "no encontrado")
	st, _ = st.WithDetails(&errdetails.ErrorInfo{
		Reason: "TENANT_NOT_FOUND", Domain: "plentypay",
	})
	rec := httptest.NewRecorder()
	routes.TranslateError(rec, st.Err())
	if rec.Code != 404 {
		t.Fatalf("HTTP %d, se esperaba 404", rec.Code)
	}
	if got := reasonFrom(rec.Body.String()); got != "TENANT_NOT_FOUND" {
		t.Fatalf("reason = %q, se esperaba el del ErrorInfo (TENANT_NOT_FOUND)", got)
	}
}

// Un reason de negocio viaja tal cual (FAILED_PRECONDITION con reason estable).
func TestTranslateErrorBusinessReason(t *testing.T) {
	st := status.New(codes.FailedPrecondition, "la transicion no es valida")
	st, _ = st.WithDetails(&errdetails.ErrorInfo{Reason: "INVALID_STATE_TRANSITION", Domain: "plentypay"})
	rec := httptest.NewRecorder()
	routes.TranslateError(rec, st.Err())
	if rec.Code != 409 {
		t.Fatalf("HTTP %d, se esperaba 409", rec.Code)
	}
	if got := reasonFrom(rec.Body.String()); got != "INVALID_STATE_TRANSITION" {
		t.Fatalf("reason = %q", got)
	}
}

// INTERNAL nunca filtra el mensaje interno al cliente.
func TestTranslateErrorInternalHidesDetail(t *testing.T) {
	rec := httptest.NewRecorder()
	routes.TranslateError(rec, status.Error(codes.Internal, "sql: relacion usuarios rota en 127.0.0.1:5432"))
	body := rec.Body.String()
	if strings.Contains(body, "sql:") || strings.Contains(body, "5432") {
		t.Fatalf("el detalle interno se filtro al cliente: %s", body)
	}
	if got := reasonFrom(body); got != "INTERNAL" {
		t.Fatalf("reason = %q", got)
	}
}

// Los casos reintentables llevan Retry-After (tabla §4).
func TestTranslateErrorRetryAfter(t *testing.T) {
	for _, code := range []codes.Code{codes.Aborted, codes.ResourceExhausted} {
		rec := httptest.NewRecorder()
		routes.TranslateError(rec, status.Error(code, "reintente"))
		if got := rec.Header().Get("Retry-After"); got == "" {
			t.Errorf("%v deberia llevar Retry-After", code)
		}
	}
}

func reasonFrom(body string) string {
	var v struct {
		Reason string `json:"reason"`
	}
	_ = json.Unmarshal([]byte(body), &v)
	return v.Reason
}

// IdempotencyKey lee la cabecera estándar (grpc-conventions.md §3).
func TestIdempotencyKeyHeader(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/v1/business", nil)
	r.Header.Set("Idempotency-Key", "0199f0c8-1111-7000-8000-0000000000ff")
	if got := routes.IdempotencyKey(r); got != "0199f0c8-1111-7000-8000-0000000000ff" {
		t.Fatalf("IdempotencyKey = %q", got)
	}
}

// El campo de idempotencia del proto se rellena desde la cabecera.
func TestGoldenIdempotencyField(t *testing.T) {
	r, _ := routes.Find("POST", "/v1/business")
	req := httptest.NewRequest(http.MethodPost, "/v1/business", strings.NewReader(
		`{"owner_email":"ana@example.com","legal_name":"Ana S.A.","tax_id":"155612345-2-2023"}`))
	req.Header.Set("Idempotency-Key", "0199f0c8-1111-7000-8000-0000000000ff")
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatalf("DecodeRequest: %v", err)
	}
	cb := msg.(*pb.CreateBusinessRequest)
	if cb.GetIdempotencyKey() != "0199f0c8-1111-7000-8000-0000000000ff" {
		t.Fatalf("idempotency_key = %q: la tabla de rutas debe copiar la cabecera", cb.GetIdempotencyKey())
	}
}

// El path param se extrae también con el helper suelto.
func TestPathValues(t *testing.T) {
	got := routes.PathValues("/v1/business/staff/{user_id}", "/v1/business/staff/abc")
	if got["user_id"] != "abc" {
		t.Fatalf("PathValues = %v", got)
	}
	if len(routes.PathValues("/a/b", "/x/y/z")) != 0 {
		t.Error("paths de distinta longitud no deberían coincidir")
	}
	var _ proto.Message = &pb.LoginRequest{}
}
