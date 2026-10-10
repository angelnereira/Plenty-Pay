package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"plentypay/api-gateway/internal/client"
	"plentypay/api-gateway/internal/handlers"
	"plentypay/api-gateway/internal/middleware"
	"plentypay/api-gateway/internal/observability"
)

// version se inyecta en el build (-ldflags "-X main.version=...").
var version = "dev"

// Tope del apagado ordenado (go-standards.md §3.10).
const shutdownTimeout = 25 * time.Second

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func newMux(identity *client.IdentityClient) *http.ServeMux {
	h := handlers.NewAuthHandlers(identity)
	auth := middleware.RequireAuth(identity)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	// Públicas
	mux.HandleFunc("POST /v1/auth/login", h.Login)
	mux.HandleFunc("POST /v1/auth/register", h.Register)
	mux.HandleFunc("POST /v1/auth/refresh", h.Refresh)
	// Protegidas: toda ruta nueva se envuelve con `auth` (catálogo completo en api-gateway/SPEC.md §4)
	mux.Handle("GET /v1/me", auth(http.HandlerFunc(h.Me)))
	mux.Handle("GET /v1/me/permissions", auth(http.HandlerFunc(h.Permissions)))
	return mux
}

func main() {
	adminPort := envOr("ADMIN_PORT", "9100")
	// Subcomando para el healthcheck de Compose/Kubernetes (imagen distroless, sin shell ni curl).
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := observability.Healthcheck(context.Background(), "http://127.0.0.1:"+adminPort); err != nil {
			log.Printf("healthcheck: %v", err)
			os.Exit(1)
		}
		return
	}

	port := envOr("PORT", "8080")
	identityTarget := envOr("IDENTITY_SERVICE_URL", "identity:50060")
	identity, err := client.NewIdentityClient(identityTarget)
	if err != nil {
		log.Fatalf("no se pudo configurar el cliente de identity (%s): %v", identityTarget, err)
	}
	defer identity.Close()

	// ready = el gateway atiende. No depende de identity: si identity cae, el gateway sigue arriba
	// y responde según la matriz de degradación (service-dependencies.md §6).
	var ready atomic.Bool
	adminLis, err := net.Listen("tcp", ":"+adminPort)
	if err != nil {
		log.Fatalf("no se pudo escuchar en el puerto admin :%s: %v", adminPort, err)
	}
	adminSrv := observability.NewAdminServer(adminPort, &ready)
	go func() {
		if err := adminSrv.Serve(adminLis); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("fallo del servidor admin: %v", err)
		}
	}()

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("no se pudo escuchar en :%s: %v", port, err)
	}
	srv := &http.Server{
		Handler:           newMux(identity),
		ReadHeaderTimeout: 5 * time.Second, // protege contra conexiones lentas (slowloris)
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Apagado ordenado: SIGTERM → ready=false → Shutdown con tope → cerrar admin.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	done := make(chan struct{})
	go func() {
		defer close(done)
		<-stop
		log.Print("api-gateway: apagado ordenado")
		ready.Store(false)
		ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		_ = srv.Shutdown(ctx)
		_ = adminSrv.Shutdown(ctx)
	}()

	ready.Store(true)
	log.Printf("api-gateway %s escuchando en :%s (admin :%s, identity en %s)", version, port, adminPort, identityTarget)
	if err := srv.Serve(lis); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("fallo del servidor HTTP: %v", err)
	}
	<-done
}
