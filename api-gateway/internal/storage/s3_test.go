package storage

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestS3Client_PutAndGet(t *testing.T) {
	stored := make(map[string][]byte)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth == "" {
			http.Error(w, "missing auth", http.StatusUnauthorized)
			return
		}
		switch r.Method {
		case http.MethodPut:
			data, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			stored[r.URL.Path] = data
			w.WriteHeader(http.StatusOK)
		case http.MethodGet:
			data, ok := stored[r.URL.Path]
			if !ok {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "image/png")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(data)
		default:
			http.Error(w, "bad method", http.StatusMethodNotAllowed)
		}
	}))
	defer ts.Close()

	client := NewClient(ts.URL, "garage", "testkey", "testsecret", "testbucket")

	ctx := context.Background()
	content := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A} // PNG magic bytes
	if err := client.PutObject(ctx, "images/pic.png", "image/png", content); err != nil {
		t.Fatalf("PutObject failed: %v", err)
	}

	reader, ct, _, err := client.GetObject(ctx, "images/pic.png")
	if err != nil {
		t.Fatalf("GetObject failed: %v", err)
	}
	defer func() { _ = reader.Close() }()

	got, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("ReadAll failed: %v", err)
	}
	if string(got) != string(content) {
		t.Errorf("expected %v, got %v", content, got)
	}
	if ct != "image/png" {
		t.Errorf("expected image/png, got %s", ct)
	}

	// 404 case
	_, _, _, err = client.GetObject(ctx, "nonexistent.png")
	if err == nil {
		t.Errorf("expected error on nonexistent key")
	}
}
