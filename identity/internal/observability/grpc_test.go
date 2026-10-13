package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"regexp"
	"strings"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const (
	testTraceID   = "4bf92f3577b34da6a3ce929d0e0e4736"
	testRequestID = "0192f0c1-7b2a-7c3d-8e4f-5a6b7c8d9e0f"
)

type harness struct {
	out     *bytes.Buffer
	metrics *Metrics
	call    func(ctx context.Context, h grpc.UnaryHandler) (any, error)
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	if _, err := SetupTracing(context.Background(), "identity", "test", &bytes.Buffer{}); err != nil {
		t.Fatal(err)
	}
	out := &bytes.Buffer{}
	logger := NewLogger(out, "identity", "test", slog.LevelDebug)
	metrics := NewMetrics("identity", "test", "none")
	interceptor := UnaryServerInterceptor(logger, NewReporter(logger, "identity", metrics), metrics)
	info := &grpc.UnaryServerInfo{FullMethod: "/plentypay.identity.v1.Identity/Login"}
	return &harness{out: out, metrics: metrics, call: func(ctx context.Context, h grpc.UnaryHandler) (any, error) {
		return interceptor(ctx, nil, info, h)
	}}
}

func (h *harness) records(t *testing.T) []map[string]any {
	t.Helper()
	var recs []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(h.out.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("registro que no es JSON de una línea: %q", line)
		}
		recs = append(recs, rec)
	}
	return recs
}

func byLevel(recs []map[string]any, level string) []map[string]any {
	var out []map[string]any
	for _, r := range recs {
		if r["level"] == level {
			out = append(out, r)
		}
	}
	return out
}

func incoming() context.Context {
	return metadata.NewIncomingContext(context.Background(), metadata.Pairs(
		"traceparent", "00-"+testTraceID+"-00f067aa0ba902b7-01",
		"x-pp-request-id", testRequestID,
		"x-pp-user-id", "user-1"))
}

func explode() { var m map[string]int; m["x"] = 1 }

// observability-standards.md §15.2: un pánico devuelve INTERNAL sin detalle, deja un registro
// `error` con pila, incrementa pp_panics_total y el proceso sigue vivo.
func TestObs_PanicIsRecoveredLoggedAndCounted(t *testing.T) {
	h := newHarness(t)
	_, err := h.call(incoming(), func(context.Context, any) (any, error) { explode(); return nil, nil })

	if status.Code(err) != codes.Internal || status.Convert(err).Message() != "internal error" {
		t.Fatalf("esperaba INTERNAL genérico, obtuve %v", err)
	}
	errs := byLevel(h.records(t), "error")
	if len(errs) != 1 {
		t.Fatalf("esperaba exactamente un registro de error, hay %d", len(errs))
	}
	rec := errs[0]
	stack, _ := rec["exception.stacktrace"].(string)
	if !strings.Contains(stack, "observability.explode") {
		t.Errorf("la pila no señala dónde ocurrió el pánico:\n%s", stack)
	}
	for _, field := range []string{"error.type", "exception.message", "pp.error.fingerprint", "code.function.name", "code.file.path", "code.line.number", "rpc", "ts", "service", "version"} {
		if _, ok := rec[field]; !ok {
			t.Errorf("falta el campo %q en el registro de error", field)
		}
	}
	if rec["request_id"] != testRequestID || rec["trace_id"] != testTraceID || rec["user_id"] != "user-1" {
		t.Errorf("faltan datos de correlación: %v", rec)
	}
	if got := h.metrics.Value("pp_panics_total"); got != 1 {
		t.Errorf("pp_panics_total = %v, esperaba 1", got)
	}
	// el proceso sigue vivo: la siguiente llamada funciona
	if _, err := h.call(incoming(), func(context.Context, any) (any, error) { return "ok", nil }); err != nil {
		t.Fatalf("la llamada posterior al pánico falló: %v", err)
	}
}

// §10.1: un defecto (INTERNAL) se registra con su causa y nunca filtra el detalle al cliente.
func TestObs_DefectIsLoggedWithCauseAndHiddenFromClient(t *testing.T) {
	h := newHarness(t)
	cause := errors.New("connection refused")
	_, err := h.call(incoming(), func(context.Context, any) (any, error) {
		return nil, status.Error(codes.Internal, Wrap(Wrap(cause, "query users"), "create user").Error())
	})
	if msg := status.Convert(err).Message(); msg != "internal error" {
		t.Fatalf("el detalle interno salió al cliente: %q", msg)
	}
	errs := byLevel(h.records(t), "error")
	if len(errs) != 1 || !strings.Contains(errs[0]["err"].(string), "connection refused") {
		t.Fatalf("esperaba un registro de error con la causa, obtuve %v", errs)
	}
}

