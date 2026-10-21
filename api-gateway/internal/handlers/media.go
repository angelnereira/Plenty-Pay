package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
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

	// ADR 0021: mismas reglas que catalog.CreateUploadUrl. Solo quien edita el catálogo de un
	// negocio sube fotos; el tenant sale de la identidad validada, nunca del cliente (ADR 0011).
	caller := pmd.FromContext(r.Context())
	if caller.TenantID == "" || !slices.Contains(caller.Permissions, "catalog:write") {
		middleware.WriteError(w, http.StatusForbidden, "PERMISSION_DENIED", "no tienes permiso para subir fotos de productos")
		return
	}
	// ≤ 5 MB (catalog SPEC §4); un poco de margen para las cabeceras del multipart.
	const maxImageSize = 5 * 1024 * 1024
	r.Body = http.MaxBytesReader(w, r.Body, maxImageSize+64*1024)

	var data []byte
	var ext string
	contentType := r.Header.Get("Content-Type")

	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(maxImageSize); err != nil {
			middleware.WriteError(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "la foto supera 5 MB")
			return
		}
		file, _, err := r.FormFile("file") // el nombre del archivo del cliente no decide nada (ADR 0021)
		if err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", "falta el campo 'file'")
			return
		}
		defer func() { _ = file.Close() }()
		data, err = io.ReadAll(file)
		if err != nil {
			middleware.WriteError(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "la foto supera 5 MB")
			return
		}
	} else {
		var err error
		data, err = io.ReadAll(r.Body)
		if err != nil {
			middleware.WriteError(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "la foto supera 5 MB")
			return
		}
	}

	if len(data) == 0 {
		middleware.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", "la foto está vacía")
		return
	}
	if len(data) > maxImageSize {
		middleware.WriteError(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "la foto supera 5 MB")
		return
	}

	// Verificación de tipo MIME seguro (magic bytes)
	detectedType := http.DetectContentType(data)
	// La extensión sale del tipo detectado, nunca del nombre que manda el cliente.
	ext = map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[detectedType]
	if ext == "" {
		middleware.WriteError(w, http.StatusBadRequest, "UNSUPPORTED_FILE_TYPE", "la foto debe ser JPEG, PNG o WebP")
		return
	}

	// R1: Claves generadas por el servidor (<tenant>/<año>/<uuid>.<ext>)
	// El tenant sale de la identidad validada, nunca de una cabecera del cliente (ADR 0011).
	tenant := caller.TenantID
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
		middleware.WriteError(w, http.StatusServiceUnavailable, "DEPENDENCY_UNAVAILABLE", "no pudimos guardar la foto; inténtalo de nuevo")
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
