package main

import (
	"context"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"plentypay/fiscal-invoicing/internal/config"
	"plentypay/fiscal-invoicing/internal/observability"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "err", err.Error())
		os.Exit(1)
	}
	logger := observability.NewLogger(os.Stdout, "fiscal-invoicing", "dev", cfg.LogLevel)
	slog.SetDefault(logger)

	slog.Info("fiscal-invoicing started", "port", cfg.Port)
	// gRPC server wiring arrives in F13.5. Skeleton for now.
	lis, err := net.Listen("tcp", ":"+cfg.Port)
	if err != nil {
		slog.Error("listen failed", "err", err.Error())
		os.Exit(1)
	}
	defer lis.Close()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	<-stop
	slog.Info("shutting down")
	time.Sleep(100 * time.Millisecond)
	_ = context.Background()
}
