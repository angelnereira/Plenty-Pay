// Package observability expone el puerto admin del contenedor (observability-standards.md §4).
// Hoy: salud. Las métricas (`/metrics`) llegan en F04.6.
package observability

import (
	"context"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"
)

// NewAdminHandler sirve `/healthz/live` (proceso vivo) y `/healthz/ready` (listo para recibir tráfico).
// `ready` es false durante el arranque y el apagado ordenado.
func NewAdminHandler(ready *atomic.Bool) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz/live", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /healthz/ready", func(w http.ResponseWriter, _ *http.Request) {
		if !ready.Load() {
			http.Error(w, "not ready", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	return mux
}

// NewAdminServer arma el servidor HTTP del puerto admin (nunca se publica fuera de la red interna).
func NewAdminServer(port string, ready *atomic.Bool) *http.Server {
	return &http.Server{
		Addr:              ":" + port,
		Handler:           NewAdminHandler(ready),
		ReadHeaderTimeout: 5 * time.Second,
	}
}

// Healthcheck consulta `/healthz/ready` del propio contenedor. Lo usa el subcomando `healthcheck`,
// porque las imágenes distroless no tienen shell ni curl (delivery-pipeline.md §5.4).
func Healthcheck(ctx context.Context, baseURL string) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/healthz/ready", nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ready devolvió %d", resp.StatusCode)
	}
	return nil
}
