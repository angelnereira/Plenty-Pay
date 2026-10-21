package server

import (
	"context"
	"strings"
	"testing"
	"time"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/store"
)

func newTestServer(t *testing.T) *IdentityServer {
	t.Helper()
	tokens, err := auth.NewTokenIssuer("test-access-secret-at-least-32-characters-long", "test-refresh-secret-at-least-32-characters-long")
	if err != nil {
		t.Fatalf("NewTokenIssuer: %v", err)
	}
	return NewIdentityServer(store.NewInMemoryUserStore(), tokens, nil, observability.NewMetrics("identity", "test", "none"))
}

// requiredConsents son las aceptaciones mínimas del registro (N-DAT-02, N-DAT-14).
func requiredConsents() []*pb.ConsentGrant {
	return []*pb.ConsentGrant{
		{Purpose: "AGE_CONFIRMATION", TextVersion: "test-v1", Granted: true},
		{Purpose: "TERMS", TextVersion: "test-v1", Granted: true},
		{Purpose: "PRIVACY_DATA_PROCESSING", TextVersion: "test-v1", Granted: true},
	}
}

func TestRegisterLoginValidateFlow(t *testing.T) {
	s := newTestServer(t)
	ctx := context.Background()

	reg, err := s.Register(ctx, &pb.RegisterRequest{Email: "duena@comercio.test", Password: "contraseña-super-segura-123", FullName: "Dueña de Prueba", Role: pb.UserRole_BUSINESS_OWNER, TenantId: "tenant-1", Consents: requiredConsents()})
	if err != nil || !reg.Success || reg.AccessToken == "" || reg.RefreshToken == "" {
		t.Fatalf("Register falló: err=%v res=%+v", err, reg)
	}
	if dup, _ := s.Register(ctx, &pb.RegisterRequest{Email: "duena@comercio.test", Password: "otra-contraseña-larga-456", Role: pb.UserRole_BUSINESS_OWNER, Consents: requiredConsents()}); dup.Success {
		t.Fatal("R2: Register permitió un correo duplicado")
	}
	login, err := s.Login(ctx, &pb.LoginRequest{Email: "duena@comercio.test", Password: "contraseña-super-segura-123"})
	if err != nil || !login.Success {
		t.Fatalf("Login falló: err=%v msg=%s", err, login.ErrorMessage)
	}
	if bad, _ := s.Login(ctx, &pb.LoginRequest{Email: "duena@comercio.test", Password: "contraseña-incorrecta"}); bad.Success {
		t.Fatal("Login aceptó una contraseña incorrecta")
	}
	valid, err := s.ValidateToken(ctx, &pb.ValidateTokenRequest{AccessToken: login.AccessToken})
	if err != nil || !valid.Valid || valid.UserId != login.UserId || valid.Role != pb.UserRole_BUSINESS_OWNER {
		t.Fatalf("ValidateToken inconsistente: err=%v res=%+v", err, valid)
	}
	perms, _ := s.GetUserPermissions(ctx, &pb.GetUserPermissionsRequest{UserId: login.UserId})
	if len(perms.EnabledModules) == 0 {
		t.Fatal("BUSINESS_OWNER no obtuvo ningún módulo habilitado")
	}
	if refreshed, err := s.RefreshToken(ctx, &pb.RefreshTokenRequest{RefreshToken: login.RefreshToken}); err != nil || !refreshed.Success {
		t.Fatalf("RefreshToken falló: err=%v", err)
	}
	if wrong, _ := s.RefreshToken(ctx, &pb.RefreshTokenRequest{RefreshToken: login.AccessToken}); wrong.Success {
		t.Fatal("R6: RefreshToken aceptó un access token")
	}
}

