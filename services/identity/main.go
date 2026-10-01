// identity-service: autenticación, sesiones y contexto de autorización
// (mandato §7). Estado Etapa 1: PostgreSQL como store (fail secure:
// sin DATABASE_URL el servicio no arranca). TLS server-side: TODO.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/grpc"

	commonv1 "plentypay.dev/contracts/gen/go/plentypay/common/v1"
	identityv1 "plentypay.dev/contracts/gen/go/plentypay/identity/v1"
	"plentypay.dev/services/identity/internal/auth"
	"plentypay.dev/services/identity/internal/migrate"
	"plentypay.dev/services/identity/internal/server"
	"plentypay.dev/services/identity/internal/store"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)
	ctx := context.Background()

	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}
	// TLS: UNVERIFIED hasta emitir certificados internos (hitos Fase 1-5).
	// Plaintext SOLO dentro de la red interna de Compose; nunca expuesto.
	useTLS := os.Getenv("GRPC_TLS") == "1"

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Fail secure (mandato §13/§29): identidad SIN su base de datos no
		// puede garantizar sesiones durables ni auditoría — no arranca.
		log.Error("DATABASE_URL requerido: el servicio no arranca sin su base de datos")
		os.Exit(1)
	}

	// Arranque resiliente: PG puede estar en ventana de recuperación
	// (SQLSTATE 57P03) aunque el healthcheck ya pasó. Reintento con backoff
	// hasta 60s; pasado eso, fail secure (no arrancar en estado dudoso).
	var pool *pgxpool.Pool
	var err error
	deadline := time.Now().Add(60 * time.Second)
	for {
		pool, err = pgxpool.New(ctx, dsn)
		if err == nil {
			var pingErr error
			if pingErr = pool.Ping(ctx); pingErr == nil {
				break
			}
			log.Warn("ping a PostgreSQL", "err", pingErr)
			pool.Close()
		} else {
			log.Warn("conexión a PostgreSQL", "err", err)
		}
		if time.Now().After(deadline) {
			log.Error("PostgreSQL no disponible tras 60s: fail secure, no arranco")
			os.Exit(1)
		}
		time.Sleep(2 * time.Second)
	}
	defer pool.Close()

	applied, err := migrate.Up(ctx, pool)
	if err != nil {
		log.Error("migraciones", "err", err)
		os.Exit(1)
	}
	if len(applied) > 0 {
		log.Info("migraciones aplicadas", "count", len(applied), "migraciones", applied)
	}

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Error("listen", "err", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(server.UnaryCorrelation(log)),
	)

	identity := server.NewIdentity(server.Options{
		DB:       store.NewPostgresStore(pool),
		Sessions: store.NewPostgresSessions(pool, 24*time.Hour),
		Auditor:  store.NewPostgresAuditor(pool, log),
		Hasher:   auth.NewPasswordHasher(),
		Log:      log,
	})
	identityv1.RegisterIdentityServiceServer(grpcServer, identity)
	commonv1.RegisterHealthServiceServer(grpcServer, identity)

	if useTLS {
		log.Warn("GRPC_TLS=1 pero no hay certificados configurados: cayendo a plaintext") // fail visible, no silencioso
	}

	go func() {
		log.Info("identity-service escuchando", "port", port, "tls", useTLS, "db", "postgres")
		if err := grpcServer.Serve(lis); err != nil && !errors.Is(err, grpc.ErrServerStopped) {
			log.Error("serve", "err", err)
			os.Exit(1)
		}
	}()

	// Shutdown ordenado (production-ready: mandato §29).
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Info("señal de parada: cerrando con gracia")
	done := make(chan struct{})
	go func() {
		grpcServer.GracefulStop()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		grpcServer.Stop()
	}
	log.Info("parado")
}
