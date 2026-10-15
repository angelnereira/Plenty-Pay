package config

import (
	"errors"
	"os"
)

type Config struct {
	Port           string
	AdminPort      string
	LogLevel       string
	DeployEnv      string
	BootstrapToken string
	VaultAddr      string
	VaultToken     string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:           envOr("PORT", "50073"),
		AdminPort:      envOr("ADMIN_PORT", "9100"),
		LogLevel:       envOr("LOG_LEVEL", "info"),
		DeployEnv:      envOr("DEPLOY_ENV", "dev"),
		BootstrapToken: envOr("BOOTSTRAP_TOKEN", "dev-bootstrap-token"),
		VaultAddr:      os.Getenv("VAULT_ADDR"),
		VaultToken:     os.Getenv("VAULT_TOKEN"),
	}
	if cfg.BootstrapToken == "" {
		return nil, errors.New("BOOTSTRAP_TOKEN is required")
	}
	return cfg, nil
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