// §10.1: un error de dominio es esperable: no es `error` ni lleva pila; queda en el log de acceso.
func TestObs_DomainErrorIsNotAnErrorRecord(t *testing.T) {
	h := newHarness(t)
	_, err := h.call(incoming(), func(context.Context, any) (any, error) {
		return nil, status.Error(codes.FailedPrecondition, "INSUFFICIENT_FUNDS")
	})
	if status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("el código de dominio no debe alterarse: %v", err)
	}
	recs := h.records(t)
	if n := len(byLevel(recs, "error")); n != 0 {
		t.Fatalf("un error de dominio generó %d registros de error", n)
	}
	access := byLevel(recs, "info")
	if len(access) != 1 || access[0]["grpc_code"] != "FailedPrecondition" || access[0]["msg"] != "rpc handled" {
		t.Fatalf("falta el log de acceso con el código: %v", access)
	}
	if _, ok := access[0]["duration_ms"]; !ok {
		t.Error("el log de acceso no lleva duration_ms")
	}
}

// §12.6 y §15.3: se continúa la traza del llamador; sin request_id válido se genera uno.
func TestObs_TraceAndRequestIDPropagation(t *testing.T) {
	h := newHarness(t)
	var inHandler string
	if _, err := h.call(incoming(), func(ctx context.Context, _ any) (any, error) {
		inHandler = RequestID(ctx)
		return nil, nil
	}); err != nil {
		t.Fatal(err)
	}
	rec := h.records(t)[0]
	if inHandler != testRequestID || rec["trace_id"] != testTraceID {
		t.Fatalf("no se propagó el contexto: request_id=%q trace_id=%v", inHandler, rec["trace_id"])
	}
	if span, _ := rec["span_id"].(string); len(span) != 16 || span == "00f067aa0ba902b7" {
		t.Errorf("el servidor debe abrir su propio span, obtuve %q", span)
	}

	h.out.Reset()
	if _, err := h.call(context.Background(), func(context.Context, any) (any, error) { return nil, nil }); err != nil {
		t.Fatal(err)
	}
	rec = h.records(t)[0]
	id, _ := rec["request_id"].(string)
	if !regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).MatchString(id) {
		t.Errorf("sin request_id entrante debe generarse un UUIDv7, obtuve %q", id)
	}
	if trace, _ := rec["trace_id"].(string); len(trace) != 32 {
		t.Errorf("sin traceparent debe iniciarse una traza nueva, obtuve %q", trace)
	}
}

// §1.2: formato de los campos obligatorios.
func TestObs_LogRecordFormat(t *testing.T) {
	out := &bytes.Buffer{}
	NewLogger(out, "identity", "1.2.3", slog.LevelInfo).Info("service started", "port", "50060")
	var rec map[string]any
	if err := json.Unmarshal(out.Bytes(), &rec); err != nil {
		t.Fatal(err)
	}
	if ts, _ := rec["ts"].(string); !regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`).MatchString(ts) {
		t.Errorf("ts debe ser RFC 3339 UTC con milisegundos, obtuve %q", ts)
	}
	if rec["level"] != "info" || rec["service"] != "identity" || rec["version"] != "1.2.3" || rec["msg"] != "service started" {
		t.Errorf("campos obligatorios incorrectos: %v", rec)
	}
	if strings.Count(out.String(), "\n") != 1 {
		t.Error("cada registro debe ocupar exactamente una línea")
	}
}

// §15.4: ningún registro contiene secretos ni credenciales.
func TestObs_NoSecretsInRecords(t *testing.T) {
	h := newHarness(t)
	ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.e30.abc"))
	_, _ = h.call(ctx, func(context.Context, any) (any, error) { explode(); return nil, nil })
	_, _ = h.call(ctx, func(context.Context, any) (any, error) {
		return nil, status.Error(codes.Unauthenticated, "token inválido")
	})

	forbidden := []*regexp.Regexp{
		regexp.MustCompile(`eyJ[A-Za-z0-9_-]{5,}\.`),             // JWT
		regexp.MustCompile(`(?i)bearer\s+\S+`),                   // cabecera de autorización
		regexp.MustCompile(`(?i)"(password|contraseña|secret)"`), // campos de credenciales
		regexp.MustCompile(`\b\d{13,19}\b`),                      // número de tarjeta
	}
	for _, re := range forbidden {
		if m := re.FindString(h.out.String()); m != "" {
			t.Errorf("los registros contienen un dato prohibido: %q", m)
		}
	}
}

func TestObs_MetricsExposition(t *testing.T) {
	m := NewMetrics("identity", "1.2.3", "abc123")
	m.Inc("pp_rpc_server_requests_total", "rpc", "/x/Y", "code", "OK")
	m.Observe("pp_rpc_server_duration_seconds", 0.02, "rpc", "/x/Y")
	m.Set("pp_outbox_pending", 0)
	out := &bytes.Buffer{}
	m.WritePrometheus(out)
	for _, want := range []string{
		`pp_build_info{service="identity",version="1.2.3",commit="abc123"} 1`,
		`pp_panics_total{service="identity"} 0`,
		`pp_rpc_server_requests_total{service="identity",rpc="/x/Y",code="OK"} 1`,
		`pp_rpc_server_duration_seconds_bucket{service="identity",rpc="/x/Y",le="0.025"} 1`,
		`pp_rpc_server_duration_seconds_sum{service="identity",rpc="/x/Y"} 0.02`,
		`pp_rpc_server_duration_seconds_count{service="identity",rpc="/x/Y"} 1`,
		`pp_outbox_pending{service="identity"} 0`,
	} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("falta la serie %s en:\n%s", want, out.String())
		}
	}
}
