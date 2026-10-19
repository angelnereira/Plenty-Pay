package geostream

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClient_CreateSession(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"session_id": "ses_1"})
	}))
	defer srv.Close()
	c := New(srv.URL, "key")
	out, err := c.CreateSession("ONE_TO_ONE", 3600)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out["session_id"] != "ses_1" {
		t.Fatalf("bad: %v", out)
	}
}

func TestClient_GetSnapshot(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"session_id": "ses_1", "items": []any{}})
	}))
	defer srv.Close()
	c := New(srv.URL, "key")
	out, err := c.GetSnapshot("ses_1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out["session_id"] != "ses_1" {
		t.Fatalf("bad: %v", out)
	}
}

func TestClient_IngestLocations(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"results": []any{}})
	}))
	defer srv.Close()
	c := New(srv.URL, "key")
	out, err := c.IngestLocations("ses_1", []map[string]any{{"lat": 1.0, "lon": 2.0}})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out == nil {
		t.Fatal("nil result")
	}
}
