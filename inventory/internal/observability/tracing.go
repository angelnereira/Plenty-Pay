package observability

import (
	"context"
	"io"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// SetupTracing instala el proveedor de trazas y la propagación W3C `traceparent` (§12).
// Destino de los spans:
//   - OTEL_EXPORTER_OTLP_ENDPOINT definido → OTLP gRPC al colector (asíncrono, con buffer acotado).
//   - OTEL_TRACES_EXPORTER=console → una línea JSON por span en `consoleOut` (desarrollo).
//   - nada → no se exporta, pero cada petición tiene trace_id y span_id para correlacionar los logs.
func SetupTracing(ctx context.Context, service, version string, consoleOut io.Writer) (shutdown func(context.Context) error, err error) {
	env := os.Getenv("DEPLOY_ENV")
	if env == "" {
		env = "dev"
	}
	res := resource.NewSchemaless(
		attribute.String("service.name", service),
		attribute.String("service.version", version),
		attribute.String("deployment.environment.name", env),
	)
	opts := []sdktrace.TracerProviderOption{sdktrace.WithResource(res), sdktrace.WithSampler(sdktrace.AlwaysSample())}
	switch {
	case os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") != "":
		exp, err := otlptracegrpc.New(ctx)
		if err != nil {
			return nil, Wrap(err, "create otlp trace exporter")
		}
		opts = append(opts, sdktrace.WithBatcher(exp))
	case os.Getenv("OTEL_TRACES_EXPORTER") == "console":
		exp, err := stdouttrace.New(stdouttrace.WithWriter(consoleOut))
		if err != nil {
			return nil, Wrap(err, "create console trace exporter")
		}
		opts = append(opts, sdktrace.WithBatcher(exp))
	}
	tp := sdktrace.NewTracerProvider(opts...)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	return tp.Shutdown, nil
}
