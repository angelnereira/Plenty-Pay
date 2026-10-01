// Tests de integración del servicio identity sobre gRPC real (bufconn):
// flujo completo auth → sesión → autorización → logout, salud, correlación.
package server_test

import (
	"context"
	"io"
	"log/slog"
	"net"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	commonv1 "plentypay.dev/contracts/gen/go/plentypay/common/v1"
	identityv1 "plentypay.dev/contracts/gen/go/plentypay/identity/v1"
	"plentypay.dev/services/identity/internal/auth"
	"plentypay.dev/services/identity/internal/server"
	"plentypay.dev/services/identity/internal/store"
)

type fixture struct {
	client identityv1.IdentityServiceClient
	health commonv1.HealthServiceClient
	stop   func()
}

func startServer(t *testing.T) *fixture {
	t.Helper()
	lis := bufconn.Listen(1024 * 1024)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := server.NewIdentity(server.Options{
		DB:       store.NewMemoryStore(),
		Sessions: auth.NewSessionStore(time.Minute),
		Auditor:  store.NewMemoryAuditor(),
		Hasher:   auth.NewTestingHasher(),
		Log:      log,
	})
	srv := grpc.NewServer(grpc.UnaryInterceptor(server.UnaryCorrelation(log)))
	identityv1.RegisterIdentityServiceServer(srv, svc)
	commonv1.RegisterHealthServiceServer(srv, svc)
	go func() { _ = srv.Serve(lis) }()

	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("grpc.NewClient: %v", err)
	}
	t.Cleanup(func() { srv.Stop(); _ = conn.Close() })
	return &fixture{
		client: identityv1.NewIdentityServiceClient(conn),
		health: commonv1.NewHealthServiceClient(conn),
		stop:   func() { srv.Stop(); _ = conn.Close() },
	}
}

func TestFullAuthFlowAndDynamicAuthz(t *testing.T) {
	f := startServer(t)
	ctx := context.Background()

	// 1. Crear tenant + owner.
	ten, err := f.client.CreateTenant(ctx, &identityv1.CreateTenantRequest{
		Name: "Cafetería Colón", OwnerEmail: "owner@cafe.com", OwnerPassword: "sup3rsecreta",
	})
	if err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	if ten.GetTenant().GetTenantId() == "" || ten.GetOwner().GetUserId() == "" {
		t.Fatal("tenant/owner con ids")
	}

	// 2. Autenticar owner.
	authResp, err := f.client.AuthenticatePassword(ctx, &identityv1.AuthenticatePasswordRequest{
		Email: "owner@cafe.com", Password: "sup3rsecreta",
	})
	if err != nil {
		t.Fatalf("AuthenticatePassword: %v", err)
	}
	tok := authResp.GetSession().GetToken()
	if tok == "" {
		t.Fatal("token de sesión vacío")
	}

	// 3. Validar sesión.
	val, err := f.client.ValidateSession(ctx, &identityv1.ValidateSessionRequest{Token: tok})
	if err != nil || !val.GetValid() || val.GetUser().GetEmail() != "owner@cafe.com" {
		t.Fatalf("ValidateSession: valid=%v err=%v", val.GetValid(), err)
	}

	// 4. Contexto de autorización dinámico (mandato §7): OWNER ve módulos
	//    de negocio completos.
	authz, err := f.client.GetAuthorizationContext(ctx, &identityv1.GetAuthorizationContextRequest{SessionToken: tok})
	if err != nil {
		t.Fatalf("GetAuthorizationContext: %v", err)
	}
	hasRole, hasPermPOS, hasFeatWallet := false, false, false
	for _, r := range authz.GetRoles() {
		if r.GetKey() == "OWNER" {
			hasRole = true
		}
	}
	for _, p := range authz.GetPermissions() {
		if p.GetResource() == "pos" && p.GetAction() == "write" {
			hasPermPOS = true
		}
	}
	for _, ft := range authz.GetFeatures() {
		if ft.GetKey() == "wallet" && ft.GetEnabled() {
			hasFeatWallet = true
		}
	}
	if !hasRole || !hasPermPOS || !hasFeatWallet {
		t.Fatalf("contexto OWNER incompleto: role=%v pos.write=%v wallet=%v", hasRole, hasPermPOS, hasFeatWallet)
	}

	// 5. Logout revoca; la sesión muere.
	if _, err := f.client.Logout(ctx, &identityv1.LogoutRequest{SessionToken: tok}); err != nil {
		t.Fatalf("Logout: %v", err)
	}
	val2, err := f.client.ValidateSession(ctx, &identityv1.ValidateSessionRequest{Token: tok})
	if err != nil {
		t.Fatalf("ValidateSession tras logout: %v", err)
	}
	if val2.GetValid() {
		t.Fatal("sesión revocada NO debe validar")
	}
}

