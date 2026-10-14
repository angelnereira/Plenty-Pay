// Package tenancy transporta el tenant y el actor por el contexto
// (ADR 0011/0014: nunca por el cuerpo de la peticion).
//
// Hoy identity todavia no recibe los metadatos x-pp-* del gateway (F09.2):
// el servidor pobla el contexto desde el token validado. El store lee estos
// valores para ejecutar SET LOCAL app.tenant_id / app.user_id / app.actor_role
// (go-standards.md seccion 3.6) y activar RLS como segunda barrera.
package tenancy

import "context"

type ctxKey int

const (
	keyTenantID ctxKey = iota
	keyUserID
	keyActorRole
)

// WithTenant devuelve un contexto que lleva el tenant del actor.
func WithTenant(ctx context.Context, tenantID string) context.Context {
	return context.WithValue(ctx, keyTenantID, tenantID)
}

// WithUser devuelve un contexto que lleva el usuario del actor.
func WithUser(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, keyUserID, userID)
}

// WithActorRole devuelve un contexto que lleva el rol base del actor
// (PLATFORM_ADMIN puede operar sobre cualquier tenant: RPC de plataforma).
func WithActorRole(ctx context.Context, role string) context.Context {
	return context.WithValue(ctx, keyActorRole, role)
}

// TenantIDFromContext lee el tenant; cadena vacia si no viene (fail-closed:
// el store no amplia permisos por defecto).
func TenantIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(keyTenantID).(string)
	return v
}

// UserIDFromContext lee el usuario; cadena vacia si no viene.
func UserIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(keyUserID).(string)
	return v
}

// ActorRoleFromContext lee el rol base del actor; cadena vacia si no viene.
func ActorRoleFromContext(ctx context.Context) string {
	v, _ := ctx.Value(keyActorRole).(string)
	return v
}
