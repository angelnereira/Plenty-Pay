package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

const (
	testTraceID   = "4bf92f3577b34da6a3ce929d0e0e4736"
	testRequestID = "0192f0c1-7b2a-7c3d-8e4f-5a6b7c8d9e0f"
)

type harness struct {
	out      *bytes.Buffer
	metrics  *Metrics
	reporter *Reporter
	handler  http.Handler
}

func newHarness(t *testing.T, mux *http.ServeMux) *harness {
	t.Helper()
	if _, err := SetupTracing(context.Background(), "api-gateway", "test", &bytes.Buffer{}); err != nil {
		t.Fatal(err)
	}
	out := &bytes.Buffer{}
	logger := NewLogger(out, "api-gateway", "test", slog.LevelDebug)
	metrics := NewMetrics("api-gateway", "test", "none")
	reporter := NewReporter(logger, "api-gateway", metrics)
	return &harness{out: out, metrics: metrics, reporter: reporter, handler: HTTPMiddleware(logger, reporter, metrics)(mux)}
}

func (h *harness) do(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.handler.ServeHTTP(rec, req)
	return rec
}

func (h *harness) records(t *testing.T, level string) []map[string]any {
	t.Helper()
	var recs []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(h.out.String()), "\n") {
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("registro que no es JSON de una línea: %q", line)
		}
		if rec["level"] == level {
			recs = append(recs, rec)
		}
	}
	return recs
}

func explode() { var m map[string]int; m["x"] = 1 }

// observability-standards.md §15.2: un pánico devuelve 500 genérico con request_id, deja un
// registro `error` con pila, incrementa pp_panics_total y el proceso sigue vivo.
func TestObs_PanicIsRecoveredLoggedAndCounted(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/boom", func(http.ResponseWriter, *http.Request) { explode() })
	mux.HandleFunc("GET /v1/ok", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	h := newHarness(t, mux)

	req := httptest.NewRequest(http.MethodGet, "/v1/boom", nil)
	req.Header.Set("X-Request-Id", testRequestID)
	res := h.do(req)

	var body map[string]string
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("cuerpo de error inválido: %q", res.Body.String())
	}
	if res.Code != http.StatusInternalServerError || body["reason"] != "INTERNAL" || body["request_id"] != testRequestID {
		t.Fatalf("esperaba 500 INTERNAL con request_id, obtuve %d %v", res.Code, body)
	}
	if strings.Contains(res.Body.String(), "nil map") {
		t.Error("el detalle del pánico salió al cliente")
	}
	errs := h.records(t, "error")
	if len(errs) != 1 {
		t.Fatalf("esperaba exactamente un registro de error, hay %d", len(errs))
	}
	rec := errs[0]
	if stack, _ := rec["exception.stacktrace"].(string); !strings.Contains(stack, "observability.explode") {
		t.Errorf("la pila no señala dónde ocurrió el pánico:\n%s", stack)
	}
	for _, field := range []string{"error.type", "exception.message", "pp.error.fingerprint", "code.function.name", "code.line.number", "route", "trace_id", "span_id"} {
		if _, ok := rec[field]; !ok {
			t.Errorf("falta el campo %q en el registro de error", field)
		}
	}
	if rec["request_id"] != testRequestID || rec["route"] != "GET /v1/boom" {
		t.Errorf("correlación incorrecta: %v", rec)
	}
	if got := h.metrics.Value("pp_panics_total"); got != 1 {
		t.Errorf("pp_panics_total = %v, esperaba 1", got)
	}
	if res := h.do(httptest.NewRequest(http.MethodGet, "/v1/ok", nil)); res.Code != http.StatusNoContent {
		t.Fatalf("la petición posterior al pánico falló: %d", res.Code)
	}
}

// api-gateway/SPEC.md §3.2: X-Request-Id válido se respeta; inválido o ausente se genera UUIDv7; siempre se devuelve.
func TestObs_RequestIDIsRespectedOrGenerated(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/ok", func(http.ResponseWriter, *http.Request) {})
	h := newHarness(t, mux)
	v7 := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

	req := httptest.NewRequest(http.MethodGet, "/v1/ok", nil)
	req.Header.Set("X-Request-Id", testRequestID)
	if got := h.do(req).Header().Get("X-Request-Id"); got != testRequestID {
		t.Errorf("un request id válido debe respetarse, obtuve %q", got)
	}
	for _, bad := range []string{"", "no-es-uuid", "<script>"} {
		req := httptest.NewRequest(http.MethodGet, "/v1/ok", nil)
		req.Header.Set("X-Request-Id", bad)
		if got := h.do(req).Header().Get("X-Request-Id"); !v7.MatchString(got) {
			t.Errorf("con X-Request-Id %q esperaba un UUIDv7 nuevo, obtuve %q", bad, got)
		}
	}
}

