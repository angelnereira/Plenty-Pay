package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"plentypay/api-gateway/internal/client"
	"plentypay/api-gateway/internal/metadata"
)

type fakeValidator struct{ session *client.ValidatedSession }

func (f fakeValidator) ValidateToken(context.Context, string) (*client.ValidatedSession, error) {
	return f.session, nil
}

// R5 + ADR 0018: el caller sale del token validado (permisos, alcance, capacidades) y el token
// de step-up de X-Step-Up-Token; nada de eso se lee del cuerpo.
func TestR24_RequireAuthBuildsCallerFromValidatedSession(t *testing.T) {
	session := &client.ValidatedSession{
		Valid: true, UserID: "u1", TenantID: "t1", Role: "BUSINESS_STAFF",
		Permissions: []string{"pos:sell"}, BranchScope: "b1", Capabilities: []string{"pos.counter"},
	}
	var got metadata.Caller
	h := RequireAuth(fakeValidator{session})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = metadata.FromContext(r.Context())
	}))
	req := httptest.NewRequest(http.MethodGet, "/v1/business/branches", nil)
	req.Header.Set("Authorization", "Bearer tok")
	req.Header.Set(HeaderStepUpToken, "step-1")
	h.ServeHTTP(httptest.NewRecorder(), req)

	if got.UserID != "u1" || got.TenantID != "t1" || got.BranchScope != "b1" || got.StepUp != "step-1" ||
		!slices.Equal(got.Permissions, []string{"pos:sell"}) || !slices.Equal(got.Capabilities, []string{"pos.counter"}) {
		t.Fatalf("caller = %+v", got)
	}
}
