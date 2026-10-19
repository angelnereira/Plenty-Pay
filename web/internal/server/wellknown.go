package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// F22.3 · Archivos de verificación de deep links (App Links / Universal Links).
//
// Android exige `/.well-known/assetlinks.json` con las huellas SHA-256 del
// certificado de firma; iOS, `/.well-known/apple-app-site-association` con el
// Team ID y el bundle id. Sin estos archivos el sistema abre el navegador en vez
// de la app, que es exactamente lo que el paso debe evitar.
//
// Los valores vienen del entorno (`ANDROID_APP_FINGERPRINTS`, `APPLE_TEAM_ID`):
// el fingerprint de firma es un identificador público, pero no se hardcodea porque
// cambia por canal y por versión (`internal/beta`, `release`).

type wellKnownAssetLink struct {
	Relation []string        `json:"relation"`
	Target   wellKnownTarget `json:"target"`
}

type wellKnownTarget struct {
	PackageName string   `json:"package_name"`
	Sha256Certs []string `json:"sha256_cert_fingerprints"`
}

type appleSiteAssociation struct {
	AppID string   `json:"appID"`
	Paths []string `json:"paths"`
}

// androidPackage es el id del paquete Android firmado.
const androidPackage = "app.plentypay.mobile"

// appleBundleID es el bundle id de iOS.
const appleBundleID = "app.plentypay.mobile"

// deepLinkPaths son las rutas que la app abre (F22.3). Coinciden con el analizador
// del cliente (`flutter_app/lib/core/sync/deep_links.dart`).
var deepLinkPaths = []string{
	"/t/*",
	"/track/*",
	"/invite/*",
	"/reset/*",
}

// wellKnownHandler sirve los dos archivos de `.well-known`.
//
// Si el entorno no trae las huellas, responde 404 con una página de mantenimiento
// clara en vez de un `assetlinks.json` vacío: un archivo vacío haría que Android
// verifique el dominio y rechace la app, que es peor que no publicarlo.
func (s *Server) wellKnownHandler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /.well-known/assetlinks.json", func(w http.ResponseWriter, r *http.Request) {
		fingerprints := s.androidFingerprints(r)
		if len(fingerprints) == 0 {
			s.notConfigured(w, "assetlinks.json")
			return
		}
		writeJSON(w, []wellKnownAssetLink{{
			Relation: []string{"delegate_permission/common.handle_all_urls"},
			Target: wellKnownTarget{
				PackageName: androidPackage,
				Sha256Certs: fingerprints,
			},
		}})
	})

	mux.HandleFunc("GET /.well-known/apple-app-site-association", func(w http.ResponseWriter, r *http.Request) {
		teamID := strings.TrimSpace(s.fingerprints.AppleTeamID)
		if teamID == "" {
			s.notConfigured(w, "apple-app-site-association")
			return
		}
		// iOS no acepta `Content-Type: application/json` con lista: la association file
		// es un objeto, no un array.
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(appleSiteAssociation{
			AppID: teamID + "." + s.appleBundleID(),
			Paths: deepLinkPaths,
		}); err != nil {
			// Fallo de escritura de la respuesta: se registra una sola vez, en el borde.
			s.reporter.Defect(r.Context(), "write apple association file", err)
		}
	})

	return s.withSecurityHeaders(mux)
}

// androidFingerprints toma las huellas del entorno y descarta las mal formadas
// antes de publicarlas: una huella con longitud incorrecta hace fallar la
// verificación del dominio en el dispositivo.
func (s *Server) appleBundleID() string {
	if s.fingerprints.AppleBundleID != "" {
		return s.fingerprints.AppleBundleID
	}
	return appleBundleID
}

func (s *Server) androidFingerprints(r *http.Request) []string {
	var out []string
	for _, raw := range strings.Split(s.fingerprints.AndroidFingerprints, ",") {
		fp := strings.TrimSpace(strings.ToUpper(raw))
		if fp == "" {
			continue
		}
		// SHA-256 en hexadecimal son 64 caracteres.
		if len(fp) != 64 || !isHex(fp) {
			// Una huella mal formada haría fallar la verificación del dominio en el
			// dispositivo; se registra como dependencia y se descarta.
			s.reporter.Dependency(r.Context(), "android_fingerprint_invalid", "", nil,
				slogString("channel", "wellknown"))
			continue
		}
		out = append(out, fp)
	}
	return out
}

func isHex(s string) bool {
	for _, c := range s {
		switch {
		case c >= '0' && c <= '9', c >= 'A' && c <= 'F':
		default:
			return false
		}
	}
	return true
}

// notConfigured responde 404 con el motivo. No se publica un archivo vacío: un
// `assetlinks.json` vacío hace que Android verifique el dominio y rechace la app,
// que es peor que no publicarlo.
func (s *Server) notConfigured(w http.ResponseWriter, what string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	_, _ = fmt.Fprintf(w, "%s no configurado en este entorno.\n", what)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(v)
}
