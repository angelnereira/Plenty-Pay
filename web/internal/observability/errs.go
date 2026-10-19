package observability

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"runtime"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// tracedError envuelve un error con la operación que se intentaba y, en el punto donde nace,
// con la pila de llamadas (observability-standards.md §10.2 y §11.3).
type tracedError struct {
	op  string
	err error
	pcs []uintptr
}

func (e *tracedError) Error() string { return e.op + ": " + e.err.Error() }
func (e *tracedError) Unwrap() error { return e.err }

// Wrap agrega contexto a un error al subir de capa. La pila se captura una sola vez, la primera
// vez que el error se envuelve; los envoltorios posteriores solo agregan la operación.
func Wrap(err error, op string) error {
	if err == nil {
		return nil
	}
	wrapped := &tracedError{op: op, err: err}
	var prev *tracedError
	if !errors.As(err, &prev) {
		pcs := make([]uintptr, 48)
		wrapped.pcs = pcs[:runtime.Callers(2, pcs)]
	}
	return wrapped
}

func stackOf(err error) []uintptr {
	var pcs []uintptr
	for e := err; e != nil; e = errors.Unwrap(e) {
		if te, ok := e.(*tracedError); ok && te.pcs != nil {
			pcs = te.pcs
		}
	}
	return pcs
}

func rootCause(err error) error {
	// Un `Dependency` puede reportarse sin un error concreto (por ejemplo, una
	// respuesta inválida de un proveedor). Sin esta guarda, la cadena de causas entra
	// en pánico y el registro del fallo se pierde: exactamente lo que no debe pasar.
	if err == nil {
		return nil
	}
	for {
		next := errors.Unwrap(err)
		if next == nil {
			return err
		}
		err = next
	}
}

// ErrorType es el valor de `error.type`: el tipo de la causa raíz. Baja cardinalidad, nunca el mensaje.
func ErrorType(err error) string {
	cause := rootCause(err)
	if cause == nil {
		return "unspecified"
	}
	return fmt.Sprintf("%T", cause)
}

func formatStack(pcs []uintptr) (text string, own []runtime.Frame) {
	if len(pcs) == 0 {
		return "", nil
	}
	var b strings.Builder
	frames := runtime.CallersFrames(pcs)
	for {
		f, more := frames.Next()
		fmt.Fprintf(&b, "%s\n\t%s:%d\n", f.Function, f.File, f.Line)
		if strings.HasPrefix(f.Function, "plentypay/") && !isInstrumentation(f.Function) {
			own = append(own, f)
		}
		if !more {
			break
		}
	}
	return b.String(), own
}

// isInstrumentation excluye los marcos de este paquete que solo registran o envuelven: la primera
// función "propia" de una pila debe ser código del servicio, no su instrumentación.
func isInstrumentation(fn string) bool {
	for _, s := range []string{"observability.Wrap", "observability.(*Reporter)", "observability.UnaryServerInterceptor", "observability.UnaryClientInterceptor", "observability.HTTPMiddleware"} {
		if strings.Contains(fn, s) {
			return true
		}
	}
	return false
}

func fingerprint(service, errType string, own []runtime.Frame) string {
	h := sha256.New()
	h.Write([]byte(service + "|" + errType))
	for i, f := range own {
		if i == 3 {
			break
		}
		h.Write([]byte("|" + f.Function))
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// errorAttrs arma los campos que responden qué, dónde, cómo y por qué falló (§9).
func errorAttrs(service string, err error, stack string, own []runtime.Frame) []slog.Attr {
	errType := ErrorType(err)
	// Sin error concreto, el mensaje dice que no lo hay en vez de inventar uno.
	message := errType
	if err != nil {
		message = err.Error()
	}
	cause := rootCause(err)
	causeText := message
	if cause != nil {
		causeText = cause.Error()
	}
	attrs := []slog.Attr{
		slog.String("err", message),
		slog.String("error.type", errType),
		slog.String("exception.type", errType),
		slog.String("exception.message", message),
		slog.String("pp.error.cause", causeText),
		slog.String("pp.error.fingerprint", fingerprint(service, errType, own)),
	}
	if stack != "" {
		attrs = append(attrs, slog.String("exception.stacktrace", stack))
	}
	if len(own) > 0 {
		attrs = append(attrs,
			slog.String("code.function.name", own[0].Function),
			slog.String("code.file.path", own[0].File),
			slog.Int("code.line.number", own[0].Line))
	}
	return attrs
}

func markSpanFailed(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}
	// `Dependency` puede llamarse sin un error concreto (por ejemplo, una respuesta
	// inválida de una dependencia): sin esta guarda, `err.Error()` entra en pánico y
	// el registro del fallo se pierde, que es justo lo contrario de lo que se pide.
	if err == nil {
		span.SetStatus(codes.Error, "unspecified")
		return
	}
	span.SetStatus(codes.Error, err.Error())
	span.SetAttributes(attribute.String("error.type", ErrorType(err)))
}

// Reporter registra fallos una sola vez, en el borde del servicio (§10.3).
type Reporter struct {
	log     *slog.Logger
	service string
	metrics *Metrics
}

func NewReporter(log *slog.Logger, service string, metrics *Metrics) *Reporter {
	return &Reporter{log: log, service: service, metrics: metrics}
}

// Metrics devuelve el registro de métricas del contenedor (lo usan los interceptores de cliente).
func (r *Reporter) Metrics() *Metrics { return r.metrics }

// Defect registra un bug o una invariante rota: nivel error, con pila, y marca el span como fallido.
func (r *Reporter) Defect(ctx context.Context, msg string, err error, extra ...slog.Attr) {
	if r == nil {
		return
	}
	stack, own := formatStack(stackOf(err))
	markSpanFailed(ctx, err)
	r.log.LogAttrs(ctx, slog.LevelError, msg, append(errorAttrs(r.service, err, stack, own), extra...)...)
}

// Dependency registra el fallo de una dependencia (reintentable): nivel warn, sin pila.
func (r *Reporter) Dependency(ctx context.Context, msg, peer string, err error, extra ...slog.Attr) {
	if r == nil {
		return
	}
	markSpanFailed(ctx, err)
	attrs := append(errorAttrs(r.service, err, "", nil), slog.String("peer.service", peer))
	r.log.LogAttrs(ctx, slog.LevelWarn, msg, append(attrs, extra...)...)
}

// Panic registra un pánico recuperado en el borde, con la pila del punto donde ocurrió.
func (r *Reporter) Panic(ctx context.Context, recovered any, extra ...slog.Attr) {
	if r == nil {
		return
	}
	pcs := make([]uintptr, 48)
	pcs = pcs[:runtime.Callers(3, pcs)]
	err := fmt.Errorf("panic: %v", recovered)
	stack, own := formatStack(pcs)
	markSpanFailed(ctx, err)
	r.metrics.Inc("pp_panics_total")
	r.log.LogAttrs(ctx, slog.LevelError, "panic recovered", append(errorAttrs(r.service, err, stack, own), extra...)...)
}
