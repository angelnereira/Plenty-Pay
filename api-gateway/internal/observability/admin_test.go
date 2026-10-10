package observability

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func get(t *testing.T, url string) int {
	t.Helper()
	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	defer resp.Body.Close()
	return resp.StatusCode
}

func TestAdmin_LiveIsOKEvenWhenNotReady(t *testing.T) {
	var ready atomic.Bool
	srv := httptest.NewServer(NewAdminHandler(&ready))
	defer srv.Close()
	if code := get(t, srv.URL+"/healthz/live"); code != http.StatusOK {
		t.Fatalf("live = %d, esperaba 200", code)
	}
}

func TestAdmin_ReadyFollowsFlag(t *testing.T) {
	var ready atomic.Bool
	srv := httptest.NewServer(NewAdminHandler(&ready))
	defer srv.Close()
	if code := get(t, srv.URL+"/healthz/ready"); code != http.StatusServiceUnavailable {
		t.Fatalf("ready antes de arrancar = %d, esperaba 503", code)
	}
	ready.Store(true)
	if code := get(t, srv.URL+"/healthz/ready"); code != http.StatusOK {
		t.Fatalf("ready tras arrancar = %d, esperaba 200", code)
	}
	ready.Store(false) // apagado ordenado
	if code := get(t, srv.URL+"/healthz/ready"); code != http.StatusServiceUnavailable {
		t.Fatalf("ready durante el apagado = %d, esperaba 503", code)
	}
}

func TestHealthcheck_FailsWhenNotReadyOrUnreachable(t *testing.T) {
	var ready atomic.Bool
	srv := httptest.NewServer(NewAdminHandler(&ready))
	if err := Healthcheck(context.Background(), srv.URL); err == nil {
		t.Fatal("healthcheck debe fallar si el servicio no está listo")
	}
	ready.Store(true)
	if err := Healthcheck(context.Background(), srv.URL); err != nil {
		t.Fatalf("healthcheck con servicio listo: %v", err)
	}
	srv.Close()
	if err := Healthcheck(context.Background(), srv.URL); err == nil {
		t.Fatal("healthcheck debe fallar si el puerto admin no responde")
	}
}
