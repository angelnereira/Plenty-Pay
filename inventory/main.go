package main

import (
	"context"
	"embed"
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

	"plentypay/inventory/internal/client"
	"plentypay/inventory/internal/config"
	"plentypay/inventory/internal/events"
	"plentypay/inventory/internal/migrate"
	"plentypay/inventory/internal/observability"
	"plentypay/inventory/internal/pb"
	"plentypay/inventory/internal/server"
	"plentypay/inventory/internal/service"
	"plentypay/inventory/internal/store"
)

//go:embed all:migrations
var migrationsFS embed.FS

var (
	version = "dev"
	commit  = "none"
)

const (
	serviceName     = "inventory"
	shutdownTimeout = 25 * time.Second
)

func main() {
	cfg, cfgErr := config.Load()
	logger := observability.NewLogger(os.Stdout, serviceName, version, observability.ParseLevel(os.Getenv("LOG_LEVEL")))
	slog.SetDefault(logger)
	metrics := observability.NewMetrics(serviceName, version, commit)
	reporter := observability.NewReporter(logger, serviceName, metrics)
	ctx := context.Background()
	fatal := func(msg string, err error) {
		reporter.Defect(ctx, msg, observability.Wrap(err, "startup"))
		os.Exit(1)
	}
	if cfgErr != nil {
		fatal("invalid configuration", cfgErr)
	}

	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := observability.Healthcheck(ctx, "http://127.0.0.1:"+cfg.AdminPort); err != nil {
			logger.Warn("healthcheck failed", "err", err.Error())
			os.Exit(1)
		}
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		dsn := cfg.MigrateDSN
		if dsn == "" {
			fatal("migrate requires PP_MIGRATE_DSN", errors.New("PP_MIGRATE_DSN vacío"))
		}
		res, err := migrate.Up(ctx, dsn, migrationsFS)
		if err != nil {
			fatal("migrate failed", err)
		}
		logger.Info("migrate done", "version", res.Version, "applied", res.Applied, "dirty", res.Dirty)
		return
	}
	if err := cfg.RequireDB(); err != nil {
		fatal("invalid configuration", err)
	}

	st, err := store.Open(ctx, cfg.DBDSN)
	if err != nil {
		fatal("postgres store failed", err)
	}
	defer st.Close()
	products, err := client.NewCatalog(cfg.CatalogAddr, cfg.CatalogTimeout)
	if err != nil {
		fatal("catalog client failed", err)
	}
	defer func() {
		if err := products.Close(); err != nil {
			reporter.Dependency(ctx, "close catalog client failed", "catalog", err)
		}
	}()
	svc := service.New(st, products, func() time.Time { return time.Now().UTC() }, service.NewUUIDv7)

	shutdownTracing, err := observability.SetupTracing(ctx, serviceName, version, os.Stdout)
	if err != nil {
		fatal("tracing setup failed", err)
	}

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

	// La idempotencia de los movimientos vive en su propia fila (store.Apply), en la misma
	// transacción que el cambio de existencia.
	grpcServer := grpc.NewServer(grpc.ChainUnaryInterceptor(
		observability.UnaryServerInterceptor(logger, reporter, metrics),
	))
	pb.RegisterInventoryServer(grpcServer, server.New(svc))
	healthSrv := health.NewServer()
	healthpb.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)

	jobs, stopJobs := context.WithCancel(context.Background())
	defer stopJobs()
	var relay *events.Relay
	if cfg.NATSUrl != "" {
		relay, err = events.NewRelay(st, cfg.NATSUrl, cfg.NATSUser, cfg.NATSPass, logger, reporter, metrics,
			func() time.Time { return time.Now().UTC() })
		if err != nil {
			fatal("outbox relay failed", err)
		}
		go relay.Run(jobs)
	} else {
		logger.Warn("outbox relay disabled: PP_NATS_URL empty")
	}
	go backlogGauge(jobs, st, metrics, reporter)
	go expireReservations(jobs, svc, metrics, reporter)

	lis, err := net.Listen("tcp", ":"+cfg.Port)
	if err != nil {
		fatal("grpc port listen failed", err)
	}
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
		stopJobs()
		if relay != nil {
			relay.Close()
		}
		sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := adminSrv.Shutdown(sctx); err != nil {
			reporter.Dependency(sctx, "admin shutdown failed", "admin", err)
		}
		if err := shutdownTracing(sctx); err != nil {
			reporter.Dependency(sctx, "tracing shutdown failed", "otel-collector", err)
		}
	}()

	ready.Store(true)
	logger.Info("service started", "port", cfg.Port, "admin_port", cfg.AdminPort)
	if err := grpcServer.Serve(lis); err != nil {
		fatal("grpc server failed", err)
	}
	<-done
}

// backlogGauge publica cada 15 s cuántos eventos esperan en el outbox (alerta si crece).
func backlogGauge(ctx context.Context, st *store.Store, metrics *observability.Metrics, reporter *observability.Reporter) {
	t := time.NewTicker(15 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			n, err := st.OutboxBacklog(ctx)
			if err != nil {
				reporter.Dependency(ctx, "outbox backlog query failed", "postgres-db", observability.Wrap(err, "outbox backlog"))
				continue
			}
			metrics.Set("pp_outbox_pending", float64(n))
		}
	}
}

// expireReservations vence cada 30 s las reservas cuyo TTL pasó (R4): ninguna es indefinida.
func expireReservations(ctx context.Context, svc *service.Inventory, metrics *observability.Metrics, reporter *observability.Reporter) {
	t := time.NewTicker(30 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			n, err := svc.ExpireReservations(ctx, 200)
			if err != nil {
				reporter.Dependency(ctx, "reservation expiry failed", "postgres-db", observability.Wrap(err, "expire reservations"))
				continue
			}
			metrics.Add("pp_inventory_reservations_expired_total", float64(n))
		}
	}
}
