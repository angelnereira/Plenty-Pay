package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"plentypay/web/internal/config"
	"plentypay/web/internal/observability"
)

// bundleDePrueba deja en un directorio temporal lo mínimo de un build de Flutter Web.
func bundleDePrueba(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	for path, content := range map[string]string{
		"index.html":               "<!DOCTYPE html><title>PlentyPay</title>",
		"main.dart.js":             "// bundle",
		"flutter_bootstrap.js":     "// bootstrap",
		"canvaskit/canvaskit.js":   "// canvaskit",
		"assets/FontManifest.json": "{}",
	} {
		full := filepath.Join(dir, filepath.FromSlash(path))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatalf("MkdirAll: %v", err)
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			t.Fatalf("WriteFile: %v", err)
		}
	}
	return dir
}

func newServer(t *testing.T, appDir string) *Server {
	t.Helper()
	cfg := config.Config{AppDir: appDir, GatewayPublicURL: "https://api.plentypay.app"}
	return New(cfg, observability.NewReporter(observability.NewLogger(os.Stdout, "web", "test", observability.ParseLevel("error")), "web", nil))
}

func get(t *testing.T, s *Server, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

// R1: la CSP es estricta y solo permite conectarse al origen del gateway.
func TestR1_SecurityHeadersOnEveryResponse(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	rec := get(t, s, "/")
	csp := rec.Header().Get("Content-Security-Policy")
	for _, want := range []string{
		"default-src 'self'", "script-src 'self'", "frame-ancestors 'none'",
		"connect-src 'self' https://api.plentypay.app",
	} {
		if !strings.Contains(csp, want) {
			t.Fatalf("la CSP debe contener %q: %q", want, csp)
		}
	}
	if strings.Contains(csp, "*") {
		t.Fatalf("la CSP no admite comodines: %q", csp)
	}
	if rec.Header().Get("X-Frame-Options") != "DENY" || rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("faltan X-Frame-Options: DENY o X-Content-Type-Options: nosniff")
	}
	if !strings.Contains(rec.Header().Get("Strict-Transport-Security"), "max-age=31536000") {
		t.Fatal("falta HSTS")
	}
}

// R1: `index.html` no se cachea (cambia en cada despliegue); los assets con hash, sí.
func TestR1_CachePolicy(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	for path, want := range map[string]string{
		"/":                         "no-cache",
		"/main.dart.js":             "no-cache",
		"/canvaskit/canvaskit.js":   "public, max-age=31536000, immutable",
		"/assets/FontManifest.json": "public, max-age=31536000, immutable",
		"/favicon.png":              "public, max-age=3600",
	} {
		rec := get(t, s, path)
		if got := rec.Header().Get("Cache-Control"); got != want {
			t.Fatalf("%s: Cache-Control = %q, esperaba %q", path, got, want)
		}
	}
}

// La app es una SPA: una ruta sin extensión devuelve index.html con 200.
func TestSpaFallbackServesIndexHtml(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	rec := get(t, s, "/register")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "<title>PlentyPay</title>") {
		t.Fatalf("/register debe servir index.html: %d %s", rec.Code, rec.Body.String())
	}
}

func TestMissingAssetIs404AndTraversalIsRejected(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	if rec := get(t, s, "/main.dart.js.map"); rec.Code != http.StatusNotFound {
		t.Fatalf("un asset inexistente debe ser 404, obtuve %d", rec.Code)
	}
	for _, p := range []string{"/../go.mod", "/..%2fgo.mod", "/static/../main.go"} {
		if rec := get(t, s, p); rec.Code == http.StatusOK {
			t.Fatalf("%s no debe servir archivos fuera del bundle: %d", p, rec.Code)
		}
	}
}

// R4: sin bundle, la respuesta es una página de mantenimiento clara (no 500 ni stack).
func TestR4_MissingBundleServesMaintenancePage(t *testing.T) {
	s := newServer(t, filepath.Join(t.TempDir(), "inexistente"))
	if s.Ready() {
		t.Fatal("sin bundle el contenedor no puede estar listo")
	}
	rec := get(t, s, "/")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("esperaba 503, obtuve %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Estamos preparando la app") {
		t.Fatalf("la página de mantenimiento no es clara: %s", rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "/") == false {
		t.Fatal("la página debe ser HTML completo")
	}
	// La CSP también aplica en mantenimiento.
	if rec.Header().Get("Content-Security-Policy") == "" {
		t.Fatal("la página de mantenimiento debe llevar la CSP")
	}
}

func TestHealthzIsPublicAndDoesNotRequireBundle(t *testing.T) {
	s := newServer(t, filepath.Join(t.TempDir(), "inexistente"))
	if rec := get(t, s, "/healthz"); rec.Code != http.StatusOK {
		t.Fatalf("/healthz debe responder 200 para las sondas, obtuve %d", rec.Code)
	}
}
