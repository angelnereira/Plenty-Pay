package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"plentypay/api-gateway/internal/ratelimit"
)

func TestRateLimitMiddleware_429WithRetryAfter(t *testing.T) {
	l := ratelimit.NewMemory()
	h := RateLimitMiddleware(l)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	// exhaust limit (default_anon = 120) is too many; use a low-limit by calling limiter directly? Instead test via auth scope path with 10 limit.
	for i := 0; i < 10; i++ {
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/login", nil)
		req.RemoteAddr = "1.2.3.4:1234"
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("request %d expected 200, got %d", i, rr.Code)
		}
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/login", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", rr.Code)
	}
	if rr.Header().Get("Retry-After") == "" {
		t.Fatal("Retry-After header missing")
	}
	// just check body contains RATE_LIMITED
	if !containsStr(rr.Body.String(), "RATE_LIMITED") {
		t.Fatalf("body missing RATE_LIMITED: %s", rr.Body.String())
	}
}

func containsStr(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