func TestBadCredentialsUniformMessage(t *testing.T) {
	// Anti-enumeración (§13): email inexistente y contraseña mala devuelven
	// el MISMO código y mensaje.
	f := startServer(t)
	ctx := context.Background()

	_, errWrongPass := f.client.AuthenticatePassword(ctx, &identityv1.AuthenticatePasswordRequest{
		Email: "alguien@existe.com", Password: "mala",
	})
	// Primera llamada con email inexistente:
	_, errNoUser := f.client.AuthenticatePassword(ctx, &identityv1.AuthenticatePasswordRequest{
		Email: "nadie@existe.com", Password: "mala",
	})

	if status.Code(errWrongPass) != codes.Unauthenticated || status.Code(errNoUser) != codes.Unauthenticated {
		t.Fatalf("ambos deben ser Unauthenticated: %v / %v", errWrongPass, errNoUser)
	}
	if !strings.Contains(status.Convert(errWrongPass).Message(), "credenciales inválidas") {
		t.Fatalf("mensaje uniforme esperado, got %q", status.Convert(errWrongPass).Message())
	}
}

func TestDuplicateTenantAndEmailRejected(t *testing.T) {
	f := startServer(t)
	ctx := context.Background()

	_, err := f.client.CreateTenant(ctx, &identityv1.CreateTenantRequest{
		Name: "Duplicado", OwnerEmail: "a@b.com", OwnerPassword: "x",
	})
	if err != nil {
		t.Fatalf("crear tenant: %v", err)
	}
	// Mismo nombre de tenant:
	if _, err := f.client.CreateTenant(ctx, &identityv1.CreateTenantRequest{
		Name: "Duplicado", OwnerEmail: "c@d.com", OwnerPassword: "x",
	}); status.Code(err) != codes.AlreadyExists {
		t.Fatalf("tenant duplicado debe ser AlreadyExists, got %v", err)
	}
	// Email ya registrado (global, v1):
	if _, err := f.client.CreateTenant(ctx, &identityv1.CreateTenantRequest{
		Name: "Otro", OwnerEmail: "a@b.com", OwnerPassword: "x",
	}); status.Code(err) != codes.AlreadyExists {
		t.Fatalf("email duplicado debe ser AlreadyExists, got %v", err)
	}
}

func TestHealthServing(t *testing.T) {
	f := startServer(t)
	resp, err := f.health.Check(context.Background(), &commonv1.CheckRequest{})
	if err != nil {
		t.Fatalf("health: %v", err)
	}
	if resp.GetStatus() != commonv1.ServingStatus_SERVING_STATUS_SERVING {
		t.Fatalf("servicio debe reportar SERVING, got %v", resp.GetStatus())
	}
}

func TestCorrelationEcho(t *testing.T) {
	// ADR-0004: si el cliente trae x-correlation-id, se propaga; si no, se
	// inyecta. En ambos casos el header de respuesta lo devuelve.
	f := startServer(t)
	ctx := metadata.AppendToOutgoingContext(context.Background(), "x-correlation-id", "corr-test-123")
	var header metadata.MD
	_, err := f.client.CreateTenant(ctx, &identityv1.CreateTenantRequest{
		Name: "Correlación S.A.", OwnerEmail: "owner@corr.com", OwnerPassword: "s3creta",
	}, grpc.Header(&header))
	if err != nil {
		t.Fatalf("llamada: %v", err)
	}
	got := header.Get("x-correlation-id")
	if len(got) == 0 || got[0] == "" {
		t.Fatal("header x-correlation-id ausente en respuesta")
	}
	if got[0] != "corr-test-123" {
		t.Fatalf("correlation propagada, got %q", got[0])
	}
}

func TestValidationFailFast(t *testing.T) {
	// Fail fast: campos vacíos → InvalidArgument (§21).
	f := startServer(t)
	if _, err := f.client.CreateTenant(context.Background(), &identityv1.CreateTenantRequest{
		Name: "X", OwnerEmail: "x@y.com", // password vacío
	}); status.Code(err) != codes.InvalidArgument {
		t.Fatalf("esperado InvalidArgument, got %v", err)
	}
}
