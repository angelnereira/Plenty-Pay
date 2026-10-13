package config

import (
	"os"
)

type Config struct {
	Port       string
	AdminPort  string
	LogLevel   string
	ApiBaseURL string
	WsURL      string
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func Load() (*Config, error) {
	return &Config{
		Port:       envOr("PORT", "50074"),
		AdminPort:  envOr("ADMIN_PORT", "9100"),
		LogLevel:   envOr("LOG_LEVEL", "info"),
		ApiBaseURL: envOr("API_BASE_URL", "http://localhost:8080"),
		WsURL:      envOr("WS_URL", "ws://localhost:8080/v1/realtime"),
	}, nil
}
