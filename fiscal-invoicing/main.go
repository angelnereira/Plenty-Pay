package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"plentypay/fiscal-invoicing/internal/client"
	"plentypay/fiscal-invoicing/internal/config"
	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/events"
	"plentypay/fiscal-invoicing/internal/migrate"
	"plentypay/fiscal-invoicing/internal/observability"
	"plentypay/fiscal-invoicing/internal/pac"
	"plentypay/fiscal-invoicing/internal/pac/hka"
	"plentypay/fiscal-invoicing/internal/pac/simulator"
	"plentypay/fiscal-invoicing/internal/pb"
	"plentypay/fiscal-invoicing/internal/server"
	"plentypay/fiscal-invoicing/internal/service"
	"plentypay/fiscal-invoicing/internal/store"
)

//go:embed all:migrations
var migrationsFS embed.FS

var (
	version = "dev"
	commit  = "none"
)

const (
	serviceName     = "fiscal-invoicing"
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
		if cfg.MigrateDSN == "" {
			fatal("migrate requires PP_MIGRATE_DSN", errors.New("PP_MIGRATE_DSN vacío"))
		}
		res, err := migrate.Up(ctx, cfg.MigrateDSN, migrationsFS)
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
	identity, err := client.NewIdentity(cfg.IdentityAddr, cfg.CallTimeout)
	if err != nil {
		fatal("identity client failed", err)
	}
	secrets, err := client.NewSecurity(cfg.SecurityAddr, cfg.CallTimeout)
	if err != nil {
		fatal("security client failed", err)
	}
	now := func() time.Time { return time.Now().UTC() }
	infra, err := client.NewInfra(cfg.InfraAddr, cfg.CallTimeout, now)
	if err != nil {
		fatal("infra-management client failed", err)
	}
	defer func() {
		for name, c := range map[string]interface{ Close() error }{"identity": identity, "security": secrets, "infra-management": infra} {
			if err := c.Close(); err != nil {
				reporter.Dependency(ctx, "close client failed", name, err)
			}
		}
	}()
	newID := func() string { return uuid.Must(uuid.NewV7()).String() }
	// R9/R10: selector de PAC con los adaptadores de PP_PAC_PROVIDERS (ADR 0022).
	pacs, err := pacRegistry(cfg)
	if err != nil {
		fatal("pac providers invalid", err)
	}
	svc := service.NewInvoicing(service.New(st, identity, secrets, pacs, now, newID), st, infra, metrics, reporter)

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
	))
	pb.RegisterFiscalInvoicingServer(grpcServer, server.New(svc))
	healthSrv := health.NewServer()
	healthpb.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)

	jobs, stopJobs := context.WithCancel(context.Background())
	defer stopJobs()
	var relay *events.Relay
	if cfg.NATSUrl != "" {
		relay, err = events.NewRelay(st, cfg.NATSUrl, cfg.NATSUser, cfg.NATSPass, logger, reporter, metrics, now)
		if err != nil {
			fatal("outbox relay failed", err)
		}
		go relay.Run(jobs)
	} else {
		logger.Warn("outbox relay disabled: PP_NATS_URL empty")
	}
	go backlogGauge(jobs, st, metrics, reporter)
	go sendWorker(jobs, svc, reporter)

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

// sendWorker envía al PAC cada 5 s los documentos vencidos (R3), fuera de las transacciones.
func sendWorker(ctx context.Context, svc *service.Invoicing, reporter *observability.Reporter) {
	t := time.NewTicker(5 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if _, err := svc.ProcessDue(ctx, 50); err != nil {
				reporter.Dependency(ctx, "invoice send loop failed", "postgres-db", err)
			}
		}
	}
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

// pacAdapters es el único lugar que conoce los PAC disponibles (R10, ADR 0022). Sumar un PAC = un
// subpaquete en internal/pac/<id> y una línea aquí; PP_PAC_PROVIDERS decide cuáles se ofrecen.
var pacAdapters = map[string]func(config.Config) pac.Client{
	domain.ProviderSimulator: func(config.Config) pac.Client { return simulator.New() },
	hka.ID: func(c config.Config) pac.Client {
		return hka.New(hka.Config{DemoEndpoint: os.Getenv("PP_PAC_HKA_DEMO_ENDPOINT"),
			ProdEndpoint: os.Getenv("PP_PAC_HKA_PROD_ENDPOINT"), Timeout: c.PACTimeout, ProdEnabled: c.FiscalProdEnabled})
	},
}

func pacRegistry(cfg config.Config) (*pac.Registry, error) {
	clients := make([]pac.Client, 0, len(cfg.PACProviders))
	for _, id := range cfg.PACProviders {
		mk, ok := pacAdapters[id]
		if !ok {
			return nil, fmt.Errorf("PP_PAC_PROVIDERS: adaptador %q desconocido", id)
		}
		clients = append(clients, mk(cfg))
	}
	return pac.NewRegistry(clients...), nil
}
