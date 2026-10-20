package server

import (
	"bytes"
	"context"
	"crypto/sha256"
	"log/slog"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"

	"plentypay/catalog/internal/observability"
	"plentypay/catalog/internal/store"
	"plentypay/catalog/internal/tenancy"
)

// Límites de la clave (grpc-conventions.md §3).
const (
	minIdempotencyKey = 16
	maxIdempotencyKey = 100
)

// NoReplayRPCs: ninguna respuesta de este servicio lleva secretos; todas se pueden repetir.
var NoReplayRPCs = map[string]bool{}

// IdempotencyInterceptor aplica grpc-conventions.md §3 a todo request con `idempotency_key`:
// misma clave + mismo contenido → la respuesta original sin ejecutar de nuevo; misma clave +
// otro contenido → ALREADY_EXISTS (IDEMPOTENCY_KEY_REUSED); clave en curso → ABORTED.
//
// La reserva y el cierre van en transacciones propias. Si el proceso cae entre la mutación y el cierre, la clave queda IN_PROGRESS y los
// reintentos reciben ABORTED hasta la purga: falla cerrado, nunca ejecuta dos veces.
func IdempotencyInterceptor(st store.IdempotencyStore, reporter *observability.Reporter) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		msg, ok := req.(proto.Message)
		if !ok || st == nil || NoReplayRPCs[info.FullMethod] {
			return handler(ctx, req)
		}
		key, hash, err := idempotencyKeyOf(msg)
		if err != nil {
			return nil, err
		}
		if key == "" {
			return handler(ctx, req)
		}
		tenantID := tenancy.TenantIDFromContext(ctx)
		if tenantID == "" {
			tenantID = store.NoTenantID
		}

		existing, err := st.Reserve(ctx, tenantID, info.FullMethod, key, hash)
		if err != nil {
			return nil, status.Error(codes.Internal, observability.Wrap(err, "reserve idempotency key").Error())
		}
		if existing != nil {
			return replay(existing, hash)
		}

		resp, herr := handler(ctx, req)
		if herr != nil {
			// La mutación no ocurrió (o se revirtió): el reintento debe poder ejecutarla.
			if err := st.Release(ctx, tenantID, info.FullMethod, key); err != nil {
				reporter.Defect(ctx, "idempotency release failed", observability.Wrap(err, "release idempotency key"), slog.String("rpc", info.FullMethod))
			}
			return nil, herr
		}
		if err := complete(ctx, st, tenantID, info.FullMethod, key, resp); err != nil {
			// La mutación ya ocurrió: se responde y la clave queda en curso (los reintentos: ABORTED).
			reporter.Defect(ctx, "idempotency completion failed", err, slog.String("rpc", info.FullMethod))
		}
		return resp, nil
	}
}

// idempotencyKeyOf lee `idempotency_key` y calcula el hash del request canónico sin la clave.
func idempotencyKeyOf(msg proto.Message) (string, []byte, error) {
	fd := msg.ProtoReflect().Descriptor().Fields().ByName("idempotency_key")
	if fd == nil {
		return "", nil, nil
	}
	key := msg.ProtoReflect().Get(fd).String()
	if key == "" {
		return "", nil, nil
	}
	if n := len(key); n < minIdempotencyKey || n > maxIdempotencyKey {
		return "", nil, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "la clave de idempotencia debe tener entre 16 y 100 caracteres")
	}
	canonical := proto.Clone(msg)
	canonical.ProtoReflect().Clear(fd)
	b, err := proto.MarshalOptions{Deterministic: true}.Marshal(canonical)
	if err != nil {
		return "", nil, status.Error(codes.Internal, observability.Wrap(err, "hash idempotent request").Error())
	}
	sum := sha256.Sum256(b)
	return key, sum[:], nil
}

func replay(rec *store.IdempotencyRecord, hash []byte) (any, error) {
	if !bytes.Equal(rec.RequestHash, hash) {
		return nil, ErrorInfo(codes.AlreadyExists, "IDEMPOTENCY_KEY_REUSED", "la clave de idempotencia ya se usó con otra operación")
	}
	if !rec.Done {
		return nil, status.Error(codes.Aborted, "la operación con esta clave sigue en curso; reintenta en unos segundos")
	}
	var a anypb.Any
	if err := proto.Unmarshal(rec.Response, &a); err != nil {
		return nil, status.Error(codes.Internal, observability.Wrap(err, "decode idempotent response").Error())
	}
	resp, err := a.UnmarshalNew()
	if err != nil {
		return nil, status.Error(codes.Internal, observability.Wrap(err, "decode idempotent response").Error())
	}
	return resp, nil
}

func complete(ctx context.Context, st store.IdempotencyStore, tenantID, rpc, key string, resp any) error {
	msg, ok := resp.(proto.Message)
	if !ok {
		return st.Release(ctx, tenantID, rpc, key)
	}
	a, err := anypb.New(msg)
	if err != nil {
		return observability.Wrap(err, "encode idempotent response")
	}
	b, err := proto.MarshalOptions{Deterministic: true}.Marshal(a)
	if err != nil {
		return observability.Wrap(err, "encode idempotent response")
	}
	if err := st.Complete(ctx, tenantID, rpc, key, b); err != nil {
		return observability.Wrap(err, "complete idempotency key")
	}
	return nil
}
