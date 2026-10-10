package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"plentypay/api-gateway/internal/client"
	"plentypay/api-gateway/internal/handlers"
	"plentypay/api-gateway/internal/middleware"
)

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
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	identityTarget := os.Getenv("IDENTITY_SERVICE_URL")
	if identityTarget == "" {
		identityTarget = "identity:50060"
	}
	identity, err := client.NewIdentityClient(identityTarget)
	if err != nil {
		log.Fatalf("no se pudo configurar el cliente de identity (%s): %v", identityTarget, err)
	}
	defer identity.Close()

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           newMux(identity),
		ReadHeaderTimeout: 5 * time.Second, // protege contra conexiones lentas (slowloris)
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("api-gateway escuchando en :%s (identity en %s)", port, identityTarget)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("fallo del servidor HTTP: %v", err)
	}
}
