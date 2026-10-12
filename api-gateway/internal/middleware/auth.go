package middleware

import (
	"context"
	"net/http"
	"strings"

	"plentypay/api-gateway/internal/client"
	"plentypay/api-gateway/internal/observability"
)

type contextKey string

const sessionContextKey contextKey = "session"

// TokenValidator: lo único que el middleware necesita de identity (Segregación de Interfaces).
type TokenValidator interface {
	ValidateToken(ctx context.Context, accessToken string) (*client.ValidatedSession, error)
}

// RequireAuth es el único lugar del gateway que decide si una petición protegida entra.
func RequireAuth(validator TokenValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
			if !ok || token == "" {
				WriteError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "falta Authorization: Bearer <token>")
				return
			}
			session, err := validator.ValidateToken(r.Context(), token)
			if err != nil {
				// identity no respondió: 503, no 401 — el usuario no hizo nada mal.
				WriteError(w, http.StatusServiceUnavailable, "IDENTITY_UNAVAILABLE", "servicio de identidad no disponible")
				return
			}
			if !session.Valid {
				WriteError(w, http.StatusUnauthorized, "TOKEN_INVALID", "token inválido o expirado")
				return
			}
			ctx := observability.WithActor(r.Context(), session.UserID, session.TenantID)
			next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, sessionContextKey, session)))
		})
	}
}

func SessionFromContext(ctx context.Context) (*client.ValidatedSession, bool) {
	session, ok := ctx.Value(sessionContextKey).(*client.ValidatedSession)
	return session, ok
}

// WriteError: formato único de error de la API pública (api-gateway/SPEC.md §4).
func WriteError(w http.ResponseWriter, status int, reason, msg string) {
	observability.WriteProblem(w, status, reason, msg)
}
