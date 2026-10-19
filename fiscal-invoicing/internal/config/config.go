package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port     string
	LogLevel string
}

func Load() (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "50064"
	}
	level := os.Getenv("LOG_LEVEL")
	if level == "" {
		level = "info"
	}
	if port == "" {
		return nil, fmt.Errorf("PORT required")
	}
	return &Config{Port: port, LogLevel: level}, nil
}
