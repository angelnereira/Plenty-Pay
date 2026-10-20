// Package metadata aplica la regla R5 del gateway (SPEC §5): el tenant y el
// actor de los metadatos salen SIEMPRE del token validado, y las cabeceras
// `x-pp-*` que envíe el cliente se descartan antes de que cualquier handler las
// lea (no pueden usarze para autorizar).
//
// Convención de nombres: grpc-conventions.md §2.
package metadata

import (
	"context"
	"net/http"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// Cabeceras/metadatos de contexto (grpc-conventions.md §2).
const (
	HeaderRequestID     = "x-pp-request-id"
	HeaderUserID        = "x-pp-user-id"
	HeaderTenantID      = "x-pp-tenant-id"
	HeaderRole          = "x-pp-role"
	HeaderPermissions   = "x-pp-permissions"
	HeaderBranchScope   = "x-pp-branch-scope"
	HeaderCapabilities  = "x-pp-capabilities"
	HeaderActorService  = "x-pp-actor-service"
	HeaderStepUp        = "x-pp-step-up"
	HeaderTraceParent   = "traceparent"
	ActorServiceGateway = "api-gateway"

	// maxPermissionsMetadata: por encima de 4 KB se omite (el servicio consulta
	// a identity), para no reventar el límite de metadatos gRPC.
	maxPermissionsMetadata = 4096
)

// Caller es la identidad validada que viaja en los metadatos gRPC. Nunca se
// construye desde datos del cliente: solo desde el token validado por identity.
type Caller struct {
	RequestID    string
	UserID       string
	TenantID     string
	Role         string
	Permissions  []string
	BranchScope  string   // "*" o ids de sucursal; vacío con tenant = ninguna sucursal (R24)
	Capabilities []string // capacidades encendidas del negocio (R21)
	ActorService string
	StepUp       string
}

// Empty indica si no hay caller (ruta pública).
func (c Caller) Empty() bool {
	return c.UserID == "" && c.TenantID == "" && c.ActorService == ""
}

type ctxKey int

const keyCaller ctxKey = iota

// NewContext adjunta el caller al contexto.
func NewContext(ctx context.Context, c Caller) context.Context {
	return context.WithValue(ctx, keyCaller, c)
}

// FromContext lee el caller (Caller cero si no viene).
func FromContext(ctx context.Context) Caller {
	c, _ := ctx.Value(keyCaller).(Caller)
	return c
}

// WithRequestID fija el request id en el caller del contexto.
func WithRequestID(ctx context.Context, id string) context.Context {
	c := FromContext(ctx)
	c.RequestID = id
	return NewContext(ctx, c)
}

// RequestIDFromContext lee el request id del caller.
func RequestIDFromContext(ctx context.Context) string {
	return FromContext(ctx).RequestID
}

// StripInbound descarga las cabeceras `x-pp-*` entrantes del cliente. El
// gateway no las lee para autorizar ni las reenvía: si un cliente manda
// `x-pp-tenant-id: otro`, se ignora por completo.
func StripInbound(r *http.Request) {
	if r == nil {
		return
	}
	for name := range r.Header {
		if strings.HasPrefix(strings.ToLower(name), "x-pp-") {
			r.Header.Del(name)
		}
	}
}

// StripInboundMiddleware envuelve un handler descartando las `x-pp-*` del
// cliente antes de que corra nada (defensa en el borde).
func StripInboundMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		StripInbound(r)
		next.ServeHTTP(w, r)
	})
}

// OutgoingInterceptor inyecta los metadatos del contexto en cada llamada gRPC
// saliente (ADR 0011). Solo pone lo que el gateway validó; nunca lo que el
// cliente pidió.
func OutgoingInterceptor(actorService string) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		c := FromContext(ctx)
		md := metadata.MD{}
		if c.ActorService != "" {
			md.Set(HeaderActorService, c.ActorService)
		} else {
			// Llamada sin usuario (login, registro, reset): el origen sigue siendo
			// el gateway, para que el servicio pueda auditarlo.
			md.Set(HeaderActorService, actorService)
		}
		if c.RequestID != "" {
			md.Set(HeaderRequestID, c.RequestID)
		}
		if c.UserID != "" {
			md.Set(HeaderUserID, c.UserID)
		}
		if c.TenantID != "" {
			md.Set(HeaderTenantID, c.TenantID)
		}
		if c.Role != "" {
			md.Set(HeaderRole, c.Role)
		}
		if c.StepUp != "" {
			md.Set(HeaderStepUp, c.StepUp)
		}
		if perms := strings.Join(c.Permissions, ","); perms != "" && len(perms) <= maxPermissionsMetadata {
			md.Set(HeaderPermissions, perms)
		}
		// Alcance y capacidades (ADR 0018). Un alcance vacío no se envía: el servicio lo lee como
		// "ninguna sucursal" cuando hay tenant, nunca como "todas".
		if c.BranchScope != "" && len(c.BranchScope) <= maxPermissionsMetadata {
			md.Set(HeaderBranchScope, c.BranchScope)
		}
		if caps := strings.Join(c.Capabilities, ","); caps != "" && len(caps) <= maxPermissionsMetadata {
			md.Set(HeaderCapabilities, caps)
		}
		if tp := mdFromIncoming(ctx)[HeaderTraceParent]; len(tp) > 0 {
			md.Set(HeaderTraceParent, tp[0])
		}
		ctx = metadata.NewOutgoingContext(ctx, md)
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}

// mdFromIncoming lee los metadatos entrantes (trazas) sin depender de haber
// iniciado una llamada gRPC.
func mdFromIncoming(ctx context.Context) metadata.MD {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return metadata.MD{}
	}
	return md
}
