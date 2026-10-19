package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const validFingerprint = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"

// F22.3: con huellas configuradas, Android recibe un `assetlinks.json` válido y la
// app se abre en vez del navegador.
func TestF22_3_AssetLinksPublishedWithFingerprints(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	s.fingerprints.AndroidFingerprints = validFingerprint

	rec := get(t, s, "/.well-known/assetlinks.json")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("unexpected content type %q", ct)
	}

	var links []wellKnownAssetLink
	if err := json.Unmarshal(rec.Body.Bytes(), &links); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if len(links) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(links))
	}
	if links[0].Target.PackageName != androidPackage {
		t.Fatalf("unexpected package %q", links[0].Target.PackageName)
	}
	if len(links[0].Target.Sha256Certs) != 1 || links[0].Target.Sha256Certs[0] != validFingerprint {
		t.Fatalf("unexpected fingerprints %v", links[0].Target.Sha256Certs)
	}
	if links[0].Relation[0] != "delegate_permission/common.handle_all_urls" {
		t.Fatalf("unexpected relation %v", links[0].Relation)
	}
}

// F22.3: varias huellas separadas por coma se publican todas (canales interno, beta y release).
func TestF22_3_MultipleFingerprints(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	s.fingerprints.AndroidFingerprints = strings.ToLower(validFingerprint) + ",ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789"

	rec := get(t, s, "/.well-known/assetlinks.json")
	var links []wellKnownAssetLink
	if err := json.Unmarshal(rec.Body.Bytes(), &links); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if len(links[0].Target.Sha256Certs) != 2 {
		t.Fatalf("expected 2 fingerprints, got %v", links[0].Target.Sha256Certs)
	}
	// Se normalizan a mayúsculas: el dispositivo compara así.
	if links[0].Target.Sha256Certs[0] != validFingerprint {
		t.Fatalf("expected uppercase normalization, got %s", links[0].Target.Sha256Certs[0])
	}
}

// F22.3: sin huellas configuradas se responde 404, nunca un archivo vacío que
// haga fallar la verificación del dominio en el dispositivo.
func TestF22_3_NoFingerprintsIs404NotEmptyFile(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	s.fingerprints.AndroidFingerprints = ""

	rec := get(t, s, "/.well-known/assetlinks.json")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "sha256_cert_fingerprints") {
		t.Fatal("must not publish an empty assetlinks file")
	}
}

// Una huella mal formada se descarta antes de publicar: si llegara al dispositivo,
// Android rechazaría la app entera.
func TestF22_3_MalformedFingerprintIsDiscarded(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	s.fingerprints.AndroidFingerprints = "NOESUNAHEX" + "," + validFingerprint

	rec := get(t, s, "/.well-known/assetlinks.json")
	var links []wellKnownAssetLink
	if err := json.Unmarshal(rec.Body.Bytes(), &links); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if len(links[0].Target.Sha256Certs) != 1 {
		t.Fatalf("expected the malformed fingerprint to be dropped, got %v", links[0].Target.Sha256Certs)
	}
}

// Si todas las huellas son inválidas, tampoco se publica un archivo inútil.
func TestF22_3_AllFingerprintsInvalidIs404(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	s.fingerprints.AndroidFingerprints = "CORTA"

	if rec := get(t, s, "/.well-known/assetlinks.json"); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

// F22.3: la asociación de iOS es un objeto con el Team ID y las rutas de la app.
func TestF22_3_AppleAssociationIsAnObject(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	s.fingerprints.AppleTeamID = "ABCDE12345"
	s.fingerprints.AppleBundleID = appleBundleID

	rec := get(t, s, "/.well-known/apple-app-site-association")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var assoc appleSiteAssociation
	if err := json.Unmarshal(rec.Body.Bytes(), &assoc); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if assoc.AppID != "ABCDE12345."+appleBundleID {
		t.Fatalf("unexpected appID %q", assoc.AppID)
	}
	// iOS exige las cuatro rutas que la app sabe abrir.
	for _, want := range []string{"/t/*", "/track/*", "/invite/*", "/reset/*"} {
		found := false
		for _, p := range assoc.Paths {
			if p == want {
				found = true
			}
		}
		if !found {
			t.Fatalf("missing path %s in %v", want, assoc.Paths)
		}
	}
}

// iOS rechaza un array: el archivo debe ser un objeto.
func TestF22_3_AppleAssociationIsNotAnArray(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	s.fingerprints.AppleTeamID = "ABCDE12345"

	rec := get(t, s, "/.well-known/apple-app-site-association")
	if strings.HasPrefix(strings.TrimSpace(rec.Body.String()), "[") {
		t.Fatal("iOS association file must be an object, not an array")
	}
}

func TestF22_3_AppleAssociationWithoutTeamIDIs404(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	s.fingerprints.AppleTeamID = "  "

	if rec := get(t, s, "/.well-known/apple-app-site-association"); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

// R1: los archivos de `.well-known` también llevan las cabeceras de seguridad.
func TestF22_3_WellKnownCarriesSecurityHeaders(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	s.fingerprints.AndroidFingerprints = validFingerprint

	rec := get(t, s, "/.well-known/assetlinks.json")
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("missing nosniff header")
	}
	if rec.Header().Get("Content-Security-Policy") == "" {
		t.Fatal("missing CSP header")
	}
	if rec.Header().Get("Strict-Transport-Security") == "" {
		t.Fatal("missing HSTS header")
	}
}

// Un archivo inexistente dentro de `.well-known` no cae al fallback de la SPA:
// devolver `index.html` haría que Android intente analizar HTML como JSON.
func TestF22_3_UnknownWellKnownPathIsNotSpaHtml(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))

	rec := get(t, s, "/.well-known/no-existe.json")
	if strings.Contains(rec.Body.String(), "<!DOCTYPE html>") {
		t.Fatal("unknown .well-known path must not return the SPA HTML")
	}
}

// `GET` es el único método: un `POST` a `.well-known` es 405, no la SPA.
func TestF22_3_PostToWellKnownIsRejected(t *testing.T) {
	s := newServer(t, bundleDePrueba(t))
	req := httptest.NewRequest(http.MethodPost, "/.well-known/assetlinks.json", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	if rec.Code == http.StatusOK {
		t.Fatal("POST to .well-known must not return 200")
	}
}

// Un bundle ausente (mantenimiento, R4) no debe cambiar la respuesta de `.well-known`:
// la verificación de dominio depende de estos archivos, no del bundle de la app.
func TestF22_3_WellKnownWorksWithoutBundle(t *testing.T) {
	s := newServer(t, t.TempDir())
	s.fingerprints.AndroidFingerprints = validFingerprint

	if s.Ready() {
		t.Fatal("server without bundle must not be ready")
	}
	if rec := get(t, s, "/.well-known/assetlinks.json"); rec.Code != http.StatusOK {
		t.Fatalf("expected 200 even without bundle, got %d", rec.Code)
	}
}