func TestR4_LoginSameMessageForUnknownEmailAndWrongPassword(t *testing.T) {
	s := newTestServer(t)
	ctx := context.Background()
	_, _ = s.Register(ctx, &pb.RegisterRequest{Email: "a@b.co", Password: "contraseña-larga-123456", Role: pb.UserRole_CUSTOMER, Consents: requiredConsents()})
	unknown, _ := s.Login(ctx, &pb.LoginRequest{Email: "nadie@b.co", Password: "lo-que-sea-123456"})
	wrong, _ := s.Login(ctx, &pb.LoginRequest{Email: "a@b.co", Password: "incorrecta-123456"})
	if unknown.ErrorMessage != wrong.ErrorMessage {
		t.Fatalf("mensajes distintos revelan si el correo existe: %q vs %q", unknown.ErrorMessage, wrong.ErrorMessage)
	}
	if unknown.Reason != "INVALID_CREDENTIALS" || wrong.Reason != "INVALID_CREDENTIALS" {
		t.Fatalf("R4: el reason debe ser INVALID_CREDENTIALS en ambos casos: %q vs %q", unknown.Reason, wrong.Reason)
	}
}

func TestR1_R2_R3_RegisterRejectsWeakInputWithStableReason(t *testing.T) {
	s := newTestServer(t)
	ctx := context.Background()
	if _, err := s.Register(ctx, &pb.RegisterRequest{Email: "tomado@test.com", Password: "contraseña-larga-123456", Consents: requiredConsents()}); err != nil {
		t.Fatalf("Register: %v", err)
	}
	for name, tc := range map[string]struct {
		req    *pb.RegisterRequest
		reason string
	}{
		"R1 correo sin arroba":       {&pb.RegisterRequest{Email: "no-es-un-correo", Password: "contraseña-larga-123456", Consents: requiredConsents()}, "INVALID_EMAIL"},
		"R1 correo demasiado largo":  {&pb.RegisterRequest{Email: strings.Repeat("a", 250) + "@b.co", Password: "contraseña-larga-123456", Consents: requiredConsents()}, "INVALID_EMAIL"},
		"R2 contraseña corta":        {&pb.RegisterRequest{Email: "valido@test.com", Password: "corta", Consents: requiredConsents()}, "WEAK_PASSWORD"},
		"R2 contraseña de 129":       {&pb.RegisterRequest{Email: "valido@test.com", Password: strings.Repeat("x", 129), Consents: requiredConsents()}, "WEAK_PASSWORD"},
		"R3 correo duplicado (caja)": {&pb.RegisterRequest{Email: "TOMADO@test.com", Password: "contraseña-larga-123456", Consents: requiredConsents()}, "EMAIL_TAKEN"},
	} {
		t.Run(name, func(t *testing.T) {
			res, err := s.Register(ctx, tc.req)
			if err != nil || res.Success || res.Reason != tc.reason {
				t.Fatalf("esperaba reason %s, obtuve err=%v success=%v reason=%q", tc.reason, err, res.Success, res.Reason)
			}
		})
	}
}

func TestR2_RegisterAcceptsPasswordOf128Characters(t *testing.T) {
	s := newTestServer(t)
	res, err := s.Register(context.Background(), &pb.RegisterRequest{Email: "larga@test.com", Password: strings.Repeat("ñ", 64) + strings.Repeat("x", 64), Consents: requiredConsents()})
	if err != nil || !res.Success {
		t.Fatalf("una contraseña de 128 caracteres es válida (R2): err=%v res=%+v", err, res)
	}
}

func TestN_DAT_02_RegisterRequiresTermsAndPrivacy(t *testing.T) {
	s := newTestServer(t)
	ctx := context.Background()
	grant := func(purpose string, granted bool, version string) *pb.ConsentGrant {
		return &pb.ConsentGrant{Purpose: purpose, TextVersion: version, Granted: granted}
	}
	age := grant("AGE_CONFIRMATION", true, "v1")
	for name, consents := range map[string][]*pb.ConsentGrant{
		"sin términos":                     {age, grant("PRIVACY_DATA_PROCESSING", true, "v1")},
		"sin privacidad":                   {age, grant("TERMS", true, "v1")},
		"términos rechazados":              {age, grant("TERMS", false, "v1"), grant("PRIVACY_DATA_PROCESSING", true, "v1")},
		"privacidad sin versión del texto": {age, grant("TERMS", true, "v1"), grant("PRIVACY_DATA_PROCESSING", true, "")},
		"finalidad desconocida no cuenta":  {age, grant("TERMS", true, "v1"), grant("OTRA_COSA", true, "v1")},
	} {
		t.Run(name, func(t *testing.T) {
			res, err := s.Register(ctx, &pb.RegisterRequest{Email: "persona@test.com", Password: "contraseña-larga-123456", Consents: consents})
			if err != nil || res.Success || res.Reason != "CONSENT_REQUIRED" {
				t.Fatalf("esperaba CONSENT_REQUIRED, obtuve err=%v success=%v reason=%q", err, res.Success, res.Reason)
			}
		})
	}
	// Un registro rechazado no deja usuario creado.
	if login, _ := s.Login(ctx, &pb.LoginRequest{Email: "persona@test.com", Password: "contraseña-larga-123456"}); login.Success {
		t.Fatal("N-DAT-02: se creó la cuenta pese a faltar un consentimiento")
	}
}

