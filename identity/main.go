package main

import (
	"context"
	"errors"
	"log/slog"
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

const serviceName = "identity"

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	logger := observability.NewLogger(os.Stdout, serviceName, version, observability.ParseLevel(os.Getenv("LOG_LEVEL")))
	slog.SetDefault(logger)
	metrics := observability.NewMetrics(serviceName, version)
	reporter := observability.NewReporter(logger, serviceName, metrics)
	ctx := context.Background()
	// fatal registra el fallo de arranque con su pila y termina: sin esto el proceso no puede servir.
	fatal := func(msg string, err error) {
		reporter.Defect(ctx, msg, observability.Wrap(err, "startup"))
		os.Exit(1)
	}

	adminPort := envOr("ADMIN_PORT", "9100")
	// Subcomando para el healthcheck de Compose/Kubernetes (imagen distroless, sin shell ni curl).
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := observability.Healthcheck(context.Background(), "http://127.0.0.1:"+adminPort); err != nil {
			logger.Warn("healthcheck failed", "err", err.Error())
			os.Exit(1)
		}
		return
	}

	port := envOr("PORT", "50060")
	accessSecret, refreshSecret := os.Getenv("ACCESS_TOKEN_SECRET"), os.Getenv("REFRESH_TOKEN_SECRET")
	if accessSecret == "" || refreshSecret == "" {
		fatal("missing token secrets", errors.New("ACCESS_TOKEN_SECRET y REFRESH_TOKEN_SECRET son obligatorios (ver .env.example); nunca hay un secreto por defecto"))
	}
	tokens, err := auth.NewTokenIssuer(accessSecret, refreshSecret)
	if err != nil {
		fatal("invalid token configuration", err)
	}

	// Fase 8 (identity/SPEC.md §12): reemplazar por la implementación sobre postgres-db. Solo cambia esta línea.
	users := store.NewInMemoryUserStore()

	var ready atomic.Bool
	adminLis, err := net.Listen("tcp", ":"+adminPort)
	if err != nil {
		fatal("admin port listen failed", err)
	}
	adminSrv := observability.NewAdminServer(adminPort, &ready, metrics)
	go func() {
		if err := adminSrv.Serve(adminLis); err != nil && !errors.Is(err, http.ErrServerClosed) {
			fatal("admin server failed", err)
		}
	}()

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		fatal("grpc port listen failed", err)
	}
	shutdownTracing, err := observability.SetupTracing(ctx, serviceName, version, os.Stdout)
	if err != nil {
		fatal("tracing setup failed", err)
	}
	grpcServer := grpc.NewServer(grpc.ChainUnaryInterceptor(observability.UnaryServerInterceptor(logger, reporter, metrics)))
	pb.RegisterIdentityServer(grpcServer, server.NewIdentityServer(users, tokens, reporter))
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
		logger.Info("graceful shutdown started")
		ready.Store(false)
		healthSrv.Shutdown()
		stopped := make(chan struct{})
		go func() { grpcServer.GracefulStop(); close(stopped) }()
		select {
		case <-stopped:
		case <-time.After(shutdownTimeout):
			grpcServer.Stop()
		}
		sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = adminSrv.Shutdown(sctx)
		_ = shutdownTracing(sctx) // vacía los spans pendientes antes de salir
	}()

	ready.Store(true)
	logger.Info("service started", "port", port, "admin_port", adminPort)
	if err := grpcServer.Serve(lis); err != nil {
		fatal("grpc server failed", err)
	}
	<-done
}
