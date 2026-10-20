package handlers

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	pmd "plentypay/api-gateway/internal/metadata"
	"plentypay/api-gateway/internal/storage"
)

func TestMediaHandler_UploadAndServe(t *testing.T) {
	stored := make(map[string][]byte)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPut:
			data, _ := io.ReadAll(r.Body)
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
		}
	}))
	defer ts.Close()

	s3Client := storage.NewClient(ts.URL, "garage", "key", "secret", "bucket")
	h := NewMediaHandler(s3Client)

	// 1. Upload valid image via multipart
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "test.png")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	pngMagic := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00}
	_, _ = part.Write(pngMagic)
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/v1/media/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	// ADR 0011: una cabecera del cliente no decide el tenant; manda la identidad validada.
	req.Header.Set("X-Tenant-Id", "tenant-ajeno")
	req = req.WithContext(pmd.NewContext(req.Context(), pmd.Caller{UserID: "u-1", TenantID: "tenant-test"}))
	rec := httptest.NewRecorder()

	h.Upload(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"object_key":"tenant-test/`) {
		t.Fatalf("la clave debe ir bajo el tenant del token: %s", rec.Body.String())
	}

	// 2. Upload invalid MIME type (e.g. text file)
	textBody := &bytes.Buffer{}
	textWriter := multipart.NewWriter(textBody)
	textPart, _ := textWriter.CreateFormFile("file", "test.txt")
	_, _ = textPart.Write([]byte("this is plain text"))
	_ = textWriter.Close()

	badReq := httptest.NewRequest(http.MethodPost, "/v1/media/upload", textBody)
	badReq.Header.Set("Content-Type", textWriter.FormDataContentType())
	badRec := httptest.NewRecorder()

	h.Upload(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for text file, got %d", badRec.Code)
	}
}
