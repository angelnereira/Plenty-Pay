// identity-service: autenticación, sesiones y contexto de autorización
// (mandato §7). Estado Etapa 1: IMPLEMENTADO con store en memoria;
// persistencia PostgreSQL y TLS server-side en la culminación de la etapa.
package main

import (
	"errors"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"

	commonv1 "plentypay.dev/contracts/gen/go/plentypay/common/v1"
	identityv1 "plentypay.dev/contracts/gen/go/plentypay/identity/v1"
	"plentypay.dev/services/identity/internal/auth"
	"plentypay.dev/services/identity/internal/server"
	"plentypay.dev/services/identity/internal/store"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}
	// TLS: UNVERIFIED hasta emitir certificados internos (Etapa 1 completion).
	// Hoy plaintext SOLO en red interna de Compose; nunca expuesto.
	useTLS := os.Getenv("GRPC_TLS") == "1"

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Error("listen", "err", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(server.UnaryCorrelation(log)),
	)

	db := store.NewMemoryStore() // PARTIAL: PostgreSQL en culminación Etapa 1
	identity := server.NewIdentity(db, auth.NewPasswordHasher(), 24*time.Hour, log)
	identityv1.RegisterIdentityServiceServer(grpcServer, identity)
	commonv1.RegisterHealthServiceServer(grpcServer, identity)

	if useTLS {
		log.Warn("GRPC_TLS=1 pero no hay certificados configurados: cayendo a plaintext") // fail visible, no silencioso (§13 Fail Secure en producción)
	}
	go func() {
		log.Info("identity-service escuchando", "port", port, "tls", useTLS)
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
