// Package config carga y valida el entorno al arrancar (go-standards.md §3.9).
package config

import (
	"errors"
	"os"
	"time"
)

// Config del contenedor (SPEC §8). Ningún valor secreto se registra.
type Config struct {
	Port            string
	AdminPort       string
	DBDSN           string
	MigrateDSN      string
	NATSUrl         string
	NATSUser        string
	NATSPass        string
	InfraAddr       string
	InfraTimeout    time.Duration
	IdentityAddr    string
	IdentityTimeout time.Duration
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// Load lee PP_* y falla si falta lo obligatorio.
func Load() (Config, error) {
	c := Config{
		Port:         env("PORT", "50065"),
		AdminPort:    env("ADMIN_PORT", "9100"),
		DBDSN:        os.Getenv("PP_DB_DSN"),
		MigrateDSN:   os.Getenv("PP_MIGRATE_DSN"),
		NATSUrl:      os.Getenv("PP_NATS_URL"),
		NATSUser:     os.Getenv("PP_NATS_USER"),
		NATSPass:     os.Getenv("PP_NATS_PASS"),
		InfraAddr:    env("PP_INFRA_ADDR", "infra-management:50074"),
		IdentityAddr: env("PP_IDENTITY_ADDR", "identity:50060"),
	}
	d, err := time.ParseDuration(env("PP_INFRA_TIMEOUT", "1s"))
	if err != nil {
		return c, errors.New("PP_INFRA_TIMEOUT no es una duración válida")
	}
	c.InfraTimeout = d
	c.IdentityTimeout = d
	return c, nil
}

// RequireDB exige la base para servir (no hay modo en memoria: esto es producción).
func (c Config) RequireDB() error {
	if c.DBDSN == "" {
		return errors.New("PP_DB_DSN es obligatorio")
	}
	return nil
}
