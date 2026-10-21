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
	req = req.WithContext(pmd.NewContext(req.Context(), pmd.Caller{UserID: "u-1", TenantID: "tenant-test", Permissions: []string{"catalog:write"}}))
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
	badReq = badReq.WithContext(pmd.NewContext(badReq.Context(), pmd.Caller{UserID: "u-1", TenantID: "tenant-test", Permissions: []string{"catalog:write"}}))
	badRec := httptest.NewRecorder()

	h.Upload(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for text file, got %d", badRec.Code)
	}
}

// fakeStorage guarda lo que el gateway sube (solo pruebas).
func fakeStorage(t *testing.T) (*storage.Client, map[string][]byte) {
	t.Helper()
	stored := map[string][]byte{}
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		data, _ := io.ReadAll(r.Body)
		stored[r.URL.Path] = data
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(ts.Close)
	return storage.NewClient(ts.URL, "garage", "key", "secret", "bucket"), stored
}

func upload(t *testing.T, h *MediaHandler, caller pmd.Caller, filename string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	part, _ := w.CreateFormFile("file", filename)
	_, _ = part.Write(data)
	_ = w.Close()
	req := httptest.NewRequest(http.MethodPost, "/v1/media/upload", body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req = req.WithContext(pmd.NewContext(req.Context(), caller))
	rec := httptest.NewRecorder()
	h.Upload(rec, req)
	return rec
}

var jpegMagic = append([]byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00}, make([]byte, 32)...)

// ADR 0021: solo quien edita el catálogo de un negocio sube fotos; nada se escribe si no.
func TestADR0021_UploadRequiresCatalogWriteAndTenant(t *testing.T) {
	client, stored := fakeStorage(t)
	h := NewMediaHandler(client)
	for name, c := range map[string]pmd.Caller{
		"sin permiso":   {UserID: "u", TenantID: "t", Permissions: []string{"pos:sell"}},
		"sin negocio":   {UserID: "u", Permissions: []string{"catalog:write"}},
		"cliente final": {UserID: "u"},
	} {
		rec := upload(t, h, c, "a.jpg", jpegMagic)
		if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "PERMISSION_DENIED") {
			t.Fatalf("%s: %d %s", name, rec.Code, rec.Body.String())
		}
	}
	if len(stored) != 0 {
		t.Fatalf("no se debe escribir nada: %v", stored)
	}
}

// ADR 0021: JPEG, PNG o WebP por sus bytes; GIF y otros se rechazan; la extensión de la clave sale
// del tipo detectado, nunca del nombre del archivo; más de 5 MB es FILE_TOO_LARGE.
func TestADR0021_TypeSizeAndServerKey(t *testing.T) {
	client, _ := fakeStorage(t)
	h := NewMediaHandler(client)
	ok := pmd.Caller{UserID: "u", TenantID: "tenant-a", Permissions: []string{"catalog:write"}}

	rec := upload(t, h, ok, "foto.html", jpegMagic)
	if rec.Code != http.StatusCreated || !strings.Contains(rec.Body.String(), ".jpg\"") || strings.Contains(rec.Body.String(), ".html") {
		t.Fatalf("la clave usa la extensión del tipo real: %d %s", rec.Code, rec.Body.String())
	}
	gif := append([]byte("GIF89a"), make([]byte, 32)...)
	if rec := upload(t, h, ok, "a.gif", gif); rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "UNSUPPORTED_FILE_TYPE") {
		t.Fatalf("GIF: %d %s", rec.Code, rec.Body.String())
	}
	big := append(append([]byte{}, jpegMagic...), make([]byte, 5*1024*1024)...)
	if rec := upload(t, h, ok, "grande.jpg", big); rec.Code != http.StatusRequestEntityTooLarge || !strings.Contains(rec.Body.String(), "FILE_TOO_LARGE") {
		t.Fatalf("más de 5 MB: %d %s", rec.Code, rec.Body.String())
	}
}
