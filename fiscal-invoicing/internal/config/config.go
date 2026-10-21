// Package config carga y valida el entorno al arrancar (go-standards.md §3.9).
package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

// Config del contenedor (SPEC §8). Ningún valor secreto se registra.
type Config struct {
	Port         string
	AdminPort    string
	DBDSN        string
	MigrateDSN   string
	NATSUrl      string
	NATSUser     string
	NATSPass     string
	IdentityAddr string
	SecurityAddr string
	InfraAddr    string
	CallTimeout  time.Duration

	// PAC (ADR 0022). PACProviders son los adaptadores que se ofrecen, en orden; FiscalProdEnabled es
	// el interruptor operativo de producción (F30.3). Cada adaptador lee su propia configuración con
	// el prefijo PP_PAC_<ID>_ (p. ej. PP_PAC_HKA_DEMO_ENDPOINT).
	PACProviders      []string
	FiscalProdEnabled bool
	PACTimeout        time.Duration
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// Load lee PP_* y falla si algo es inválido.
func Load() (Config, error) {
	c := Config{
		Port:         env("PORT", "50064"),
		AdminPort:    env("ADMIN_PORT", "9100"),
		DBDSN:        os.Getenv("PP_DB_DSN"),
		MigrateDSN:   os.Getenv("PP_MIGRATE_DSN"),
		NATSUrl:      os.Getenv("PP_NATS_URL"),
		NATSUser:     os.Getenv("PP_NATS_USER"),
		NATSPass:     os.Getenv("PP_NATS_PASS"),
		IdentityAddr: env("PP_IDENTITY_ADDR", "identity:50060"),
		SecurityAddr: env("PP_SECURITY_ADDR", "security:50073"),
		InfraAddr:    env("PP_INFRA_ADDR", "infra-management:50074"),
	}
	d, err := time.ParseDuration(env("PP_CALL_TIMEOUT", "3s"))
	if err != nil || d <= 0 {
		return c, fmt.Errorf("PP_CALL_TIMEOUT no es una duración válida")
	}
	c.CallTimeout = d
	pt, err := time.ParseDuration(env("PP_PAC_TIMEOUT", "30s"))
	if err != nil || pt <= 0 {
		return c, fmt.Errorf("PP_PAC_TIMEOUT no es una duración válida")
	}
	c.PACTimeout = pt
	switch v := env("FISCAL_PROD_ENABLED", "false"); v {
	case "true":
		c.FiscalProdEnabled = true
	case "false":
	default:
		return c, fmt.Errorf("FISCAL_PROD_ENABLED debe ser true o false")
	}
	for _, p := range strings.Split(env("PP_PAC_PROVIDERS", "simulator,hka"), ",") {
		if p = strings.TrimSpace(p); p != "" {
			c.PACProviders = append(c.PACProviders, p)
		}
	}
	if len(c.PACProviders) == 0 {
		return c, fmt.Errorf("PP_PAC_PROVIDERS no lista ningún adaptador")
	}
	return c, nil
}

// RequireDB exige la base para servir (no hay modo en memoria: esto es producción).
func (c Config) RequireDB() error {
	if c.DBDSN == "" {
		return errors.New("PP_DB_DSN es obligatorio")
	}
	return nil
}
