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

	"plentypay/security/internal/client"
	"plentypay/security/internal/config"
	"plentypay/security/internal/observability"
	"plentypay/security/internal/pb"
	"plentypay/security/internal/server"
	"plentypay/security/internal/service"
	"plentypay/security/internal/store"
)

var (
	version = "dev"
	commit  = "none"
)

const (
	serviceName     = "security"
	shutdownTimeout = 25 * time.Second
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", "err", err.Error())
		os.Exit(1)
	}

	logger := observability.NewLogger(os.Stdout, serviceName, version, observability.ParseLevel(cfg.LogLevel))
	slog.SetDefault(logger)
	metrics := observability.NewMetrics(serviceName, version, commit)
	reporter := observability.NewReporter(logger, serviceName, metrics)
	ctx := context.Background()

	fatal := func(msg string, err error) {
		reporter.Defect(ctx, msg, observability.Wrap(err, "startup"))
		os.Exit(1)
	}

	// Subcomando para healthcheck en contenedores distroless
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := observability.Healthcheck(context.Background(), "http://127.0.0.1:"+cfg.AdminPort); err != nil {
			logger.Warn("healthcheck failed", "err", err.Error())
			os.Exit(1)
		}
		return
	}

	// Inicializar almacenes y servicios
	mem := store.NewMemoryStore(cfg.BootstrapToken)
	var secretStore store.SecretStore = mem
	if cfg.VaultAddr != "" && cfg.VaultToken != "" {
		secretStore = client.NewOpenBaoClient(cfg.VaultAddr, cfg.VaultToken)
	}
	secService := service.NewSecurityService(secretStore, mem, mem, mem, mem)

	var ready atomic.Bool
	adminLis, err := net.Listen("tcp", ":"+cfg.AdminPort)
	if err != nil {
		fatal("admin port listen failed", err)
	}
	adminSrv := observability.NewAdminServer(cfg.AdminPort, &ready, metrics)
	go func() {
		if err := adminSrv.Serve(adminLis); err != nil && !errors.Is(err, http.ErrServerClosed) {
			fatal("admin server failed", err)
		}
	}()

	lis, err := net.Listen("tcp", ":"+cfg.Port)
	if err != nil {
		fatal("grpc port listen failed", err)
	}
	shutdownTracing, err := observability.SetupTracing(ctx, serviceName, version, os.Stdout)
	if err != nil {
		fatal("tracing setup failed", err)
	}

	grpcServer := grpc.NewServer(grpc.ChainUnaryInterceptor(observability.UnaryServerInterceptor(logger, reporter, metrics)))
	pb.RegisterSecurityServer(grpcServer, server.NewServer(secService, reporter, metrics))

	healthSrv := health.NewServer()
	healthpb.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)

	// Apagado ordenado: SIGTERM → ready=false → GracefulStop con tope → cerrar admin
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
		_ = shutdownTracing(sctx)
	}()

	ready.Store(true)
	logger.Info("service started", "port", cfg.Port, "admin_port", cfg.AdminPort)
	if err := grpcServer.Serve(lis); err != nil {
		fatal("grpc server failed", err)
	}
	<-done
}
