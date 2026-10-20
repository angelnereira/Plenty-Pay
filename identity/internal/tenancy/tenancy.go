// Package tenancy transporta el tenant y el actor por el contexto
// (ADR 0011/0014: nunca por el cuerpo de la peticion).
package tenancy

import (
	"context"

	"google.golang.org/grpc/metadata"
)

type ctxKey int

const (
	keyTenantID ctxKey = iota
	keyUserID
	keyActorRole
	keyIP
	keySessionID
	keyStepUpToken
)

func firstMD(ctx context.Context, key string) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	if vals := md.Get(key); len(vals) > 0 {
		return vals[0]
	}
	return ""
}

// WithIP devuelve un contexto que lleva la IP del llamador.
func WithIP(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, keyIP, ip)
}

// IPFromContext lee la IP del llamador; cadena vacia si no viene.
func IPFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(keyIP).(string); ok && v != "" {
		return v
	}
	return firstMD(ctx, "x-forwarded-for")
}

// WithTenant devuelve un contexto que lleva el tenant del actor.
func WithTenant(ctx context.Context, tenantID string) context.Context {
	return context.WithValue(ctx, keyTenantID, tenantID)
}

// WithUser devuelve un contexto que lleva el usuario del actor.
func WithUser(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, keyUserID, userID)
}

// WithActorRole devuelve un contexto que lleva el rol base del actor.
func WithActorRole(ctx context.Context, role string) context.Context {
	return context.WithValue(ctx, keyActorRole, role)
}

// WithStepUpToken devuelve un contexto que lleva el token de confirmación fuerte.
func WithStepUpToken(ctx context.Context, token string) context.Context {
	return context.WithValue(ctx, keyStepUpToken, token)
}

// TenantIDFromContext lee el tenant del contexto o del metadato gRPC x-pp-tenant-id.
func TenantIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(keyTenantID).(string); ok && v != "" {
		return v
	}
	return firstMD(ctx, "x-pp-tenant-id")
}

// UserIDFromContext lee el usuario del contexto o del metadato gRPC x-pp-user-id.
func UserIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(keyUserID).(string); ok && v != "" {
		return v
	}
	return firstMD(ctx, "x-pp-user-id")
}

// ActorRoleFromContext lee el rol base del actor del contexto o del metadato gRPC x-pp-role.
func ActorRoleFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(keyActorRole).(string); ok && v != "" {
		return v
	}
	return firstMD(ctx, "x-pp-role")
}

// StepUpTokenFromContext lee el token de confirmación fuerte del contexto o de x-pp-step-up.
func StepUpTokenFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(keyStepUpToken).(string); ok && v != "" {
		return v
	}
	return firstMD(ctx, "x-pp-step-up")
}

// WithSession devuelve un contexto que lleva la sesion del llamador.
func WithSession(ctx context.Context, sessionID string) context.Context {
	return context.WithValue(ctx, keySessionID, sessionID)
}

// SessionIDFromContext lee la sesion del llamador; cadena vacia si no viene.
func SessionIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(keySessionID).(string); ok && v != "" {
		return v
	}
	return firstMD(ctx, "x-pp-session-id")
}
