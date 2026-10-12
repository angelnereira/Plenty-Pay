package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"plentypay/api-gateway/internal/client"
	"plentypay/api-gateway/internal/middleware"
)

type fakeIdentity struct {
	loginResult    *client.AuthResult
	registerResult *client.AuthResult
	err            error
	registeredWith struct {
		email, password, fullName string
		consents                  []client.Consent
		channel, device           string
	}
}

func (f *fakeIdentity) Login(ctx context.Context, email, password string) (*client.AuthResult, error) {
	return f.loginResult, f.err
}
func (f *fakeIdentity) RegisterCustomer(ctx context.Context, email, password, fullName string, consents []client.Consent, channel, device string) (*client.AuthResult, error) {
	f.registeredWith.email, f.registeredWith.password, f.registeredWith.fullName = email, password, fullName
	f.registeredWith.consents, f.registeredWith.channel, f.registeredWith.device = consents, channel, device
	return f.registerResult, f.err
}
func (f *fakeIdentity) RefreshToken(ctx context.Context, rt string) (*client.AuthResult, error) {
	return f.loginResult, f.err
}
func (f *fakeIdentity) GetPermissions(ctx context.Context, userID string) (*client.Permissions, error) {
	return &client.Permissions{Role: "CUSTOMER", EnabledModules: []string{"wallet", "marketplace"}, Permissions: []string{"wallet:read"}}, f.err
}

func post(h http.HandlerFunc, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)))
	return rec
}

