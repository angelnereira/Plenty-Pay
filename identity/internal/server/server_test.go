package server

import (
	"context"
	"testing"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/store"
)

func newTestServer(t *testing.T) *IdentityServer {
	tokens, err := auth.NewTokenIssuer("test-access-secret-at-least-32-characters-long", "test-refresh-secret-at-least-32-characters-long")
	if err != nil {
		t.Fatalf("NewTokenIssuer: %v", err)
	}
	return NewIdentityServer(store.NewInMemoryUserStore(), tokens)
}

func TestRegisterLoginValidateFlow(t *testing.T) {
	s := newTestServer(t)
	ctx := context.Background()

	reg, err := s.Register(ctx, &pb.RegisterRequest{Email: "duena@comercio.test", Password: "contraseña-super-segura-123", FullName: "Dueña de Prueba", Role: pb.UserRole_BUSINESS_OWNER, TenantId: "tenant-1"})
	if err != nil || !reg.Success || reg.AccessToken == "" || reg.RefreshToken == "" {
		t.Fatalf("Register falló: err=%v res=%+v", err, reg)
	}
	if dup, _ := s.Register(ctx, &pb.RegisterRequest{Email: "duena@comercio.test", Password: "otra-contraseña-larga-456", Role: pb.UserRole_BUSINESS_OWNER}); dup.Success {
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
	_, _ = s.Register(ctx, &pb.RegisterRequest{Email: "a@b.co", Password: "contraseña-larga-123456", Role: pb.UserRole_CUSTOMER})
	unknown, _ := s.Login(ctx, &pb.LoginRequest{Email: "nadie@b.co", Password: "lo-que-sea-123456"})
	wrong, _ := s.Login(ctx, &pb.LoginRequest{Email: "a@b.co", Password: "incorrecta-123456"})
	if unknown.ErrorMessage != wrong.ErrorMessage {
		t.Fatalf("mensajes distintos revelan si el correo existe: %q vs %q", unknown.ErrorMessage, wrong.ErrorMessage)
	}
}

func TestR1_R3_RegisterRejectsWeakInput(t *testing.T) {
	s := newTestServer(t)
	for _, req := range []*pb.RegisterRequest{
		{Email: "no-es-un-correo", Password: "contraseña-larga-123456"},
		{Email: "valido@test.com", Password: "corta"},
	} {
		if res, _ := s.Register(context.Background(), req); res.Success {
			t.Fatalf("Register aceptó una entrada inválida: %+v", req)
		}
	}
}

func TestTokenIssuerRejectsSameSecrets(t *testing.T) {
	same := "un-secreto-de-mas-de-32-caracteres-xx"
	if _, err := auth.NewTokenIssuer(same, same); err == nil {
		t.Fatal("NewTokenIssuer aceptó secretos iguales para access y refresh")
	}
}
