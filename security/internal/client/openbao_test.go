package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"plentypay/security/internal/domain"
)

func TestOpenBaoClient_Health(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/sys/health" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"initialized":true,"sealed":false}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer ts.Close()

	cli := NewOpenBaoClient(ts.URL, "test-token")
	if err := cli.Health(context.Background()); err != nil {
		t.Fatalf("Health: %v", err)
	}
}

func TestOpenBaoClient_PutAndGet(t *testing.T) {
	var storedData map[string]any

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			var req kvPayload
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			storedData = req.Data
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{
					"data": storedData,
					"metadata": map[string]any{
						"version":      1,
						"created_time": time.Now().UTC().Format(time.RFC3339),
					},
				},
			})

		case http.MethodGet:
			if storedData == nil {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{
					"data": storedData,
					"metadata": map[string]any{
						"version":      1,
						"created_time": time.Now().UTC().Format(time.RFC3339),
					},
				},
			})
		}
	}))
	defer ts.Close()

	cli := NewOpenBaoClient(ts.URL, "test-token")
	ctx := context.Background()

	meta, err := cli.Put(ctx, &domain.Secret{
		Name:           "bank/cred",
		Value:          []byte("secret-value-123"),
		AllowedReaders: []string{"settlement"},
		Labels:         map[string]string{"env": "test"},
	}, "idem-1")
	if err != nil {
		t.Fatalf("Put: %v", err)
	}
	if meta.Version != "1" {
		t.Fatalf("version esperada 1, obtuve %s", meta.Version)
	}

	sec, err := cli.Get(ctx, "bank/cred", "1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if string(sec.Value) != "secret-value-123" {
		t.Fatalf("valor recuperado incorrecto: %s", string(sec.Value))
	}
	if len(sec.AllowedReaders) != 1 || sec.AllowedReaders[0] != "settlement" {
		t.Fatalf("allowed_readers incorrecto: %v", sec.AllowedReaders)
	}

	// Not found
	storedData = nil
	_, err = cli.Get(ctx, "bank/cred", "1")
	if err != domain.ErrNotFound {
		t.Fatalf("esperaba ErrNotFound, obtuve %v", err)
	}
}

func TestOpenBaoClient_List(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":{"keys":["pac","jwt"]}}`))
	}))
	defer ts.Close()

	cli := NewOpenBaoClient(ts.URL, "test-token")
	metas, err := cli.List(context.Background(), "fiscal/")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(metas) != 2 {
		t.Fatalf("esperaba 2 secretos, obtuve %d", len(metas))
	}
}