func TestLoginSuccess(t *testing.T) {
	h := NewAuthHandlers(&fakeIdentity{loginResult: &client.AuthResult{Success: true, AccessToken: "a", RefreshToken: "r", UserID: "u1", Role: "CUSTOMER"}})
	rec := post(h.Login, `{"email":"a@b.co","password":"x"}`)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"access_token":"a"`) {
		t.Fatalf("login exitoso mal traducido: %d %s", rec.Code, rec.Body.String())
	}
}

func TestLoginFailureIs401WithReason(t *testing.T) {
	h := NewAuthHandlers(&fakeIdentity{loginResult: &client.AuthResult{Success: false, ErrorMessage: "correo o contraseña incorrectos"}})
	rec := post(h.Login, `{"email":"a@b.co","password":"x"}`)
	if rec.Code != http.StatusUnauthorized || !strings.Contains(rec.Body.String(), `"reason":"INVALID_CREDENTIALS"`) {
		t.Fatalf("esperaba 401 + reason, obtuve %d %s", rec.Code, rec.Body.String())
	}
}

// R4: identity emite siempre INVALID_CREDENTIALS, exista o no el correo (anti-enumeración).
func TestR4_LoginReasonComesFromIdentityWhenPresent(t *testing.T) {
	h := NewAuthHandlers(&fakeIdentity{loginResult: &client.AuthResult{Success: false, Reason: "INVALID_CREDENTIALS", ErrorMessage: "correo o contraseña incorrectos"}})
	rec := post(h.Login, `{"email":"nadie@b.co","password":"x"}`)
	if rec.Code != http.StatusUnauthorized || !strings.Contains(rec.Body.String(), `"reason":"INVALID_CREDENTIALS"`) {
		t.Fatalf("esperaba 401 + INVALID_CREDENTIALS, obtuve %d %s", rec.Code, rec.Body.String())
	}
}

func TestR5_IdentityDownIs503NotAuthFailure(t *testing.T) {
	h := NewAuthHandlers(&fakeIdentity{err: errors.New("conexión rechazada")})
	if rec := post(h.Login, `{"email":"a@b.co","password":"x"}`); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("identity caído debe ser 503 (no 401), obtuve %d", rec.Code)
	}
}

// R3: la prueba de seguridad más importante del gateway — el registro público no acepta rol ni tenant.
func TestR3_RegisterRejectsPrivilegeEscalationFields(t *testing.T) {
	f := &fakeIdentity{registerResult: &client.AuthResult{Success: true, AccessToken: "a"}}
	h := NewAuthHandlers(f)
	for _, body := range []string{
		`{"email":"a@b.co","password":"x","full_name":"n","role":"PLATFORM_ADMIN"}`,
		`{"email":"a@b.co","password":"x","full_name":"n","tenant_id":"tenant-de-otro"}`,
	} {
		if rec := post(h.Register, body); rec.Code != http.StatusBadRequest {
			t.Fatalf("Register aceptó un campo privilegiado (%s): %d", body, rec.Code)
		}
	}
	if f.registeredWith.email != "" {
		t.Fatal("identity.Register fue invocado a pesar de un cuerpo con campos privilegiados")
	}
}

func TestRegisterValidBody(t *testing.T) {
	f := &fakeIdentity{registerResult: &client.AuthResult{Success: true, AccessToken: "a", Role: "CUSTOMER"}}
	h := NewAuthHandlers(f)
	if rec := post(h.Register, `{"email":"a@b.co","password":"contraseña-larga-123","full_name":"Ana"}`); rec.Code != http.StatusOK || f.registeredWith.fullName != "Ana" {
		t.Fatalf("registro válido falló: %d", rec.Code)
	}
}

// N-DAT-02: las aceptaciones de S-GEN-03 viajan al registro; canal y dispositivo los pone el gateway.
func TestN_DAT_02_RegisterForwardsConsentsAndSetsChannelAndDevice(t *testing.T) {
	f := &fakeIdentity{registerResult: &client.AuthResult{Success: true, AccessToken: "a"}}
	h := NewAuthHandlers(f)
	body := `{"email":"ana@b.co","password":"contraseña-larga-123","full_name":"Ana","consents":[` +
		`{"purpose":"AGE_CONFIRMATION","text_version":"v1","granted":true},` +
		`{"purpose":"TERMS","text_version":"v1","granted":true},` +
		`{"purpose":"PRIVACY_DATA_PROCESSING","text_version":"v1","granted":true},` +
		`{"purpose":"MARKETING","text_version":"v1","granted":false}]}`
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set("User-Agent", "Dart/3.9 (dart:io)")
	h.Register(httptest.NewRecorder(), req)

	if got := f.registeredWith.consents; len(got) != 4 || got[3].Purpose != "MARKETING" || got[3].Granted || got[0].TextVersion != "v1" {
		t.Fatalf("consentimientos mal reenviados: %+v", got)
	}
	if f.registeredWith.channel != registerChannel {
		t.Fatalf("el canal lo fija el gateway y debe ser %q, fue %q", registerChannel, f.registeredWith.channel)
	}
	if f.registeredWith.device != "Dart/3.9 (dart:io)" {
		t.Fatalf("el dispositivo debe salir del User-Agent, fue %q", f.registeredWith.device)
	}
}

// El cuerpo del cliente nunca fija canal ni dispositivo (son metadatos del gateway).
func TestRegisterRejectsChannelAndDeviceInBody(t *testing.T) {
	f := &fakeIdentity{registerResult: &client.AuthResult{Success: true}}
	for _, body := range []string{
		`{"email":"a@b.co","password":"x","channel":"kiosco","device":"PC"}`,
		`{"email":"a@b.co","password":"x","consents":[{"purpose":"TERMS","text_version":"v1","granted":true,"granted_at":"2026-10-12"}]}`,
	} {
		if rec := post(NewAuthHandlers(f).Register, body); rec.Code != http.StatusBadRequest {
			t.Fatalf("Register aceptó un campo que no le corresponde (%s): %d", body, rec.Code)
		}
	}
	if f.registeredWith.email != "" {
		t.Fatal("identity.Register fue invocado con un cuerpo inválido")
	}
}

func TestRegisterRejectsTooManyConsents(t *testing.T) {
	f := &fakeIdentity{registerResult: &client.AuthResult{Success: true}}
	many := `{"email":"a@b.co","password":"x","consents":[` + strings.Repeat(`{"purpose":"TERMS","text_version":"v1","granted":true},`, 50) + `{"purpose":"TERMS","text_version":"v1","granted":true}]}`
	if rec := post(NewAuthHandlers(f).Register, many); rec.Code != http.StatusBadRequest {
		t.Fatalf("un registro con 51 consentimientos debe rechazarse, obtuve %d", rec.Code)
	}
}

// El reason estable de identity llega al cliente para que la app lo traduzca (N-DAT-02, N-DAT-14).
func TestRegisterPropagatesConsentReasons(t *testing.T) {
	for reason, status := range map[string]int{
		"CONSENT_REQUIRED": http.StatusBadRequest,
		"AGE_REQUIREMENT":  http.StatusBadRequest,
		"EMAIL_TAKEN":      http.StatusBadRequest,
		"INVALID_EMAIL":    http.StatusBadRequest,
		"WEAK_PASSWORD":    http.StatusBadRequest,
	} {
		h := NewAuthHandlers(&fakeIdentity{registerResult: &client.AuthResult{Success: false, Reason: reason, ErrorMessage: "mensaje"}})
		rec := post(h.Register, `{"email":"a@b.co","password":"contraseña-larga-123","consents":[]}`)
		if rec.Code != status || !strings.Contains(rec.Body.String(), `"reason":"`+reason+`"`) {
			t.Fatalf("reason %s: esperaba %d + reason, obtuve %d %s", reason, status, rec.Code, rec.Body.String())
		}
	}
}

func TestMalformedJSONIs400(t *testing.T) {
	if rec := post(NewAuthHandlers(&fakeIdentity{}).Login, `{no es json`); rec.Code != http.StatusBadRequest {
		t.Fatalf("esperaba 400, obtuve %d", rec.Code)
	}
}

func TestOversizedBodyIs400(t *testing.T) {
	big := `{"email":"` + strings.Repeat("a", 2<<20) + `","password":"x"}`
	if rec := post(NewAuthHandlers(&fakeIdentity{}).Login, big); rec.Code != http.StatusBadRequest {
		t.Fatalf("un cuerpo > 1 MiB debe rechazarse, obtuve %d", rec.Code)
	}
}

type fakeValidator struct {
	session *client.ValidatedSession
	err     error
}

func (f fakeValidator) ValidateToken(ctx context.Context, token string) (*client.ValidatedSession, error) {
	return f.session, f.err
}

func TestProtectedRouteThroughMiddleware(t *testing.T) {
	h := NewAuthHandlers(&fakeIdentity{})
	protected := middleware.RequireAuth(fakeValidator{session: &client.ValidatedSession{Valid: true, UserID: "u1", Role: "CUSTOMER"}})(http.HandlerFunc(h.Permissions))
	noToken := httptest.NewRecorder()
	protected.ServeHTTP(noToken, httptest.NewRequest(http.MethodGet, "/", nil))
	if noToken.Code != http.StatusUnauthorized {
		t.Fatalf("sin token debe ser 401, obtuve %d", noToken.Code)
	}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer abc")
	ok := httptest.NewRecorder()
	protected.ServeHTTP(ok, req)
	if ok.Code != http.StatusOK || !strings.Contains(ok.Body.String(), `"wallet"`) {
		t.Fatalf("ruta protegida con token válido falló: %d %s", ok.Code, ok.Body.String())
	}
}

func TestInvalidTokenIs401AndIdentityDownIs503(t *testing.T) {
	h := NewAuthHandlers(&fakeIdentity{})
	req := func() *http.Request {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Authorization", "Bearer abc")
		return r
	}
	invalid := httptest.NewRecorder()
	middleware.RequireAuth(fakeValidator{session: &client.ValidatedSession{Valid: false}})(http.HandlerFunc(h.Me)).ServeHTTP(invalid, req())
	if invalid.Code != http.StatusUnauthorized {
		t.Fatalf("token inválido debe ser 401, obtuve %d", invalid.Code)
	}
	down := httptest.NewRecorder()
	middleware.RequireAuth(fakeValidator{err: errors.New("caído")})(http.HandlerFunc(h.Me)).ServeHTTP(down, req())
	if down.Code != http.StatusServiceUnavailable {
		t.Fatalf("identity caído debe ser 503, obtuve %d", down.Code)
	}
}
