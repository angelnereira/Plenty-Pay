package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	pmd "plentypay/api-gateway/internal/metadata"
	"plentypay/api-gateway/internal/middleware"
	"plentypay/api-gateway/internal/storage"
)

// MediaHandler gestiona la subida y entrega de archivos multimedia con object-storage.
type MediaHandler struct {
	client *storage.Client
}

// NewMediaHandler crea un MediaHandler con su cliente S3.
func NewMediaHandler(client *storage.Client) *MediaHandler {
	return &MediaHandler{client: client}
}

// Upload recibe un archivo de imagen (multipart/form-data o binario directo) y lo almacena
// en el bucket de medios generando una clave de objeto segura por servidor (SPEC R1).
func (m *MediaHandler) Upload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "metodo no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Limite de 10 MB (object-storage SPEC §4 R2)
	const maxUploadSize = 10 * 1024 * 1024
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	var data []byte
	var ext string
	contentType := r.Header.Get("Content-Type")

	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(maxUploadSize); err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "FILE_TOO_LARGE", "el archivo excede el tamaño máximo permitido de 10 MB")
			return
		}
		file, handler, err := r.FormFile("file")
		if err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "MISSING_FILE", "campo 'file' requerido en multipart")
			return
		}
		defer func() { _ = file.Close() }()
		data, err = io.ReadAll(file)
		if err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "READ_ERROR", "error al leer el archivo")
			return
		}
		ext = strings.ToLower(path.Ext(handler.Filename))
	} else {
		var err error
		data, err = io.ReadAll(r.Body)
		if err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "READ_ERROR", "error al leer el cuerpo de la peticion")
			return
		}
	}

	if len(data) == 0 {
		middleware.WriteError(w, http.StatusBadRequest, "EMPTY_FILE", "el archivo no puede estar vacío")
		return
	}

	// Verificación de tipo MIME seguro (magic bytes)
	detectedType := http.DetectContentType(data)
	switch detectedType {
	case "image/jpeg":
		if ext == "" || ext == ".bin" {
			ext = ".jpg"
		}
	case "image/png":
		if ext == "" || ext == ".bin" {
			ext = ".png"
		}
	case "image/webp":
		if ext == "" || ext == ".bin" {
			ext = ".webp"
		}
	case "image/gif":
		if ext == "" || ext == ".bin" {
			ext = ".gif"
		}
	default:
		middleware.WriteError(w, http.StatusBadRequest, "UNSUPPORTED_TYPE", "formato de imagen no soportado (se requiere JPG, PNG, WEBP o GIF)")
		return
	}

	// R1: Claves generadas por el servidor (<tenant>/<año>/<uuid>.<ext>)
	// El tenant sale de la identidad validada, nunca de una cabecera del cliente (ADR 0011).
	tenant := pmd.FromContext(r.Context()).TenantID
	if tenant == "" {
		tenant = "personal"
	}
	year := time.Now().UTC().Format("2006")
	randomBytes := make([]byte, 16)
	if _, err := rand.Read(randomBytes); err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "INTERNAL", "error interno")
		return
	}
	uuidStr := hex.EncodeToString(randomBytes)

	objectKey := fmt.Sprintf("%s/%s/%s%s", tenant, year, uuidStr, ext)

	// Subida a object-storage
	if err := m.client.PutObject(r.Context(), objectKey, detectedType, data); err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "STORAGE_ERROR", "error al guardar el archivo multimedia")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"url":        "/media/" + objectKey,
		"object_key": objectKey,
		"mime_type":  detectedType,
		"size_bytes": len(data),
	})
}

// Serve entrega el archivo multimedia desde object-storage con cabeceras de caché inmutable.
func (m *MediaHandler) Serve(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "metodo no permitido", http.StatusMethodNotAllowed)
		return
	}

	key := strings.TrimPrefix(r.URL.Path, "/media/")
	key = strings.TrimPrefix(key, "/")
	if key == "" {
		http.NotFound(w, r)
		return
	}

	body, contentType, contentLength, err := m.client.GetObject(r.Context(), key)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer func() { _ = body.Close() }()

	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	if contentLength > 0 {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", contentLength))
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.WriteHeader(http.StatusOK)
	if r.Method == http.MethodGet {
		_, _ = io.Copy(w, body)
	}
}
