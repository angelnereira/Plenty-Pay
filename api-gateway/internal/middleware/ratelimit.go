package middleware

import (
	"context"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"plentypay/api-gateway/internal/observability"
	"plentypay/api-gateway/internal/ratelimit"
)

// RateLimiter es el contrato mínimo que el middleware necesita.
type RateLimiter interface {
	ratelimit.Limiter
}

// RateLimitMiddleware aplica rate limiting por IP (y por scope de ruta) antes de cualquier handler.
// Si limiter es nil, no se limita (modo degradado / pruebas).
func RateLimitMiddleware(limiter ratelimit.Limiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if limiter == nil {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			scope, limit := classify(r)
			key := "ip:" + clientIP(r) + ":" + scope
			ok, retry, err := limiter.Allow(r.Context(), key, limit, time.Minute)
			// fail-open: no bloquear por un fallo del contador.
			_ = err
			if !ok {
				w.Header().Set("Retry-After", strconv.Itoa(retry))
				observability.WriteProblem(w, http.StatusTooManyRequests, "RATE_LIMITED", "demasiadas peticiones, intenta más tarde")
				return
			}
			// Propagar scope para métricas (opcional).
			ctx := context.WithValue(r.Context(), rlScopeKey, scope)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type ctxKey string

const rlScopeKey ctxKey = "rl_scope"

func classify(r *http.Request) (string, int) {
	p := r.URL.Path
	method := r.Method
	switch {
	case strings.HasPrefix(p, "/v1/auth/") || strings.HasPrefix(p, "/v1/invitations/accept") || strings.HasPrefix(p, "/v1/auth/password"):
		return "auth", 10
	case strings.HasPrefix(p, "/v1/public/tracking") || strings.HasPrefix(p, "/v1/pay-links"):
		return "public", 60
	case strings.Contains(p, "webhook"):
		return "webhook", 1200
	case isMoneyMutation(method, p):
		return "money", 30
	default:
		if isAuthed(r) {
			return "default_auth", 600
		}
		return "default_anon", 120
	}
}

func isMoneyMutation(method, p string) bool {
	if method != http.MethodPost && method != http.MethodPut && method != http.MethodPatch {
		return false
	}
	lower := strings.ToLower(p)
	for _, k := range []string{"payment", "wallet", "transfer", "checkout", "payout", "refund"} {
		if strings.Contains(lower, k) {
			return true
		}
	}
	return false
}

func isAuthed(r *http.Request) bool {
	return strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ")
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

