// Contenedor web: sirve el bundle de Flutter Web y los archivos estáticos propios
// (web/SPEC.md §5, paso F02.8). Sin base de datos, sin gRPC.
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

	"plentypay/web/internal/config"
	"plentypay/web/internal/observability"
	"plentypay/web/internal/server"
)

// version se inyecta en el build (-ldflags "-X main.version=...").
var (
	version = "dev"
	commit  = "none"
)

// Tope del apagado ordenado (go-standards.md §3.10).
const shutdownTimeout = 25 * time.Second

const serviceName = "web"

func main() {
	logger := observability.NewLogger(os.Stdout, serviceName, version, observability.ParseLevel(os.Getenv("LOG_LEVEL")))
	slog.SetDefault(logger)
	metrics := observability.NewMetrics(serviceName, version, commit)
	reporter := observability.NewReporter(logger, serviceName, metrics)
	ctx := context.Background()
	fatal := func(msg string, err error) {
		reporter.Defect(ctx, msg, observability.Wrap(err, "startup"))
		os.Exit(1)
	}

	adminPort := observability.EnvOr("ADMIN_PORT", "9100")
	// Subcomando para el healthcheck de Compose/Kubernetes (imagen distroless, sin shell ni curl).
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := observability.Healthcheck(context.Background(), "http://127.0.0.1:"+adminPort); err != nil {
			logger.Warn("healthcheck failed", "err", err.Error())
			os.Exit(1)
		}
		return
	}

	cfg, err := config.FromEnv(version)
	if err != nil {
		fatal("invalid configuration", err)
	}
	shutdownTracing, err := observability.SetupTracing(ctx, serviceName, version, os.Stdout)
	if err != nil {
		fatal("tracing setup failed", err)
	}
	if !server.New(cfg, reporter).Ready() {
		logger.Warn("flutter web bundle missing, serving maintenance page")
	}

	// ready = el bundle está servido. La página de mantenimiento (R4) no es "listo".
	var ready atomic.Bool
	web := server.New(cfg, reporter)
	ready.Store(web.Ready())

	adminLis, err := net.Listen("tcp", ":"+adminPort)
	if err != nil {
		fatal("admin port listen failed", err)
	}
	adminSrv := observability.NewAdminServer(":"+adminPort, &ready, metrics)
	go func() {
		if err := adminSrv.Serve(adminLis); err != nil && !errors.Is(err, http.ErrServerClosed) {
			fatal("admin server failed", err)
		}
	}()

	addr := cfg.HTTPAddr
	if addr == "" {
		addr = ":8081"
	}
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		fatal("http port listen failed", err)
	}
	srv := &http.Server{
		Handler:           observability.HTTPMiddleware(logger, reporter, metrics)(web.Handler()),
		ReadHeaderTimeout: 5 * time.Second, // protege contra conexiones lentas (slowloris)
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Apagado ordenado: SIGTERM → ready=false → Shutdown con tope → cerrar admin y trazas.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	done := make(chan struct{})
	go func() {
		defer close(done)
		<-stop
		logger.Info("graceful shutdown started")
		ready.Store(false)
		sctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		_ = srv.Shutdown(sctx)
		_ = adminSrv.Shutdown(sctx)
		_ = shutdownTracing(sctx)
	}()

	logger.Info("service started", "http_addr", addr, "admin_port", adminPort, "app_ready", web.Ready())
	if err := srv.Serve(lis); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fatal("http server failed", err)
	}
	<-done
}
