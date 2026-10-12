package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFromEnvRequiresGatewayPublicURL(t *testing.T) {
	t.Setenv("GATEWAY_PUBLIC_URL", "")
	if _, err := FromEnv("test"); err == nil {
		t.Fatal("sin GATEWAY_PUBLIC_URL no se puede construir la CSP: debe fallar")
	}
}

func TestFromEnvDefaultsAndValues(t *testing.T) {
	t.Setenv("GATEWAY_PUBLIC_URL", "https://api.plentypay.app")
	t.Setenv("WEB_HTTP_ADDR", "")
	t.Setenv("ADMIN_PORT", "")
	cfg, err := FromEnv("1.2.3")
	if err != nil {
		t.Fatalf("FromEnv: %v", err)
	}
	if cfg.HTTPAddr != ":8081" || cfg.AdminAddr != ":9100" {
		t.Fatalf("valores por omisión incorrectos: %+v", cfg)
	}
	if cfg.Version != "1.2.3" {
		t.Fatalf("la versión debe propagarse: %q", cfg.Version)
	}
}

// La ausencia del bundle no es un error de configuración: R4 pide página de mantenimiento.
func TestFromEnvToleratesMissingBundle(t *testing.T) {
	t.Setenv("GATEWAY_PUBLIC_URL", "https://api.plentypay.app")
	t.Setenv("WEB_APP_DIR", filepath.Join(t.TempDir(), "no-existe"))
	cfg, err := FromEnv("test")
	if err != nil {
		t.Fatalf("un bundle ausente no debe romper el arranque: %v", err)
	}
	if _, err := os.Stat(cfg.AppDir); !os.IsNotExist(err) {
		t.Fatal("el directorio no debería existir en esta prueba")
	}
}

func TestFromEnvRejectsDirectoryAsIndex(t *testing.T) {
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "index.html"), 0o755); err != nil {
		t.Fatalf("Mkdir: %v", err)
	}
	t.Setenv("GATEWAY_PUBLIC_URL", "https://api.plentypay.app")
	t.Setenv("WEB_APP_DIR", dir)
	if _, err := FromEnv("test"); err == nil {
		t.Fatal("index.html como directorio debe fallar")
	}
}
