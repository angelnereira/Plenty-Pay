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
	CatalogAddr     string
	InventoryAddr   string
	PaymentsAddr    string
	Timeout         time.Duration
	PaymentsTimeout time.Duration
	AcceptSLA       time.Duration
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
		Port: env("PORT", "50075"), AdminPort: env("ADMIN_PORT", "9100"),
		DBDSN: os.Getenv("PP_DB_DSN"), MigrateDSN: os.Getenv("PP_MIGRATE_DSN"),
		NATSUrl: os.Getenv("PP_NATS_URL"), NATSUser: os.Getenv("PP_NATS_USER"), NATSPass: os.Getenv("PP_NATS_PASS"),
		CatalogAddr: env("PP_CATALOG_ADDR", "catalog:50065"), InventoryAddr: env("PP_INVENTORY_ADDR", "inventory:50066"),
		PaymentsAddr: env("PP_PAYMENTS_ADDR", "payments-core:50062"),
	}
	var err error
	for _, d := range []struct {
		key, def string
		dst      *time.Duration
	}{
		{"PP_DEPENDENCY_TIMEOUT", "1s", &c.Timeout},
		{"PP_PAYMENTS_TIMEOUT", "3s", &c.PaymentsTimeout},
		{"ACCEPT_SLA", "15m", &c.AcceptSLA},
	} {
		if *d.dst, err = time.ParseDuration(env(d.key, d.def)); err != nil {
			return c, errors.New(d.key + " no es una duración válida")
		}
	}
	if c.AcceptSLA < 5*time.Minute || c.AcceptSLA > time.Hour {
		return c, errors.New("ACCEPT_SLA debe estar entre 5 y 60 minutos (SPEC R4)")
	}
	return c, nil
}

// RequireDB exige la base para servir.
func (c Config) RequireDB() error {
	if c.DBDSN == "" {
		return errors.New("PP_DB_DSN es obligatorio")
	}
	return nil
}
