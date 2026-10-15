package observability

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"

	"go.opentelemetry.io/otel/trace"
)

type ctxKey int

const (
	requestIDKey ctxKey = iota
	userIDKey
	tenantIDKey
)

// WithRequestID guarda en el contexto el id de la petición de usuario (`x-pp-request-id`).
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey, id)
}

func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey).(string)
	return id
}

// WithActor guarda a quién afecta la petición, para que cada registro lo lleve.
func WithActor(ctx context.Context, userID, tenantID string) context.Context {
	return context.WithValue(context.WithValue(ctx, userIDKey, userID), tenantIDKey, tenantID)
}

// contextHandler agrega a cada registro los campos de correlación que viven en el contexto
// (observability-standards.md §1): request_id, trace_id, span_id, user_id y tenant_id.
type contextHandler struct{ slog.Handler }

func (h contextHandler) Handle(ctx context.Context, r slog.Record) error {
	if id := RequestID(ctx); id != "" {
		r.AddAttrs(slog.String("request_id", id))
	}
	if sc := trace.SpanContextFromContext(ctx); sc.IsValid() {
		r.AddAttrs(slog.String("trace_id", sc.TraceID().String()), slog.String("span_id", sc.SpanID().String()))
	}
	if v, _ := ctx.Value(userIDKey).(string); v != "" {
		r.AddAttrs(slog.String("user_id", v))
	}
	if v, _ := ctx.Value(tenantIDKey).(string); v != "" {
		r.AddAttrs(slog.String("tenant_id", v))
	}
	return h.Handler.Handle(ctx, r)
}

func (h contextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return contextHandler{h.Handler.WithAttrs(attrs)}
}

func (h contextHandler) WithGroup(name string) slog.Handler {
	return contextHandler{h.Handler.WithGroup(name)}
}

// NewLogger devuelve el logger JSON de una línea del servicio. `ts` en RFC 3339 UTC con milisegundos,
// `level` en minúsculas, y `service` y `version` en todos los registros.
func NewLogger(w io.Writer, service, version string, level slog.Leveler) *slog.Logger {
	json := slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level: level,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if len(groups) > 0 {
				return a
			}
			switch a.Key {
			case slog.TimeKey:
				return slog.String("ts", a.Value.Time().UTC().Format("2006-01-02T15:04:05.000Z"))
			case slog.LevelKey:
				return slog.String("level", strings.ToLower(a.Value.String()))
			}
			return a
		},
	})
	return slog.New(contextHandler{json}).With("service", service, "version", version)
}

// EnvOr lee una variable de entorno con valor por omisión (go-standards.md §3.9).
func EnvOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ParseLevel traduce LOG_LEVEL; un valor desconocido cae en info.
func ParseLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	}
	return slog.LevelInfo
}
