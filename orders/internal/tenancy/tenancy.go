// Package tenancy lee quién llama desde los metadatos gRPC que fija el gateway (ADR 0011/0014):
// tenant, usuario, permisos y capacidades nunca vienen del cuerpo.
package tenancy

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"google.golang.org/grpc/metadata"
)

// Actor es la identidad validada del llamador.
type Actor struct {
	TenantID     string
	UserID       string
	Permissions  map[string]bool
	Capabilities map[string]bool
	RequestID    string
	// Service es el contenedor que llama (`x-pp-actor-service`). El gateway siempre fija
	// "api-gateway" y descarta las cabeceras x-pp-* del cliente, así que "pos" u "orders" solo
	// llegan desde la red interna de servicios.
	Service string
}

func first(md metadata.MD, key string) string {
	if v := md.Get(key); len(v) > 0 {
		return strings.TrimSpace(v[0])
	}
	return ""
}

func set(csv string) map[string]bool {
	out := map[string]bool{}
	for _, p := range strings.Split(csv, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out[p] = true
		}
	}
	return out
}

// FromContext devuelve el actor; TenantID y UserID quedan vacíos si no son UUID válidos.
func FromContext(ctx context.Context) Actor {
	md, _ := metadata.FromIncomingContext(ctx)
	a := Actor{
		TenantID:     first(md, "x-pp-tenant-id"),
		UserID:       first(md, "x-pp-user-id"),
		Permissions:  set(first(md, "x-pp-permissions")),
		Capabilities: set(first(md, "x-pp-capabilities")),
		RequestID:    first(md, "x-pp-request-id"),
		Service:      first(md, "x-pp-actor-service"),
	}
	if _, err := uuid.Parse(a.TenantID); err != nil {
		a.TenantID = ""
	}
	if _, err := uuid.Parse(a.UserID); err != nil {
		a.UserID = ""
	}
	return a
}

// TenantIDFromContext es el tenant del actor (vacío si no hay).
func TenantIDFromContext(ctx context.Context) string { return FromContext(ctx).TenantID }

// StepUp devuelve el token de confirmación fuerte (`x-pp-step-up`, cabecera X-Step-Up-Token del
// gateway) para reenviarlo a payments-core (R5).
func StepUp(ctx context.Context) string {
	md, _ := metadata.FromIncomingContext(ctx)
	return first(md, "x-pp-step-up")
}
