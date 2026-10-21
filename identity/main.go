package main

import (
	"context"
	"embed"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/client"
	"plentypay/identity/internal/config"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/events"
	"plentypay/identity/internal/migrate"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/server"
	"plentypay/identity/internal/store"
)

// Migraciones SQL embebidas en el binario (go:embed no admite rutas con ..).
// Las aplica el Job migrate-identity (data-standards.md seccion 5).
//
//go:embed all:migrations
var migrationsFS embed.FS

// version se inyecta en el build (-ldflags "-X main.version=...").
var (
	version = "dev"
	commit  = "none"
)

// Tope del apagado ordenado (go-standards.md §3.10).
const shutdownTimeout = 25 * time.Second

const serviceName = "identity"

// dsnHost extrae solo host:puerto del DSN para el log: nunca se registran
// credenciales (observability-standards.md seccion 16).
func dsnHost(dsn string) string {
	u, err := url.Parse(dsn)
	if err != nil {
		return "desconocido"
	}
	return u.Host
}

func main() {
	cfg, cfgErr := config.Load()
	logger := observability.NewLogger(os.Stdout, serviceName, version, observability.ParseLevel(os.Getenv("LOG_LEVEL")))
	slog.SetDefault(logger)
	metrics := observability.NewMetrics(serviceName, version, commit)
	reporter := observability.NewReporter(logger, serviceName, metrics)
	ctx := context.Background()
	// fatal registra el fallo de arranque con su pila y termina: sin esto el proceso no puede servir.
	fatal := func(msg string, err error) {
		reporter.Defect(ctx, msg, observability.Wrap(err, "startup"))
		os.Exit(1)
	}

	if cfgErr != nil {
		logger.Error("invalid configuration", "err", cfgErr.Error())
		os.Exit(1)
	}
	adminPort := cfg.AdminPort
	// Subcomando para el healthcheck de Compose/Kubernetes (imagen distroless, sin shell ni curl).
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := observability.Healthcheck(context.Background(), "http://127.0.0.1:"+adminPort); err != nil {
			logger.Warn("healthcheck failed", "err", err.Error())
			os.Exit(1)
		}
		return
	}

	// Subcomando `migrate`: aplica las migraciones versionadas y termina.
	// Lo ejecuta el Job migrate-identity antes del despliegue (F08.2).
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		dsn := os.Getenv("PP_MIGRATE_DSN")
		if dsn == "" {
			dsn = os.Getenv("PP_DB_DSN")
		}
		if dsn == "" {
			logger.Error("migrate requires PP_MIGRATE_DSN or PP_DB_DSN")
			os.Exit(1)
		}
		res, err := migrate.Up(ctx, dsn, migrationsFS)
		if err != nil {
			logger.Error("migrate failed", "err", err.Error(), "version", res.Version, "dirty", res.Dirty)
			os.Exit(1)
		}
		logger.Info("migrate done", "version", res.Version, "applied", res.Applied, "dirty", res.Dirty)
		return
	}

	port := cfg.Port
	tokens, err := auth.NewTokenIssuer(cfg.AccessSecret, cfg.RefreshSecret)
	if err != nil {
		fatal("invalid token configuration", err)
	}

	// F08.2: con PP_DB_DSN se usa el store sobre postgres-db; sin el, memoria
	// (pruebas unitarias y el E2E sin base de datos). La interfaz no cambia.
	var (
		users     store.UserStore
		sessions  store.SessionStore
		attempts  store.LoginAttemptStore
		tenants   store.TenantStore
		roles     store.RoleStore
		passwords store.PasswordStore
		idem      store.IdempotencyStore
		strong    store.StrongAuthStore
	)
	if dsn := cfg.DBDSN; dsn != "" {
		pgStore, err := store.NewPostgresUserStore(ctx, dsn)
		if err != nil {
			fatal("postgres store failed", err)
		}
		defer pgStore.Close()
		users = pgStore
		sessions = store.NewPostgresSessionStore(pgStore.Pool())
		attempts = store.NewPostgresLoginAttemptStore(pgStore.Pool())
		tenants = store.NewPostgresTenantStore(pgStore.Pool())
		roles = store.NewPostgresRoleStore(pgStore.Pool())
		passwords = store.NewPostgresPasswordStore(pgStore.Pool())
		idem = store.NewPostgresIdempotencyStore(pgStore.Pool())
		strong = store.NewPostgresStrongAuthStore(pgStore.Pool())
		logger.Info("using postgres user store with sessions and lockout", "dsn_host", dsnHost(dsn))
	} else {
		users = store.NewInMemoryUserStore()
		idem = store.NewInMemoryIdempotencyStore()
		logger.Info("using in-memory user store without sessions or lockout (PP_DB_DSN no definido)")
	}

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
	enforceMTLS := cfg.MTLSEnforced
	grpcServer := grpc.NewServer(grpc.ChainUnaryInterceptor(
		observability.UnaryServerInterceptor(logger, reporter, metrics),
		server.SPIFFEServerInterceptor(enforceMTLS, server.AllowedIdentityCallers),
		// Mutaciones reintentables (grpc-conventions.md §3, AGENTS.md §2.8).
		server.IdempotencyInterceptor(idem, reporter),
	))
	// Purga de claves de idempotencia de más de 72 h (data-standards.md §6).
	purgeCtx, cancelPurge := context.WithCancel(context.Background())
	defer cancelPurge()
	go purgeIdempotencyKeys(purgeCtx, idem, reporter)
	identitySrv := server.NewIdentityServer(users, tokens, reporter, metrics)
	if sessions != nil {
		identitySrv = identitySrv.WithSessions(sessions)
		logger.Info("refresh rotation enabled (R8/R9)")
	}
	if attempts != nil {
		identitySrv = identitySrv.WithLockout(attempts)
		logger.Info("progressive lockout enabled (R5)")
	}
	if tenants != nil {
		identitySrv = identitySrv.WithTenants(tenants)
		logger.Info("tenants enabled (F08.5)")
	}
	if roles != nil {
		identitySrv = identitySrv.WithRoles(roles)
		logger.Info("roles and invitations enabled (F08.6)")
	}
	if passwords != nil {
		identitySrv = identitySrv.WithPasswords(passwords)
		logger.Info("password recovery enabled (F08.7)")
	}
	pinPolicy := domain.PinPolicy{MaxAttempts: cfg.PinMaxAttempts, LockFor: time.Duration(cfg.PinLockMinutes) * time.Minute}
	if strong != nil {
		// R32: retos, tokens y PIN en PostgreSQL; sin BD quedan en memoria (pruebas y E2E).
		identitySrv = identitySrv.WithStrongAuth(strong, pinPolicy)
		logger.Info("strong authentication persisted (R32)", "pin_max_attempts", pinPolicy.MaxAttempts, "pin_lock_minutes", cfg.PinLockMinutes)
	}
	go purgeStepUp(purgeCtx, identitySrv, reporter)
	// Relay del outbox (ADR 0012): publica TenantStatusChanged en JetStream.
	var relay *events.Relay
	if tenants != nil && cfg.NATSUrl != "" {
		r, err := events.NewRelay(ctx, tenants, cfg.NATSUrl, cfg.NATSUser, cfg.NATSPass, logger, metrics)
		if err != nil {
			logger.Warn("outbox relay disabled", "err", err.Error())
		} else {
			relay = r
			relayCtx, cancelRelay := context.WithCancel(context.Background())
			defer cancelRelay()
			go func() {
				if err := relay.Run(relayCtx); err != nil {
					logger.Error("outbox relay stopped", "err", err.Error())
				}
			}()
			logger.Info("outbox relay enabled", "url", cfg.NATSUrl)
		}
	}
	if cfg.SecurityAddr != "" {
		sec, err := client.NewSecurityReporter(cfg.SecurityAddr, cfg.SecurityInsecure)
		if err != nil {
			fatal("security client failed", err)
		}
		defer sec.Close()
		identitySrv = identitySrv.WithSecurityReporter(sec)
		logger.Info("reporting token reuse to security", "addr", cfg.SecurityAddr)
	}
	pb.RegisterIdentityServer(grpcServer, identitySrv)
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
		if relay != nil {
			relay.Close()
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

// purgeStepUp borra cada hora los retos y tokens de confirmación fuerte vencidos.
func purgeStepUp(ctx context.Context, srv *server.IdentityServer, reporter *observability.Reporter) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := srv.PurgeStepUp(ctx); err != nil {
				reporter.Dependency(ctx, "step-up purge failed", "postgres-db", observability.Wrap(err, "purge step-up"))
			}
		}
	}
}

// purgeIdempotencyKeys borra cada hora las claves de idempotencia vencidas. Un fallo se registra
// como dependencia y se reintenta en la siguiente vuelta.
func purgeIdempotencyKeys(ctx context.Context, st store.IdempotencyStore, reporter *observability.Reporter) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := st.Purge(ctx, time.Now().UTC().Add(-store.IdempotencyTTL)); err != nil {
				reporter.Dependency(ctx, "idempotency purge failed", "postgres-db", observability.Wrap(err, "purge idempotency keys"))
			}
		}
	}
}
