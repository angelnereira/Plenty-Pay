// Package config carga y valida el entorno del contenedor (go-standards.md
// seccion 3.9): solo variables de entorno con prefijo PP_/los nombres del
// .env.example, validadas al arrancar. Sin valores por defecto inseguros: si
// falta un secreto, el proceso no arranca.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
)

// Config es la configuracion ya validada de identity.
type Config struct {
	Port             string // gRPC (50060)
	AdminPort        string // healthz/metrics (9100)
	LogLevel         string
	DeployEnv        string
	AccessSecret     string
	RefreshSecret    string
	DBDSN            string // vacio = store en memoria (pruebas unitarias y E2E sin BD)
	MigrateDSN       string // DSN del job de migracion (directo a postgres, sin PgBouncer)
	SecurityAddr     string // destino de ReportSecurityEvent (vacio = no reporta)
	SecurityInsecure bool
	NATSUrl          string // endpoint del bus (vacio = sin relay de outbox)
	NATSUser         string
	NATSPass         string
	MTLSEnforced     bool
}

// Load lee el entorno y falla con error descriptivo si algo falta o es invalido.
func Load() (Config, error) {
	cfg := Config{
		Port:             getOr("PORT", "50060"),
		AdminPort:        getOr("ADMIN_PORT", "9100"),
		LogLevel:         getOr("LOG_LEVEL", "info"),
		DeployEnv:        getOr("DEPLOY_ENV", "dev"),
		AccessSecret:     os.Getenv("ACCESS_TOKEN_SECRET"),
		RefreshSecret:    os.Getenv("REFRESH_TOKEN_SECRET"),
		DBDSN:            os.Getenv("PP_DB_DSN"),
		MigrateDSN:       os.Getenv("PP_MIGRATE_DSN"),
		SecurityAddr:     os.Getenv("PP_SECURITY_ADDR"),
		SecurityInsecure: os.Getenv("PP_SECURITY_INSECURE") == "true",
		NATSUrl:          getOr("PP_NATS_URL", ""),
		NATSUser:         os.Getenv("PP_NATS_USER"),
		NATSPass:         os.Getenv("PP_NATS_PASS"),
		MTLSEnforced:     os.Getenv("MTLS_ENFORCED") == "true",
	}

	if len(cfg.AccessSecret) < 32 {
		return cfg, errors.New("ACCESS_TOKEN_SECRET obligatorio y de al menos 32 caracteres (ver .env.example); nunca hay un secreto por defecto")
	}
	if len(cfg.RefreshSecret) < 32 {
		return cfg, errors.New("REFRESH_TOKEN_SECRET obligatorio y de al menos 32 caracteres (ver .env.example); nunca hay un secreto por defecto")
	}
	// Dos secretos distintos: si fueran iguales, un refresh valdria como access.
	if cfg.AccessSecret == cfg.RefreshSecret {
		return cfg, errors.New("ACCESS_TOKEN_SECRET y REFRESH_TOKEN_SECRET deben ser distintos")
	}
	// El DSN deBD, si viene, debe parsear como URL de postgres.
	if cfg.DBDSN != "" {
		u, err := url.Parse(cfg.DBDSN)
		if err != nil || u.Host == "" {
			return cfg, fmt.Errorf("PP_DB_DSN no es un DSN valido: %s", cfg.DBDSN)
		}
	}
	return cfg, nil
}

func getOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
