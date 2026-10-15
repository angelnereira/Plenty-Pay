package client

import (
	"context"
	"net"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	gwmeta "plentypay/api-gateway/internal/metadata"
	"plentypay/api-gateway/internal/observability"
	"plentypay/api-gateway/internal/pb"
)

// stubIdentity registra los metadatos de cada llamada entrante.
type stubIdentity struct {
	pb.UnimplementedIdentityServer
	md metadata.MD
}

func (s *stubIdentity) GetTenant(ctx context.Context, req *pb.GetTenantRequest) (*pb.Tenant, error) {
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		s.md = md.Copy()
	}
	if req.GetTenantId() == "caido" {
		return nil, status.Error(codes.Unavailable, "identity caido")
	}
	return &pb.Tenant{TenantId: "t1"}, nil
}

// startStub levanta un identity de prueba en memoria y devuelve el cliente real
// del gateway apuntando a el (misma cadena de interceptores que en produccion).
func startStub(t *testing.T) (*IdentityClient, *stubIdentity) {
	t.Helper()
	lis := bufconn.Listen(1024 * 1024)
	stub := &stubIdentity{md: metadata.MD{}}
	srv := grpc.NewServer()
	pb.RegisterIdentityServer(srv, stub)
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)

	metrics := observability.NewMetrics("api-gateway", "test", "none")
	reporter := observability.NewReporter(nil, "api-gateway", metrics)
	conn, err := grpc.NewClient("passthrough:///bufnet",
		append(dialOptions(reporter, insecure.NewCredentials()),
			grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
				return lis.DialContext(ctx)
			}))...)
	if err != nil {
		t.Fatalf("grpc.NewClient: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return &IdentityClient{conn: conn, client: pb.NewIdentityClient(conn), reporter: reporter}, stub
}

// R5: el servicio recibe el tenant y el usuario que el gateway VALIDO, no lo que
// mando el cliente.
func TestR5_IdentityReceivesValidatedMetadata(t *testing.T) {
	cli, stub := startStub(t)
	ctx := gwmeta.NewContext(context.Background(), gwmeta.Caller{
		UserID: "user-validado", TenantID: "tenant-validado", Role: "BUSINESS_OWNER",
	})

	_, err := cli.client.GetTenant(ctx, &pb.GetTenantRequest{TenantId: "t1"})
	if err != nil {
		t.Fatalf("GetTenant: %v", err)
	}
	if got := stub.md.Get(gwmeta.HeaderUserID); len(got) != 1 || got[0] != "user-validado" {
		t.Errorf("x-pp-user-id = %v, se esperaba user-validado", got)
	}
	if got := stub.md.Get(gwmeta.HeaderTenantID); len(got) != 1 || got[0] != "tenant-validado" {
		t.Errorf("x-pp-tenant-id = %v, se esperaba tenant-validado", got)
	}
	if got := stub.md.Get(gwmeta.HeaderActorService); len(got) != 1 || got[0] != "api-gateway" {
		t.Errorf("x-pp-actor-service = %v", got)
	}
}

// Ruta publica (sin caller): no viaja usuario ni tenant, pero si el origen.
func TestR5_PublicRouteCarriesOnlyActorService(t *testing.T) {
	cli, stub := startStub(t)

	if _, err := cli.client.GetTenant(context.Background(), &pb.GetTenantRequest{TenantId: "t1"}); err != nil {
		t.Fatalf("GetTenant: %v", err)
	}
	if got := stub.md.Get(gwmeta.HeaderUserID); len(got) != 0 {
		t.Errorf("no deberia viajar usuario: %v", got)
	}
	if got := stub.md.Get(gwmeta.HeaderActorService); len(got) != 1 || got[0] != "api-gateway" {
		t.Errorf("x-pp-actor-service = %v", got)
	}
}

// El request id del gateway llega al servicio (correlacion de punta a punta).
func TestR5_RequestIDReachesService(t *testing.T) {
	cli, stub := startStub(t)
	ctx := observability.WithRequestID(context.Background(), "req-desde-gateway")

	if _, err := cli.client.GetTenant(ctx, &pb.GetTenantRequest{TenantId: "t1"}); err != nil {
		t.Fatalf("GetTenant: %v", err)
	}
	if got := stub.md.Get(gwmeta.HeaderRequestID); len(got) != 1 || got[0] != "req-desde-gateway" {
		t.Errorf("x-pp-request-id = %v, se esperaba req-desde-gateway", got)
	}
}

// Un error del servicio se propaga tal cual (la cadena no lo tapa).
func TestR5_ErrorPropagates(t *testing.T) {
	cli, _ := startStub(t)
	_, err := cli.client.GetTenant(context.Background(), &pb.GetTenantRequest{TenantId: "caido"})
	if status.Code(err) != codes.Unavailable {
		t.Fatalf("se esperaba Unavailable, llego %v", err)
	}
}