// §1.5: un log de acceso por petición, con ruta (patrón, no la URL), estado y duración.
func TestObs_AccessLogAndRouteMetric(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/items/{id}", func(w http.ResponseWriter, _ *http.Request) {
		WriteProblem(w, http.StatusNotFound, "NOT_FOUND", "no existe")
	})
	h := newHarness(t, mux)
	req := httptest.NewRequest(http.MethodGet, "/v1/items/123?token=secreto", nil)
	req.Header.Set("traceparent", "00-"+testTraceID+"-00f067aa0ba902b7-01")
	h.do(req)

	access := h.records(t, "info")
	if len(access) != 1 {
		t.Fatalf("esperaba un log de acceso, hay %d", len(access))
	}
	rec := access[0]
	if rec["route"] != "GET /v1/items/{id}" || rec["http_status"] != float64(404) || rec["trace_id"] != testTraceID {
		t.Errorf("log de acceso incorrecto: %v", rec)
	}
	if _, ok := rec["duration_ms"]; !ok {
		t.Error("falta duration_ms")
	}
	if strings.Contains(h.out.String(), "secreto") || strings.Contains(h.out.String(), "/v1/items/123") {
		t.Error("el log contiene la URL o la cadena de consulta; solo debe llevar el patrón de ruta")
	}
	if got := h.metrics.Value("pp_http_requests_total", "route", "GET /v1/items/{id}", "status", "404"); got != 1 {
		t.Errorf("pp_http_requests_total = %v, esperaba 1", got)
	}
	if len(h.records(t, "error")) != 0 {
		t.Error("un 404 esperable no debe generar un registro de error")
	}
}

// §12.6: la llamada gRPC saliente continúa la traza y lleva el contexto de petición.
func TestObs_ClientInterceptorPropagatesContext(t *testing.T) {
	var sent metadata.MD
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/call", func(_ http.ResponseWriter, r *http.Request) {
		_ = UnaryClientInterceptor(NewMetrics("api-gateway", "test", "none"))(r.Context(), "/plentypay.identity.v1.Identity/ValidateToken", nil, nil, nil,
			func(ctx context.Context, _ string, _, _ any, _ *grpc.ClientConn, _ ...grpc.CallOption) error {
				sent, _ = metadata.FromOutgoingContext(ctx)
				return nil
			})
	})
	h := newHarness(t, mux)
	req := httptest.NewRequest(http.MethodGet, "/v1/call", nil)
	req.Header.Set("traceparent", "00-"+testTraceID+"-00f067aa0ba902b7-01")
	req.Header.Set("X-Request-Id", testRequestID)
	h.do(req)

	traceparent := mdCarrier(sent).Get("traceparent")
	if !regexp.MustCompile(`^00-` + testTraceID + `-[0-9a-f]{16}-01$`).MatchString(traceparent) {
		t.Errorf("traceparent saliente incorrecto: %q", traceparent)
	}
	if strings.Contains(traceparent, "00f067aa0ba902b7") {
		t.Error("el span padre saliente debe ser el del gateway, no el del cliente original")
	}
	if got := mdCarrier(sent).Get("x-pp-request-id"); got != testRequestID {
		t.Errorf("x-pp-request-id saliente = %q", got)
	}
	if got := mdCarrier(sent).Get("x-pp-actor-service"); got != "api-gateway" {
		t.Errorf("x-pp-actor-service saliente = %q", got)
	}
}

// §10.1: el fallo de una dependencia es `warn`, nombra la dependencia y conserva la causa.
func TestObs_DependencyFailureRecord(t *testing.T) {
	h := newHarness(t, http.NewServeMux())
	err := Wrap(errors.New("connection refused"), "identity.ValidateToken")
	h.reporter.Dependency(WithRequestID(context.Background(), testRequestID), "identity call failed", "identity", err)

	warns := h.records(t, "warn")
	if len(warns) != 1 {
		t.Fatalf("esperaba un registro warn, hay %d", len(warns))
	}
	rec := warns[0]
	if rec["peer.service"] != "identity" || rec["pp.error.cause"] != "connection refused" || rec["request_id"] != testRequestID {
		t.Errorf("registro de dependencia incorrecto: %v", rec)
	}
	if rec["err"] != "identity.ValidateToken: connection refused" {
		t.Errorf("el error debe llevar la operación que se intentaba: %v", rec["err"])
	}
	if _, ok := rec["exception.stacktrace"]; ok {
		t.Error("un fallo de dependencia no lleva pila")
	}
}

// §15.4: ningún registro contiene secretos ni credenciales.
func TestObs_NoSecretsInRecords(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/auth/login", func(http.ResponseWriter, *http.Request) { explode() })
	h := newHarness(t, mux)
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/login", strings.NewReader(`{"email":"ana@test.co","password":"contraseña-larga-123"}`))
	req.Header.Set("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.e30.abc")
	h.do(req)

	forbidden := []*regexp.Regexp{
		regexp.MustCompile(`eyJ[A-Za-z0-9_-]{5,}\.`),
		regexp.MustCompile(`(?i)bearer\s+\S+`),
		regexp.MustCompile(`contraseña-larga`),
		regexp.MustCompile(`ana@test\.co`),
		regexp.MustCompile(`\b\d{13,19}\b`),
	}
	for _, re := range forbidden {
		if m := re.FindString(h.out.String()); m != "" {
			t.Errorf("los registros contienen un dato prohibido: %q", m)
		}
	}
}
