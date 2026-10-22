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

	"plentypay/pos/internal/client"
	"plentypay/pos/internal/config"
	"plentypay/pos/internal/events"
	"plentypay/pos/internal/migrate"
	"plentypay/pos/internal/observability"
	"plentypay/pos/internal/pb"
	"plentypay/pos/internal/server"
	"plentypay/pos/internal/service"
	"plentypay/pos/internal/store"
)

//go:embed all:migrations
var migrationsFS embed.FS

var (
	version = "dev"
	commit  = "none"
)

const (
	serviceName     = "pos"
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
	idem := store.NewPostgresIdempotencyStore(st.Pool())
	cat, err := client.NewCatalog(cfg.CatalogAddr, cfg.CatalogTimeout)
	if err != nil {
		fatal("catalog client failed", err)
	}
	defer func() {
		if err := cat.Close(); err != nil {
			reporter.Dependency(ctx, "close catalog client failed", "catalog", err)
		}
	}()
	inv, err := client.NewInventory(cfg.InventoryAddr, cfg.InventoryTimeout)
	if err != nil {
		fatal("inventory client failed", err)
	}
	defer func() {
		if err := inv.Close(); err != nil {
			reporter.Dependency(ctx, "close inventory client failed", "inventory", err)
		}
	}()
	svc := service.New(st, cat, inv, func() time.Time { return time.Now().UTC() }, service.NewUUIDv7)
	// F17.9: devoluciones. identity solo para ConsumeStepUp (ADR 0023); payments-core reintegra.
	ids, err := client.NewIdentity(cfg.IdentityAddr, cfg.InventoryTimeout)
	if err != nil {
		fatal("identity client failed", err)
	}
	defer func() {
		if err := ids.Close(); err != nil {
			reporter.Dependency(ctx, "close identity client failed", "identity", err)
		}
	}()
	pay, err := client.NewPayments(cfg.PaymentsAddr, 5*time.Second)
	if err != nil {
		fatal("payments client failed", err)
	}
	defer func() {
		if err := pay.Close(); err != nil {
			reporter.Dependency(ctx, "close payments client failed", "payments-core", err)
		}
	}()
	svc.UseRefunds(st, ids, pay)

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

	grpcServer := grpc.NewServer(grpc.ChainUnaryInterceptor(
		observability.UnaryServerInterceptor(logger, reporter, metrics),
		server.IdempotencyInterceptor(idem, reporter),
	))
	pb.RegisterPosServer(grpcServer, server.New(svc))
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
		// Cobros de billetera de las ventas (SPEC R4): consumidor durable con ack tras aplicar.
		go func() {
			if err := relay.ConsumePayments(jobs, svc.HandlePayment); err != nil {
				fatal("payments consumer failed", err)
			}
		}()
	} else {
		logger.Warn("outbox relay disabled: PP_NATS_URL empty")
	}
	go backlogGauge(jobs, st, metrics, reporter)
	go deliverStock(jobs, svc, st, metrics, reporter)
	go deliverRefunds(jobs, svc, metrics, reporter)
	go purgeIdempotency(jobs, idem, reporter)

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

// purgeIdempotency borra cada hora las claves de más de 72 h (data-standards.md §6).
func purgeIdempotency(ctx context.Context, st store.IdempotencyStore, reporter *observability.Reporter) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if _, err := st.Purge(ctx, time.Now().UTC().Add(-store.IdempotencyTTL)); err != nil {
				reporter.Dependency(ctx, "idempotency purge failed", "postgres-db", observability.Wrap(err, "purge idempotency keys"))
			}
		}
	}
}

// deliverStock entrega cada 2 s los descuentos de existencias de las ventas pagadas (SPEC §7:
// si inventory cae, el movimiento queda diferido y se reintenta con la misma clave).
// deliverRefunds entrega a payments-core los reintegros pendientes de las devoluciones (F17.9).
func deliverRefunds(ctx context.Context, svc *service.Pos, metrics *observability.Metrics, reporter *observability.Reporter) {
	t := time.NewTicker(3 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			out, err := svc.DeliverRefunds(ctx, 20, func(task store.RefundTask, err error) {
				reporter.Dependency(ctx, "refund delivery failed", "payments-core", observability.Wrap(err, "deliver refund"),
					slog.String("pp.sale_id", task.SaleID), slog.String("pp.refund_id", task.RefundID), slog.Int("pp.attempt", task.Attempts))
			})
			if err != nil {
				reporter.Dependency(ctx, "refund worker iteration failed", "postgres-db", observability.Wrap(err, "refund worker"))
				continue
			}
			metrics.Add("pp_pos_refund_tasks_total", float64(out.Done), "result", "done")
			metrics.Add("pp_pos_refund_tasks_total", float64(out.Retried), "result", "retried")
			metrics.Add("pp_pos_refund_tasks_total", float64(out.Failed), "result", "failed")
		}
	}
}

func deliverStock(ctx context.Context, svc *service.Pos, st *store.Store, metrics *observability.Metrics, reporter *observability.Reporter) {
	t := time.NewTicker(2 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			out, err := svc.DeliverStock(ctx, 50, func(task store.StockTask, err error) {
				reporter.Dependency(ctx, "stock delivery failed", "inventory", observability.Wrap(err, "deliver stock"),
					slog.String("pp.sale_id", task.SaleID), slog.Int("pp.attempt", task.Attempts))
			})
			if err != nil {
				reporter.Dependency(ctx, "stock worker iteration failed", "postgres-db", observability.Wrap(err, "stock worker"))
				continue
			}
			metrics.Add("pp_pos_stock_tasks_total", float64(out.Done), "result", "done")
			metrics.Add("pp_pos_stock_tasks_total", float64(out.Retried), "result", "retried")
			metrics.Add("pp_pos_stock_tasks_total", float64(out.Failed), "result", "failed")
			n, age, err := st.StockBacklog(ctx, time.Now().UTC())
			if err != nil {
				reporter.Dependency(ctx, "stock backlog query failed", "postgres-db", observability.Wrap(err, "stock backlog"))
				continue
			}
			metrics.Set("pp_pos_stock_tasks_pending", float64(n))
			metrics.Set("pp_pos_stock_task_oldest_seconds", age)
		}
	}
}
