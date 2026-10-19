package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/nats-io/nats.go"
	"plentypay/api-gateway/internal/client"
	"plentypay/api-gateway/internal/middleware"
	"plentypay/api-gateway/internal/ratelimit"
	"plentypay/api-gateway/internal/handlers"
	"plentypay/api-gateway/internal/metadata"
	"plentypay/api-gateway/internal/openapi"
	"plentypay/api-gateway/internal/observability"
	"plentypay/api-gateway/internal/realtime"
	"plentypay/api-gateway/internal/routes"
)

// version se inyecta en el build (-ldflags "-X main.version=...").
var (
	version = "dev"
	commit  = "none"
)

// Tope del apagado ordenado (go-standards.md §3.10).
const shutdownTimeout = 25 * time.Second

const serviceName = "api-gateway"

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// rutasConHandlerPropio son las que necesitan moldeado especial del request o de
// la respuesta (R2: el registro fuerza CUSTOMER; R2b: fija channel/device). El
// resto de la tabla se sirve con el handler genérico (F09.3).
var rutasConHandlerPropio = map[string]bool{
	"POST /v1/auth/login":    true,
	"POST /v1/auth/register": true,
	"POST /v1/auth/refresh":  true,
	"GET /v1/me":             true,
	"GET /v1/me/permissions": true,
}

func newMux(identity *client.IdentityClient, hub *realtime.Hub) *http.ServeMux {
	h := handlers.NewAuthHandlers(identity)
	auth := middleware.RequireAuth(identity)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	// Públicas con moldeado propio
	mux.HandleFunc("POST /v1/auth/login", h.Login)
	mux.HandleFunc("POST /v1/auth/register", h.Register)
	mux.HandleFunc("POST /v1/auth/refresh", h.Refresh)
	// Protegidas con moldeado propio
	mux.Handle("GET /v1/me", auth(http.HandlerFunc(h.Me)))
	mux.Handle("GET /v1/me/permissions", auth(http.HandlerFunc(h.Permissions)))

	// Tiempo real (F09.5): WebSocket con auth por primer mensaje.
	mux.Handle("GET /v1/realtime", realtime.Handler(hub, wsAuth(identity)))

	// OpenAPI generado de la tabla de rutas (F09.7).
	mux.HandleFunc("GET /v1/openapi.json", openapi.Handler())

	// Resto de la tabla declarativa: una fila = una ruta, sin código por endpoint.
	for _, r := range routes.Table {
		if rutasConHandlerPropio[r.Method+" "+r.Path] {
			continue
		}
		var handler http.Handler = routes.Handler(identity.Conn(), r)
		if r.RequireAuth {
			handler = auth(handler)
		}
		mux.Handle(r.Method+" "+r.Path, handler)
	}

	// Delegación al contenedor `web` para servir la app Flutter Web (bundle estático)
	// en cualquier ruta que no sea de la API (/v1/*) ni de sondas (/healthz).
	webURL := envOr("WEB_SERVICE_URL", "http://web:8081")
	if webURL != "" {
		if u, err := url.Parse(webURL); err == nil {
			proxy := httputil.NewSingleHostReverseProxy(u)
			mux.Handle("/", proxy)
		}
	}

	return mux
}

// wsAuth es la funcion de autenticacion del WebSocket (SPEC §5): el token llega
// en el primer mensaje, nunca en la URL.
func wsAuth(identity *client.IdentityClient) realtime.AuthFunc {
	return func(token string) (string, string, string, error) {
		session, err := identity.ValidateToken(context.Background(), token)
		if err != nil || !session.Valid {
			return "", "", "", errTokenInvalid
		}
		return session.SessionID, session.UserID, session.TenantID, nil
	}
}

var errTokenInvalid = errors.New("token invalido")

func main() {
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

	adminPort := envOr("ADMIN_PORT", "9100")
	// Subcomando para el healthcheck de Compose/Kubernetes (imagen distroless, sin shell ni curl).
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := observability.Healthcheck(context.Background(), "http://127.0.0.1:"+adminPort); err != nil {
			logger.Warn("healthcheck failed", "err", err.Error())
			os.Exit(1)
		}
		return
	}

	port := envOr("PORT", "8080")
	identityTarget := envOr("IDENTITY_SERVICE_URL", "identity:50060")
	shutdownTracing, err := observability.SetupTracing(ctx, serviceName, version, os.Stdout)
	if err != nil {
		fatal("tracing setup failed", err)
	}
	identity, err := client.NewIdentityClient(identityTarget, reporter)
	if err != nil {
		fatal("identity client setup failed", err)
	}
	defer identity.Close()

	// Rate limiter (F09.6): NATS KV compartido entre réplicas; si no hay NATS, memoria (fail-open a nivel de réplica).
	var rl ratelimit.Limiter = ratelimit.NewMemory()
	if natsURL := envOr("PP_NATS_URL", ""); natsURL != "" {
		nc, err := nats.Connect(natsURL, nats.UserInfo(envOr("PP_NATS_USER", ""), envOr("PP_NATS_PASS", "")), nats.Name("api-gateway-ratelimit"))
		if err == nil {
			js, jerr := nc.JetStream()
			if jerr == nil {
				kv, kerr := js.KeyValue("pp_ratelimit")
				if kerr == nil {
					rl = ratelimit.NewNatsKV(kv)
					logger.Info("rate limiter enabled (nats kv)", "bucket", "pp_ratelimit")
				} else {
					logger.Warn("rate limiter: kv bucket unavailable, using memory", "err", kerr.Error())
				}
			} else {
				logger.Warn("rate limiter: jetstream unavailable, using memory", "err", jerr.Error())
			}
		} else {
			logger.Warn("rate limiter: nats unavailable, using memory", "err", err.Error())
		}
	}

	// ready = el gateway atiende. No depende de identity: si identity cae, el gateway sigue arriba
	// y responde según la matriz de degradación (service-dependencies.md §6).
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
		fatal("http port listen failed", err)
	}
	// Tiempo real (F09.5): hub de conexiones WebSocket.
	hub := realtime.NewHub()

	// Consumidor de SessionRevoked (R10): cierra los WebSockets de esas sesiones.
	if natsURL := envOr("PP_NATS_URL", ""); natsURL != "" {
		c, err := realtime.NewSessionRevokedConsumer(ctx, hub, natsURL,
			envOr("PP_NATS_USER", ""), envOr("PP_NATS_PASS", ""))
		if err != nil {
			logger.Warn("realtime consumer disabled", "err", err.Error())
		} else {
			defer c.Close()
			logger.Info("realtime consumer enabled", "url", natsURL)
		}
	}

	srv := &http.Server{
		// R5: las x-pp-* del cliente se descartan en el borde, antes de cualquier handler.
		Handler:           metadata.StripInboundMiddleware(observability.HTTPMiddleware(logger, reporter, metrics)(middleware.RateLimitMiddleware(rl)(newMux(identity, hub)))),
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
		logger.Info("graceful shutdown started")
		ready.Store(false)
		sctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		_ = srv.Shutdown(sctx)
		_ = adminSrv.Shutdown(sctx)
		_ = shutdownTracing(sctx) // vacía los spans pendientes antes de salir
	}()

	ready.Store(true)
	logger.Info("service started", "port", port, "admin_port", adminPort, "identity_target", identityTarget)
	if err := srv.Serve(lis); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fatal("http server failed", err)
	}
	<-done
}
