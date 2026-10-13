package client

import (
	"crypto/tls"
	"testing"

	"plentypay/api-gateway/internal/observability"
)

func TestNewIdentityClient_Insecure(t *testing.T) {
	metrics := observability.NewMetrics("api-gateway", "test", "none")
	reporter := observability.NewReporter(nil, "api-gateway", metrics)

	cli, err := NewIdentityClient("localhost:50060", reporter)
	if err != nil {
		t.Fatalf("NewIdentityClient falló: %v", err)
	}
	defer cli.Close()
	if cli.conn == nil || cli.client == nil {
		t.Fatal("conn y client no deben ser nil")
	}
}

func TestNewIdentityClient_WithTLS(t *testing.T) {
	metrics := observability.NewMetrics("api-gateway", "test", "none")
	reporter := observability.NewReporter(nil, "api-gateway", metrics)

	tlsConf := &tls.Config{
		ServerName: "identity",
	}
	cli, err := NewIdentityClientWithTLS("localhost:50060", reporter, tlsConf)
	if err != nil {
		t.Fatalf("NewIdentityClientWithTLS falló: %v", err)
	}
	defer cli.Close()
	if cli.conn == nil || cli.client == nil {
		t.Fatal("conn y client no deben ser nil")
	}
}
