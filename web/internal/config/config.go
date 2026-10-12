// Package config carga y valida la configuración del contenedor web (go-standards.md §3.9):
// falla al arrancar si falta algo, sin imprimir valores secretos.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Config es la configuración ya validada del servidor estático.
type Config struct {
	// HTTPAddr es donde escucha el servidor público (p. ej. ":8081").
	HTTPAddr string
	// AdminAddr es el puerto de administración (salud y métricas), nunca publicado al host.
	AdminAddr string
	// AppDir es el directorio con el bundle de Flutter Web (`static/app/`, no versionado).
	AppDir string
	// StaticDir es la raíz de los archivos propios del contenedor (`.well-known`, medios).
	StaticDir string
	// GatewayPublicURL es la URL pública del gateway: la CSP permite conectarse solo a ella (R1).
	GatewayPublicURL string
	// DeployEnv y Version alimentan el recurso de trazas y los logs.
	DeployEnv string
	Version   string
}

// FromEnv lee la configuración del entorno. Devuelve error si un valor obligatorio no es usable.
func FromEnv(version string) (Config, error) {
	c := Config{
		// PORT, como los demás contenedores; WEB_HTTP_ADDR queda como sinónimo documentado en el SPEC.
		HTTPAddr:         withPort(firstNonEmpty(os.Getenv("PORT"), os.Getenv("WEB_HTTP_ADDR"), ":8081")),
		AdminAddr:        withPort(firstNonEmpty(os.Getenv("ADMIN_PORT"), "9100")),
		AppDir:           envOr("WEB_APP_DIR", "static/app"),
		StaticDir:        envOr("WEB_STATIC_DIR", "static"),
		GatewayPublicURL: envOr("GATEWAY_PUBLIC_URL", ""),
		DeployEnv:        envOr("DEPLOY_ENV", "dev"),
		Version:          version,
	}
	if c.GatewayPublicURL == "" {
		// La CSP necesita un origen concreto para `connect-src`; sin él la app no podría
		// hablar con el gateway. No se admite comodín: es una app que mueve dinero.
		return Config{}, fmt.Errorf("GATEWAY_PUBLIC_URL es obligatorio (origen https del gateway, p. ej. https://api.plentypay.app)")
	}
	appIndex := filepath.Join(c.AppDir, "index.html")
	info, err := os.Stat(appIndex)
	if err != nil {
		// No es fatal: R4 pide una página de mantenimiento clara, no un 500.
		return c, nil
	}
	if info.IsDir() {
		return Config{}, fmt.Errorf("%s existe pero es un directorio", appIndex)
	}
	return c, nil
}

// firstNonEmpty devuelve el primer valor no vacío.
func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func envOr(key, def string) string { return firstNonEmpty(os.Getenv(key), def) }

// withPort acepta "8081" y ":8081": los .env de los contenedores usan el número pelado
// (como identity y api-gateway) y net.Listen necesita los dos puntos.
func withPort(addr string) string {
	if strings.HasPrefix(addr, ":") {
		return addr
	}
	return ":" + addr
}
