package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/server"
	"plentypay/identity/internal/store"
)

// version se inyecta en el build (-ldflags "-X main.version=...").
var version = "dev"

// Tope del apagado ordenado (go-standards.md §3.10).
const shutdownTimeout = 25 * time.Second

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	adminPort := envOr("ADMIN_PORT", "9100")
	// Subcomando para el healthcheck de Compose/Kubernetes (imagen distroless, sin shell ni curl).
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := observability.Healthcheck(context.Background(), "http://127.0.0.1:"+adminPort); err != nil {
			log.Printf("healthcheck: %v", err)
			os.Exit(1)
		}
		return
	}

	port := envOr("PORT", "50060")
	accessSecret, refreshSecret := os.Getenv("ACCESS_TOKEN_SECRET"), os.Getenv("REFRESH_TOKEN_SECRET")
	if accessSecret == "" || refreshSecret == "" {
		log.Fatal("ACCESS_TOKEN_SECRET y REFRESH_TOKEN_SECRET son obligatorios — ver .env.example. Nunca hay un secreto por defecto.")
	}
	tokens, err := auth.NewTokenIssuer(accessSecret, refreshSecret)
	if err != nil {
		log.Fatalf("configuración de tokens inválida: %v", err)
	}

	// Fase 8 (identity/SPEC.md §12): reemplazar por la implementación sobre postgres-db. Solo cambia esta línea.
	users := store.NewInMemoryUserStore()

	var ready atomic.Bool
	adminLis, err := net.Listen("tcp", ":"+adminPort)
	if err != nil {
		log.Fatalf("no se pudo escuchar en el puerto admin :%s: %v", adminPort, err)
	}
	adminSrv := observability.NewAdminServer(adminPort, &ready)
	go func() {
		if err := adminSrv.Serve(adminLis); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("fallo del servidor admin: %v", err)
		}
	}()

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("no se pudo escuchar en :%s: %v", port, err)
	}
	grpcServer := grpc.NewServer()
	pb.RegisterIdentityServer(grpcServer, server.NewIdentityServer(users, tokens))
	healthSrv := health.NewServer()
	healthpb.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)

	// Apagado ordenado: SIGTERM → ready=false → GracefulStop con tope → cerrar admin.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	done := make(chan struct{})
	go func() {
		defer close(done)
		<-stop
		log.Print("identity: apagado ordenado")
		ready.Store(false)
		healthSrv.Shutdown()
		stopped := make(chan struct{})
		go func() { grpcServer.GracefulStop(); close(stopped) }()
		select {
		case <-stopped:
		case <-time.After(shutdownTimeout):
			grpcServer.Stop()
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = adminSrv.Shutdown(ctx)
	}()

	ready.Store(true)
	log.Printf("identity %s escuchando en :%s (admin :%s)", version, port, adminPort)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("fallo del servidor gRPC: %v", err)
	}
	<-done
}
