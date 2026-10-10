package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"plentypay/api-gateway/internal/client"
	"plentypay/api-gateway/internal/middleware"
)

// Identity: lo único que estos handlers necesitan de identity.
type Identity interface {
	Login(ctx context.Context, email, password string) (*client.AuthResult, error)
	RegisterCustomer(ctx context.Context, email, password, fullName string) (*client.AuthResult, error)
	RefreshToken(ctx context.Context, refreshToken string) (*client.AuthResult, error)
	GetPermissions(ctx context.Context, userID string) (*client.Permissions, error)
}

type AuthHandlers struct{ identity Identity }

func NewAuthHandlers(identity Identity) *AuthHandlers { return &AuthHandlers{identity: identity} }

const maxBodyBytes = 1 << 20 // 1 MiB

func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields() // un campo inesperado (p. ej. "role") es error, nunca se ignora en silencio
	if err := dec.Decode(dst); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "INVALID_JSON", "cuerpo JSON inválido")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	UserID       string `json:"user_id"`
	TenantID     string `json:"tenant_id"`
	Role         string `json:"role"`
}

func respondAuth(w http.ResponseWriter, res *client.AuthResult, err error, failStatus int, failReason string) {
	if err != nil {
		middleware.WriteError(w, http.StatusServiceUnavailable, "IDENTITY_UNAVAILABLE", "servicio de identidad no disponible")
		return
	}
	if !res.Success {
		middleware.WriteError(w, failStatus, failReason, res.ErrorMessage)
		return
	}
	writeJSON(w, http.StatusOK, tokenResponse{AccessToken: res.AccessToken, RefreshToken: res.RefreshToken, UserID: res.UserID, TenantID: res.TenantID, Role: res.Role})
}

func (h *AuthHandlers) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decode(w, r, &body) {
		return
	}
	res, err := h.identity.Login(r.Context(), body.Email, body.Password)
	respondAuth(w, res, err, http.StatusUnauthorized, "INVALID_CREDENTIALS")
}

// Register es público y SOLO crea clientes finales. El cuerpo no acepta "role" ni "tenant_id".
func (h *AuthHandlers) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		FullName string `json:"full_name"`
	}
	if !decode(w, r, &body) {
		return
	}
	res, err := h.identity.RegisterCustomer(r.Context(), body.Email, body.Password, body.FullName)
	respondAuth(w, res, err, http.StatusBadRequest, "REGISTRATION_REJECTED")
}

func (h *AuthHandlers) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !decode(w, r, &body) {
		return
	}
	res, err := h.identity.RefreshToken(r.Context(), body.RefreshToken)
	respondAuth(w, res, err, http.StatusUnauthorized, "TOKEN_INVALID")
}

func (h *AuthHandlers) Me(w http.ResponseWriter, r *http.Request) {
	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		middleware.WriteError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "sin sesión")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"user_id": session.UserID, "tenant_id": session.TenantID, "role": session.Role})
}

// Permissions: lo que flutter_app usa para armar su menú dinámico (ADR 0009). Es UX, no control de acceso.
func (h *AuthHandlers) Permissions(w http.ResponseWriter, r *http.Request) {
	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		middleware.WriteError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "sin sesión")
		return
	}
	perms, err := h.identity.GetPermissions(r.Context(), session.UserID)
	if err != nil {
		middleware.WriteError(w, http.StatusServiceUnavailable, "IDENTITY_UNAVAILABLE", "servicio de identidad no disponible")
		return
	}
	modules := perms.EnabledModules
	if modules == nil {
		modules = []string{}
	}
	permissions := perms.Permissions
	if permissions == nil {
		permissions = []string{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"role": perms.Role, "enabled_modules": modules, "permissions": permissions})
}