func TestN_DAT_14_RegisterRequiresAgeConfirmation(t *testing.T) {
	s := newTestServer(t)
	ctx := context.Background()
	rest := []*pb.ConsentGrant{
		{Purpose: "TERMS", TextVersion: "v1", Granted: true},
		{Purpose: "PRIVACY_DATA_PROCESSING", TextVersion: "v1", Granted: true},
	}
	for name, consents := range map[string][]*pb.ConsentGrant{
		"sin confirmación":          rest,
		"rechazada":                 append([]*pb.ConsentGrant{{Purpose: "AGE_CONFIRMATION", TextVersion: "v1", Granted: false}}, rest...),
		"sin ningún consentimiento": nil,
	} {
		t.Run(name, func(t *testing.T) {
			res, err := s.Register(ctx, &pb.RegisterRequest{Email: "menor@test.com", Password: "contraseña-larga-123456", Consents: consents})
			if err != nil || res.Success || res.Reason != "AGE_REQUIREMENT" {
				t.Fatalf("esperaba AGE_REQUIREMENT, obtuve err=%v success=%v reason=%q", err, res.Success, res.Reason)
			}
		})
	}
}

func TestN_DAT_02_ConsentIsRecordedWithVersionDateChannelAndDevice(t *testing.T) {
	s := newTestServer(t)
	fixed := time.Date(2026, time.October, 12, 20, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return fixed }
	consents := append(requiredConsents(), &pb.ConsentGrant{Purpose: "MARKETING", TextVersion: "mk-v3", Granted: false})
	res, err := s.Register(context.Background(), &pb.RegisterRequest{
		Email: "ana@test.com", Password: "contraseña-larga-123456", Consents: consents, Channel: "app", Device: "Dart/3.9 (dart:io)",
	})
	if err != nil || !res.Success {
		t.Fatalf("Register: err=%v res=%+v", err, res)
	}
	user, err := s.users.FindByID(context.Background(), res.UserId)
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}
	if len(user.Consents) != 4 {
		t.Fatalf("esperaba 4 registros de consentimiento, hay %d", len(user.Consents))
	}
	byPurpose := map[string]store.ConsentRecord{}
	for _, c := range user.Consents {
		byPurpose[c.Purpose] = c
		if !c.RecordedAt.Equal(fixed) || c.Channel != "app" || c.Device != "Dart/3.9 (dart:io)" {
			t.Fatalf("falta fecha, canal o dispositivo en %+v", c)
		}
	}
	if c := byPurpose["TERMS"]; !c.Granted || c.TextVersion != "test-v1" {
		t.Fatalf("TERMS mal registrado: %+v", c)
	}
	if c := byPurpose["MARKETING"]; c.Granted || c.TextVersion != "mk-v3" {
		t.Fatalf("MARKETING (opcional, no aceptado) debe quedar registrado como no concedido: %+v", c)
	}
}

func TestTokenIssuerRejectsSameSecrets(t *testing.T) {
	same := "un-secreto-de-mas-de-32-caracteres-xx"
	if _, err := auth.NewTokenIssuer(same, same); err == nil {
		t.Fatal("NewTokenIssuer aceptó secretos iguales para access y refresh")
	}
}

