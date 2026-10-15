package observability

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

const (
	tracerName  = "plentypay/web"
	serviceName = "web"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	if r.status == 0 {
		r.status = code
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	return r.ResponseWriter.Write(b)
}

// HTTPMiddleware es el borde del contenedor web: recupera pánicos, fija y devuelve `X-Request-Id`,
// continúa o inicia la traza, y emite un log de acceso por petición. Copia adaptada del
// `api-gateway` (AGENTS.md §4: no se comparte código entre contenedores).
func HTTPMiddleware(log *slog.Logger, reporter *Reporter, metrics *Metrics) func(http.Handler) http.Handler {
	tracer := otel.Tracer(tracerName)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			requestID := r.Header.Get("X-Request-Id")
			if _, err := uuid.Parse(requestID); err != nil {
				requestID = uuid.Must(uuid.NewV7()).String()
			}
			w.Header().Set("X-Request-Id", requestID)

			ctx := otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))
			ctx = WithRequestID(ctx, requestID)
			ctx, span := tracer.Start(ctx, r.Method, trace.WithSpanKind(trace.SpanKindServer))
			span.SetAttributes(attribute.String("pp.request_id", requestID), attribute.String("http.request.method", r.Method))
			defer span.End()

			rec := &statusRecorder{ResponseWriter: w}
			r = r.WithContext(ctx)
			defer func() {
				route := r.Pattern // lo fija el ServeMux; vacío si ninguna ruta coincidió
				if route == "" {
					route = "unmatched"
				}
				if recovered := recover(); recovered != nil {
					reporter.Panic(ctx, recovered, slog.String("route", route))
					if rec.status == 0 {
						WriteProblem(rec, http.StatusInternalServerError, "INTERNAL", "error interno")
					}
				}
				span.SetName(route)
				span.SetAttributes(attribute.String("http.route", route), attribute.Int("http.response.status_code", rec.status))
				metrics.Inc("pp_http_requests_total", "route", route, "status", strconv.Itoa(rec.status))
				log.LogAttrs(ctx, slog.LevelInfo, "http request handled",
					slog.String("route", route),
					slog.Int("http_status", rec.status),
					slog.Int64("duration_ms", time.Since(start).Milliseconds()))
			}()
			next.ServeHTTP(rec, r)
		})
	}
}

// WriteProblem escribe el cuerpo único de error: `error`, `reason` y el `request_id` de soporte.
func WriteProblem(w http.ResponseWriter, status int, reason, msg string) {
	body := `{"error":` + strconv.Quote(msg) + `,"reason":` + strconv.Quote(reason)
	if id := w.Header().Get("X-Request-Id"); id != "" {
		body += `,"request_id":` + strconv.Quote(id)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body + "}\n"))
}
