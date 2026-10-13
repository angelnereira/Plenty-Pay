// Package server sirve el bundle de Flutter Web y los archivos estáticos del contenedor
// (web/SPEC.md §3: cabeceras R1, páginas sin datos personales R2, mantenimiento R4,
// plantillas con escape automático R5).
package server

import (
	"html/template"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"plentypay/web/internal/config"
	"plentypay/web/internal/observability"
)

// Server es el servidor estático del contenedor web.
type Server struct {
	cfg      config.Config
	reporter *observability.Reporter
	page     *template.Template
	hasIndex bool
}

// New arma el servidor. Si el bundle no está presente, `hasIndex` queda en false y todas las
// rutas responden la página de mantenimiento (R4), no un 500.
func New(cfg config.Config, reporter *observability.Reporter) *Server {
	_, err := os.Stat(filepath.Join(cfg.AppDir, "index.html"))
	return &Server{
		cfg:      cfg,
		reporter: reporter,
		page:     maintenancePage(),
		hasIndex: err == nil,
	}
}

// Handler construye el mux público. `/healthz` sirve para las sondas del balanceador.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.Handle("/", s.withSecurityHeaders(http.HandlerFunc(s.serveApp)))
	return mux
}

// Ready indica si el contenedor puede cumplir su función: sin bundle solo sabe decir
// "en mantenimiento", así que no está listo para recibir tráfico de la app.
func (s *Server) Ready() bool { return s.hasIndex }

// withSecurityHeaders aplica R1: CSP estricta, HSTS, anti-clickjacking y sniffing.
// La CSP se calcula por petición porque `connect-src` depende del origen del gateway.
func (s *Server) withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self'; "+
				"style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data:; "+
				"font-src 'self' data:; "+
				"connect-src 'self' "+s.cfg.GatewayPublicURL+"; "+
				"worker-src 'self'; manifest-src 'self'; "+
				"base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()")
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		next.ServeHTTP(w, r)
	})
}

// cachePolicy decide la caché según el archivo (R1): los assets de Flutter llevan hash de
// contenido y pueden cachearse para siempre; lo que cambia en cada despliegue, no.
func cachePolicy(p string) string {
	switch {
	// Los assets de Flutter van con hash de contenido: se cachean para siempre. Se comprueba
	// el prefijo ANTES de la extensión porque `canvaskit/canvaskit.js` también acaba en .js.
	case strings.HasPrefix(p, "/canvaskit/"), strings.HasPrefix(p, "/assets/"),
		strings.HasPrefix(p, "/icons/"), strings.HasPrefix(p, "/fonts/"):
		return "public, max-age=31536000, immutable"
	case strings.HasSuffix(p, "/"), strings.HasSuffix(p, ".html"),
		strings.HasSuffix(p, ".js"), p == "/version.json", p == "/manifest.json":
		return "no-cache"
	}
	return "public, max-age=3600"
}

// serveApp entrega el bundle. Una ruta sin extensión que no exista cae en `index.html`
// (la app es una SPA: sus rutas, como /register, las resuelve Flutter).
func (s *Server) serveApp(w http.ResponseWriter, r *http.Request) {
	if !s.hasIndex {
		s.maintenance(w, r)
		return
	}
	root := filepath.Clean(s.cfg.AppDir)
	// `path.Clean` sobre una ruta que empieza por "/" elimina cualquier "..": el resultado no
	// puede salir del bundle. La comprobación siguiente es la segunda barrera.
	clean := path.Clean("/" + r.URL.Path)
	file := filepath.Join(root, filepath.FromSlash(clean))
	if file != root && !strings.HasPrefix(file, root+string(os.PathSeparator)) {
		observability.WriteProblem(w, http.StatusBadRequest, "INVALID_PATH", "ruta inválida")
		return
	}
	// La política de caché es por ruta, así que se fija también en los 404.
	w.Header().Set("Cache-Control", cachePolicy(clean))
	info, err := os.Stat(file)
	if err != nil || info.IsDir() {
		// Ruta sin extensión: es una ruta de la SPA. **Solo para GET/HEAD**: responder HTML a un
		// POST (p. ej. un /v1/auth/* que la app envió al contenedor equivocado) ocultaría el fallo.
		if path.Ext(clean) == "" && (r.Method == http.MethodGet || r.Method == http.MethodHead) {
			file = filepath.Join(root, "index.html")
		} else {
			observability.WriteProblem(w, http.StatusNotFound, "NOT_FOUND", "no encontrado")
			return
		}
	}
	http.ServeFile(w, r, file)
}

// maintenance responde R4: una página clara, sin datos personales ni detalles internos.
func (s *Server) maintenance(w http.ResponseWriter, r *http.Request) {
	s.reporter.Dependency(r.Context(), "flutter web bundle missing", "build", errNoBundle,
		slogString("http.route", r.Pattern))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusServiceUnavailable)
	_ = s.page.Execute(w, "PlentyPay")
}
