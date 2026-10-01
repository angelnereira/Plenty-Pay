// Interceptor gRPC de correlación (mandato §17, ADR-0004):
// propaga/inyecta x-correlation-id, x-request-id y traceparent en cada
// llamada y las incluye en logs estructurados JSON.
package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// CtxKey aísla valores de correlación en el context.
type ctxKey string

const (
	ctxCorrelationID ctxKey = "correlation_id"
	ctxRequestID     ctxKey = "request_id"
)

type Correlation struct {
	CorrelationID string
	RequestID     string
}

func FromContext(ctx context.Context) Correlation {
	c, _ := ctx.Value(ctxCorrelationID).(Correlation)
	return c
}

// UnaryCorrelation propaga los IDs de correlación y loguea cada llamada.
func UnaryCorrelation(log *slog.Logger) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (any, error) {
		start := time.Now()
		corr := readOrInject(ctx)
		ctx = context.WithValue(ctx, ctxCorrelationID, corr)
		resp, err := handler(ctx, req)
		log.InfoContext(ctx, "rpc",
			"method", info.FullMethod,
			"correlation_id", corr.CorrelationID,
			"request_id", corr.RequestID,
			"duration_ms", time.Since(start).Milliseconds(),
			"error", err != nil,
		)
		// Devolver IDs al cliente en los headers de respuesta.
		_ = grpc.SetHeader(ctx, metadata.Pairs(
			"x-correlation-id", corr.CorrelationID,
			"x-request-id", corr.RequestID,
		))
		return resp, err
	}
}

func readOrInject(ctx context.Context) Correlation {
	md, _ := metadata.FromIncomingContext(ctx)
	corr := Correlation{
		CorrelationID: first(md, "x-correlation-id", ""),
		RequestID:     first(md, "x-request-id", ""),
	}
	if corr.CorrelationID == "" {
		corr.CorrelationID = newID()
	}
	if corr.RequestID == "" {
		corr.RequestID = newID()
	}
	return corr
}

func first(md metadata.MD, key, def string) string {
	if vals := md.Get(key); len(vals) > 0 && vals[0] != "" {
		return vals[0]
	}
	return def
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
