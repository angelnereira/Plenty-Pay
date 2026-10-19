package observability

import (
	"context"
	"log/slog"
	"testing"
)

func newTestReporter() *Reporter {
	return NewReporter(slog.Default(), "web", nil)
}

// Regresión: `Dependency` se llama sin error concreto cuando la dependencia devuelve
// algo inválido. Antes, `err.Error()` entraba en pánico y el registro del fallo se
// perdía justo en el punto donde más se necesita (§2.14).
func TestDependencyWithoutErrorDoesNotPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("Dependency panicked without an error: %v", r)
		}
	}()
	newTestReporter().Dependency(context.Background(), "invalid_fingerprint", "", nil)
}

func TestDefectWithoutErrorDoesNotPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("Defect panicked without an error: %v", r)
		}
	}()
	newTestReporter().Defect(context.Background(), "algo_fallo", nil)
}

// El mensaje de un fallo sin error concreto dice que no hay, no inventa uno.
func TestErrorTypeWithoutError(t *testing.T) {
	if got := ErrorType(nil); got != "unspecified" {
		t.Fatalf("expected 'unspecified', got %q", got)
	}
}

func TestRootCauseWithoutError(t *testing.T) {
	if got := rootCause(nil); got != nil {
		t.Fatalf("expected nil, got %v", got)
	}
}

// Con contexto sin span, marcar el fallo no entra en pánico.
func TestMarkSpanFailedWithoutSpan(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("markSpanFailed panicked without a span: %v", r)
		}
	}()
	markSpanFailed(context.Background(), nil)
}

// Un `Reporter` nulo es un no-op: registrar un fallo nunca debe romper al llamador.
func TestNilReporterIsNoOp(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("nil Reporter panicked: %v", r)
		}
	}()
	var r *Reporter
	r.Dependency(context.Background(), "m", "", nil)
	r.Defect(context.Background(), "m", nil)
}
