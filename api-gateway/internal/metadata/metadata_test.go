package metadata_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"google.golang.org/grpc"
	grpcmeta "google.golang.org/grpc/metadata"

	gwmeta "plentypay/api-gateway/internal/metadata"
)

// R5: las cabeceras x-pp-* que envía el cliente se descartan.
func TestR5_StripInboundDiscardsClientHeaders(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/v1/negocios", nil)
	r.Header.Set("x-pp-tenant-id", "tenant-espurio")
	r.Header.Set("X-PP-User-Id", "usuario-espurio")
	r.Header.Set("x-pp-permissions", "platform:flags:manage")
	r.Header.Set("Authorization", "Bearer token-que-no-se-toca")

	gwmeta.StripInbound(r)

	if got := r.Header.Get("x-pp-tenant-id"); got != "" {
		t.Errorf("x-pp-tenant-id deberia descartarse, llego %q", got)
	}
	if got := r.Header.Get("X-PP-User-Id"); got != "" {
		t.Errorf("X-PP-User-Id deberia descartarse, llego %q", got)
	}
	if got := r.Header.Get("x-pp-permissions"); got != "" {
		t.Errorf("x-pp-permissions deberia descartarse, llego %q", got)
	}
	// El resto de cabeceras se conservan.
	if got := r.Header.Get("Authorization"); got == "" {
		t.Error("Authorization no deberia tocarse")
	}
}

// El middleware descarta antes de que corra el handler.
func TestR5_StripInboundMiddlewareRunsFirst(t *testing.T) {
	var seen string
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.Header.Get("x-pp-tenant-id")
		w.WriteHeader(http.StatusOK)
	})
	h := gwmeta.StripInboundMiddleware(next)

	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req.Header.Set("x-pp-tenant-id", "espurio")
	h.ServeHTTP(httptest.NewRecorder(), req)

	if seen != "" {
		t.Errorf("el handler vio x-pp-tenant-id=%q: no deberia llegar nada", seen)
	}
}

// outgoing captura los metadatos de una llamada saliente.
func outgoing(ctx context.Context, actorService string) grpcmeta.MD {
	capturado := grpcmeta.MD{}
	interceptor := gwmeta.OutgoingInterceptor(actorService)
	invoker := func(ctx context.Context, _ string, _, _ any, _ *grpc.ClientConn, _ ...grpc.CallOption) error {
		md, ok := grpcmeta.FromOutgoingContext(ctx)
		if ok {
			capturado = md.Copy()
		}
		return nil
	}
	if err := interceptor(ctx, "/identity/GetTenant", nil, nil, nil, invoker); err != nil {
		panic(err)
	}
	return capturado
}

// R5: los metadatos salen del token validado (el caller del contexto).
func TestR5_OutgoingMetadataFromValidatedCaller(t *testing.T) {
	ctx := gwmeta.NewContext(context.Background(), gwmeta.Caller{
		RequestID:    "req-1",
		UserID:       "user-1",
		TenantID:     "tenant-1",
		Role:         "BUSINESS_OWNER",
		Permissions:  []string{"pos:sell", "payments:charge"},
		ActorService: "api-gateway",
	})

	md := outgoing(ctx, gwmeta.ActorServiceGateway)

	if got := md.Get(gwmeta.HeaderUserID); len(got) != 1 || got[0] != "user-1" {
		t.Errorf("x-pp-user-id = %v", got)
	}
	if got := md.Get(gwmeta.HeaderTenantID); len(got) != 1 || got[0] != "tenant-1" {
		t.Errorf("x-pp-tenant-id = %v", got)
	}
	if got := md.Get(gwmeta.HeaderRole); len(got) != 1 || got[0] != "BUSINESS_OWNER" {
		t.Errorf("x-pp-role = %v", got)
	}
	if got := md.Get(gwmeta.HeaderPermissions); len(got) != 1 || got[0] != "pos:sell,payments:charge" {
		t.Errorf("x-pp-permissions = %v", got)
	}
	if got := md.Get(gwmeta.HeaderRequestID); len(got) != 1 || got[0] != "req-1" {
		t.Errorf("x-pp-request-id = %v", got)
	}
	if got := md.Get(gwmeta.HeaderActorService); len(got) != 1 || got[0] != "api-gateway" {
		t.Errorf("x-pp-actor-service = %v", got)
	}
}

// R5: una cabecera x-pp-* espuria del cliente NUNCA llega a los metadatos
// salientes (salen del contexto, no de la petición HTTP).
func TestR5_SpoofedHeaderNeverReachesOutgoingMetadata(t *testing.T) {
	// La petición trae cabeceras espurias y ya fueron descartadas.
	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req.Header.Set("x-pp-tenant-id", "tenant-espurio")
	gwmeta.StripInbound(req)

	// El contexto solo lleva lo validado (otro tenant).
	ctx := gwmeta.NewContext(req.Context(), gwmeta.Caller{
		UserID: "user-real", TenantID: "tenant-real",
	})

	md := outgoing(ctx, gwmeta.ActorServiceGateway)

	if got := md.Get(gwmeta.HeaderTenantID); len(got) != 1 || got[0] != "tenant-real" {
		t.Fatalf("x-pp-tenant-id = %v, se esperaba tenant-real", got)
	}
	if strings.Contains(strings.Join(md.Get(gwmeta.HeaderTenantID), ","), "espurio") {
		t.Fatal("una cabecera espuria del cliente llego a los metadatos salientes")
	}
}

// Sin caller (ruta pública), el origen sigue siendo el gateway.
func TestR5_PublicRouteStillIdentifiesActorService(t *testing.T) {
	md := outgoing(context.Background(), gwmeta.ActorServiceGateway)
	if got := md.Get(gwmeta.HeaderActorService); len(got) != 1 || got[0] != "api-gateway" {
		t.Errorf("x-pp-actor-service = %v", got)
	}
	if got := md.Get(gwmeta.HeaderUserID); len(got) != 0 {
		t.Errorf("no deberia haber usuario: %v", got)
	}
}

// Permisos que superan 4 KB se omiten (el servicio consulta a identity).
func TestR5_OversizedPermissionsOmitted(t *testing.T) {
	perms := make([]string, 0, 200)
	for i := 0; i < 200; i++ {
		perms = append(perms, "permiso:de:prueba:numero:"+strings.Repeat("x", 40))
	}
	ctx := gwmeta.NewContext(context.Background(), gwmeta.Caller{Permissions: perms})

	md := outgoing(ctx, gwmeta.ActorServiceGateway)

	if got := md.Get(gwmeta.HeaderPermissions); len(got) != 0 {
		t.Errorf("permisos de más de 4 KB deberian omitirse, llegaron %d bytes", len(got[0]))
	}
}

// El request id se puede fijar y leer del contexto.
func TestRequestIDInContext(t *testing.T) {
	ctx := gwmeta.WithRequestID(context.Background(), "req-42")
	if got := gwmeta.RequestIDFromContext(ctx); got != "req-42" {
		t.Fatalf("RequestIDFromContext = %q", got)
	}
	if got := gwmeta.RequestIDFromContext(context.Background()); got != "" {
		t.Fatalf("sin caller deberia ser vacio, llego %q", got)
	}
}

// Un caller vacío se detecta (rutas públicas).
func TestCallerEmpty(t *testing.T) {
	if !(gwmeta.Caller{}).Empty() {
		t.Error("un caller cero deberia ser Empty")
	}
	if (gwmeta.Caller{UserID: "u"}).Empty() {
		t.Error("un caller con usuario no es Empty")
	}
}
