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

	"plentypay/orders/internal/client"
	"plentypay/orders/internal/config"
	"plentypay/orders/internal/events"
	"plentypay/orders/internal/migrate"
	"plentypay/orders/internal/observability"
	"plentypay/orders/internal/pb"
	"plentypay/orders/internal/server"
	"plentypay/orders/internal/service"
	"plentypay/orders/internal/store"
)

//go:embed all:migrations
var migrationsFS embed.FS

var (
	version = "dev"
	commit  = "none"
)

const (
	serviceName     = "orders"
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
	deps, err := client.New(cfg.CatalogAddr, cfg.InventoryAddr, cfg.PaymentsAddr, cfg.Timeout, cfg.PaymentsTimeout)
	if err != nil {
		fatal("dependency clients failed", err)
	}
	defer func() {
		if err := deps.Close(); err != nil {
			reporter.Dependency(ctx, "close clients failed", "grpc", err)
		}
	}()
	svc := service.New(st, deps, func() time.Time { return time.Now().UTC() }, service.NewUUIDv7, cfg.AcceptSLA)

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

	// La idempotencia del checkout es (comprador, clave) en la tabla de pedidos; las acciones del
	// comercio son idempotentes por estado.
	grpcServer := grpc.NewServer(grpc.ChainUnaryInterceptor(
		observability.UnaryServerInterceptor(logger, reporter, metrics),
	))
	pb.RegisterOrdersServer(grpcServer, server.New(svc))
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
		go func() {
			if err := relay.ConsumePayments(jobs, func(ctx context.Context, e events.PaymentEvent) error {
				if e.Captured {
					return svc.PaymentCaptured(ctx, e.EventID, e.OrderID, e.PaymentID)
				}
				return svc.PaymentFailed(ctx, e.EventID, e.OrderID)
			}); err != nil {
				fatal("payments consumer failed", err)
			}
		}()
	} else {
		logger.Warn("outbox relay disabled: PP_NATS_URL empty")
	}
	go backlogGauge(jobs, st, metrics, reporter)
	go every(jobs, 2*time.Second, "saga tasks", reporter, func(ctx context.Context) error {
		out, err := svc.RunTasks(ctx, 50, func(t store.Task, err error) {
			reporter.Dependency(ctx, "saga task failed", "downstream", observability.Wrap(err, t.Kind),
				slog.String("pp.order_id", t.OrderID), slog.Int("pp.attempt", t.Attempts))
		})
		metrics.Add("pp_orders_saga_tasks_total", float64(out.Done), "result", "done")
		metrics.Add("pp_orders_saga_tasks_total", float64(out.Retried), "result", "retried")
		metrics.Add("pp_orders_saga_tasks_total", float64(out.Failed), "result", "failed")
		if err != nil {
			return err
		}
		n, age, err := st.TaskBacklog(ctx, time.Now().UTC())
		metrics.Set("pp_orders_saga_tasks_pending", float64(n))
		metrics.Set("pp_orders_saga_task_oldest_seconds", age)
		return err
	})
	go every(jobs, 30*time.Second, "acceptance sla", reporter, func(ctx context.Context) error {
		n, err := svc.ExpireAcceptance(ctx, 100)
		metrics.Add("pp_sub_orders_auto_rejected_total", float64(n))
		return err
	})
	go every(jobs, 30*time.Second, "pending recovery", reporter, func(ctx context.Context) error {
		_, err := svc.RecoverPending(ctx, 100)
		return err
	})

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

// every corre `fn` cada `d`; un fallo se registra una vez como dependencia y se reintenta.
func every(ctx context.Context, d time.Duration, name string, reporter *observability.Reporter, fn func(context.Context) error) {
	t := time.NewTicker(d)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := fn(ctx); err != nil {
				reporter.Dependency(ctx, "job failed", "postgres-db", observability.Wrap(err, name))
			}
		}
	}
}
