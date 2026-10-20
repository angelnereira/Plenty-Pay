package client

import (
	"context"
	"io"
	"net"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"plentypay/api-gateway/internal/observability"
)

// La conexión hacia un contenedor que todavía no escucha se recupera sola cuando arranca, sin
// reiniciar el gateway (orden de arranque de docker compose).
func TestF11_ServiceConnRecoversWhenTargetStartsLater(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := lis.Addr().String()
	_ = lis.Close() // nadie escucha todavía

	logger := observability.NewLogger(io.Discard, "test", "dev", observability.ParseLevel("error"))
	metrics := observability.NewMetrics("test", "dev", "x")
	conn, err := NewServiceConn(addr, observability.NewReporter(logger, "test", metrics))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	client := healthpb.NewHealthClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	if _, err := client.Check(ctx, &healthpb.HealthCheckRequest{}); err == nil {
		t.Fatal("sin servidor la llamada debía fallar")
	}
	cancel()

	lis2, err := net.Listen("tcp", addr)
	if err != nil {
		t.Skipf("el puerto %s ya no está libre: %v", addr, err)
	}
	srv := grpc.NewServer()
	healthpb.RegisterHealthServer(srv, health.NewServer())
	go func() { _ = srv.Serve(lis2) }()
	defer srv.Stop()

	deadline := time.Now().Add(10 * time.Second)
	for {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		_, err := client.Check(ctx, &healthpb.HealthCheckRequest{})
		cancel()
		if err == nil {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("la conexión no se recuperó en 10 s: %v", err)
		}
		time.Sleep(200 * time.Millisecond)
	}
}
