package observability

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const tracerName = "plentypay/catalog"

// mdCarrier adapta los metadatos gRPC al propagador de trazas.
type mdCarrier metadata.MD

func (c mdCarrier) Get(key string) string {
	if v := metadata.MD(c).Get(key); len(v) > 0 {
		return v[0]
	}
	return ""
}
func (c mdCarrier) Set(key, value string) { metadata.MD(c).Set(key, value) }
func (c mdCarrier) Keys() []string {
	keys := make([]string, 0, len(c))
	for k := range c {
		keys = append(keys, k)
	}
	return keys
}

// isDefect indica si un código gRPC corresponde a un bug del servidor y no a un error esperable.
func isDefect(code codes.Code) bool {
	return code == codes.Internal || code == codes.Unknown || code == codes.DataLoss
}

// UnaryServerInterceptor es el borde del servicio: continúa la traza del llamador, fija el
// request_id, recupera pánicos, y emite un log de acceso y a lo sumo un registro de error por RPC
// (observability-standards.md §1.5, §10.3 y §10.5).
func UnaryServerInterceptor(log *slog.Logger, reporter *Reporter, metrics *Metrics) grpc.UnaryServerInterceptor {
	tracer := otel.Tracer(tracerName)
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
		start := time.Now()
		md, _ := metadata.FromIncomingContext(ctx)
		ctx = otel.GetTextMapPropagator().Extract(ctx, mdCarrier(md))

		requestID := mdCarrier(md).Get("x-pp-request-id")
		if _, perr := uuid.Parse(requestID); perr != nil {
			requestID = uuid.Must(uuid.NewV7()).String()
		}
		ctx = WithRequestID(ctx, requestID)
		ctx = WithActor(ctx, mdCarrier(md).Get("x-pp-user-id"), mdCarrier(md).Get("x-pp-tenant-id"))

		ctx, span := tracer.Start(ctx, info.FullMethod, trace.WithSpanKind(trace.SpanKindServer))
		span.SetAttributes(attribute.String("pp.request_id", requestID), attribute.String("rpc.system", "grpc"))
		defer span.End()

		defer func() {
			rpc := slog.String("rpc", info.FullMethod)
			if recovered := recover(); recovered != nil {
				reporter.Panic(ctx, recovered, rpc)
				resp, err = nil, status.Error(codes.Internal, "internal error")
			} else if err != nil && isDefect(status.Code(err)) {
				reporter.Defect(ctx, "rpc failed", err, rpc)
				err = status.Error(codes.Internal, "internal error") // el detalle nunca sale al cliente
			}
			code := status.Code(err)
			span.SetAttributes(attribute.String("rpc.grpc.status_code", code.String()))
			metrics.Inc("pp_rpc_server_requests_total", "rpc", info.FullMethod, "code", code.String())
			metrics.Observe("pp_rpc_server_duration_seconds", time.Since(start).Seconds(), "rpc", info.FullMethod)
			log.LogAttrs(ctx, slog.LevelInfo, "rpc handled", rpc,
				slog.Int64("duration_ms", time.Since(start).Milliseconds()),
				slog.String("grpc_code", code.String()))
		}()
		return handler(ctx, req)
	}
}
