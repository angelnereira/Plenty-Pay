package server

import (
	"context"
	"testing"

	"google.golang.org/grpc/codes"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/tenancy"
)

// registerForStepUp crea una cuenta y devuelve su contexto (lo que el gateway pone en x-pp-user-id).
func registerForStepUp(t *testing.T, s *IdentityServer, email string) (context.Context, string) {
	t.Helper()
	reg, err := s.Register(context.Background(), &pb.RegisterRequest{Email: email, Password: "contraseña-super-segura-123",
		FullName: "Persona de Prueba", Role: pb.UserRole_CUSTOMER, Consents: requiredConsents()})
	if err != nil || !reg.Success {
		t.Fatalf("Register: %v %+v", err, reg)
	}
	return tenancy.WithUser(context.Background(), reg.UserId), reg.UserId
}

// setPinViaPassword recorre el flujo real: reto de identity.pin.set, contraseña, SetStepUpPin.
func setPinViaPassword(t *testing.T, s *IdentityServer, ctx context.Context, pin string) {
	t.Helper()
	ch, err := s.IssueStepUpChallenge(ctx, &pb.StepUpRequest{Operation: domain.OpPinSet})
	if err != nil {
		t.Fatalf("reto de identity.pin.set: %v", err)
	}
	tok, err := s.VerifyStepUp(ctx, &pb.VerifyStepUpRequest{ChallengeId: ch.ChallengeId, Method: pb.StepUpMethod_PASSWORD, Password: "contraseña-super-segura-123"})
	if err != nil || tok.Method != pb.StepUpMethod_PASSWORD {
		t.Fatalf("verificar con contraseña: %v %+v", err, tok)
	}
	if _, err := s.SetStepUpPin(tenancy.WithStepUpToken(ctx, tok.Token), &pb.SetStepUpPinRequest{Pin: pin}); err != nil {
		t.Fatalf("SetStepUpPin: %v", err)
	}
}

// R25–R28 por gRPC: el flujo completo de la app (crear PIN, confirmar un reembolso, consumir).
func TestR28_StepUpFlowOverGRPC(t *testing.T) {
	s := newTestServer(t)
	ctx, userID := registerForStepUp(t, s, "flujo-confirmacion@example.com")
	setPinViaPassword(t, s, ctx, "246813")

	st, err := s.GetStepUpPinStatus(ctx, &pb.GetStepUpPinStatusRequest{})
	if err != nil || !st.IsSet || st.AttemptsRemaining != 3 {
		t.Fatalf("estado del PIN: %v %+v", err, st)
	}
	// R26: el user_id del cuerpo se ignora.
	ch, err := s.IssueStepUpChallenge(ctx, &pb.StepUpRequest{UserId: "otra-persona", Operation: domain.OpPaymentsRefund, AmountMinor: 1200, Currency: "USD"})
	if err != nil {
		t.Fatalf("IssueStepUpChallenge: %v", err)
	}
	if ch.Operation != domain.OpPaymentsRefund || ch.AmountMinor != 1200 || ch.Level != 2 ||
		len(ch.AvailableMethods) != 1 || ch.AvailableMethods[0] != pb.StepUpMethod_PIN || ch.ExpiresAt == nil {
		t.Fatalf("el reto describe la operación y los métodos: %+v", ch)
	}
	_, err = s.VerifyStepUp(ctx, &pb.VerifyStepUpRequest{ChallengeId: ch.ChallengeId, Method: pb.StepUpMethod_PIN, Pin: "000000"})
	if code, reason := reasonOf(t, err); code != codes.PermissionDenied || reason != "PIN_INVALID" {
		t.Fatalf("PIN equivocado: %v %s", code, reason)
	}
	tok, err := s.VerifyStepUp(ctx, &pb.VerifyStepUpRequest{ChallengeId: ch.ChallengeId, Method: pb.StepUpMethod_PIN, Pin: "246813"})
	if err != nil || tok.Token == "" || tok.Method != pb.StepUpMethod_PIN {
		t.Fatalf("PIN correcto: %v %+v", err, tok)
	}
	consume := &pb.ConsumeStepUpRequest{Token: tok.Token, UserId: userID, Operation: domain.OpPaymentsRefund, AmountMinor: 1200, Currency: "USD"}
	if r, err := s.ConsumeStepUp(ctx, consume); err != nil || !r.Valid {
		t.Fatalf("primer consumo: %v %+v", err, r)
	}
	if r, _ := s.ConsumeStepUp(ctx, consume); r.Valid || r.Reason != "ALREADY_USED" {
		t.Fatalf("segundo consumo: %+v", r)
	}
	other := &pb.ConsumeStepUpRequest{Token: tok.Token, UserId: "otra-persona", Operation: domain.OpPaymentsRefund, AmountMinor: 1200, Currency: "USD"}
	if r, _ := s.ConsumeStepUp(ctx, other); r.Valid {
		t.Fatalf("el token nunca sirve a otra persona: %+v", r)
	}
}

// Cada rechazo de la confirmación fuerte sale con su código y su reason (identity/SPEC.md §4).
func TestObs_StepUpErrorsCarryStableReason(t *testing.T) {
	s := newTestServer(t)
	ctx, _ := registerForStepUp(t, s, "razones-confirmacion@example.com")

	_, err := s.IssueStepUpChallenge(ctx, &pb.StepUpRequest{Operation: "payout.confirm"})
	if code, reason := reasonOf(t, err); code != codes.InvalidArgument || reason != "UNKNOWN_OPERATION" {
		t.Fatalf("operación desconocida: %v %s", code, reason)
	}
	_, err = s.IssueStepUpChallenge(context.Background(), &pb.StepUpRequest{Operation: domain.OpPaymentsRefund})
	if code, _ := reasonOf(t, err); code != codes.Unauthenticated {
		t.Fatalf("sin usuario: %v", code)
	}
	ch, _ := s.IssueStepUpChallenge(ctx, &pb.StepUpRequest{Operation: domain.OpPaymentsRefund, AmountMinor: 100, Currency: "USD"})
	cases := []struct {
		req    *pb.VerifyStepUpRequest
		code   codes.Code
		reason string
	}{
		{&pb.VerifyStepUpRequest{ChallengeId: ch.ChallengeId, Method: pb.StepUpMethod_PIN, Pin: "123456"}, codes.FailedPrecondition, "PIN_NOT_SET"},
		{&pb.VerifyStepUpRequest{ChallengeId: ch.ChallengeId, Method: pb.StepUpMethod_PASSWORD, Password: "x"}, codes.InvalidArgument, "STEP_UP_METHOD_NOT_ALLOWED"},
		{&pb.VerifyStepUpRequest{ChallengeId: ch.ChallengeId, Method: pb.StepUpMethod_PASSKEY, AssertionJson: []byte("{}")}, codes.FailedPrecondition, "PASSKEYS_UNAVAILABLE"},
		{&pb.VerifyStepUpRequest{ChallengeId: "no-es-un-reto", Method: pb.StepUpMethod_PIN, Pin: "123456"}, codes.FailedPrecondition, "TOKEN_INVALID"},
	}
	for _, c := range cases {
		_, err := s.VerifyStepUp(ctx, c.req)
		if code, reason := reasonOf(t, err); code != c.code || reason != c.reason {
			t.Fatalf("%+v: se esperaba %v %s, llegó %v %s", c.req, c.code, c.reason, code, reason)
		}
	}
	setPinViaPassword(t, s, ctx, "246813")
	_, err = s.SetStepUpPin(ctx, &pb.SetStepUpPinRequest{Pin: "246813"})
	if code, reason := reasonOf(t, err); code != codes.PermissionDenied || reason != "STEP_UP_REQUIRED" {
		t.Fatalf("SetStepUpPin sin token: %v %s", code, reason)
	}
	_, err = s.SetStepUpPin(ctx, &pb.SetStepUpPinRequest{Pin: "12"})
	if code, reason := reasonOf(t, err); code != codes.InvalidArgument || reason != "PIN_INVALID" {
		t.Fatalf("SetStepUpPin con formato inválido: %v %s", code, reason)
	}
	for i := 0; i < 3; i++ {
		_, err = s.VerifyStepUp(ctx, &pb.VerifyStepUpRequest{ChallengeId: ch.ChallengeId, Method: pb.StepUpMethod_PIN, Pin: "999999"})
	}
	if code, reason := reasonOf(t, err); code != codes.FailedPrecondition || reason != "PIN_LOCKED" {
		t.Fatalf("tercer PIN equivocado: %v %s", code, reason)
	}
	st, _ := s.GetStepUpPinStatus(ctx, &pb.GetStepUpPinStatusRequest{})
	if st.LockedUntil == nil || st.AttemptsRemaining != 0 {
		t.Fatalf("el estado muestra el bloqueo: %+v", st)
	}
}

// R26: ChangePassword toma el usuario de x-pp-user-id y consume el token de identity.password.change.
func TestR26_ChangePasswordUsesContextUserAndStepUp(t *testing.T) {
	s := newTestServer(t)
	ctx, _ := registerForStepUp(t, s, "cambia-clave@example.com")
	victimCtx, victimID := registerForStepUp(t, s, "victima-clave@example.com")
	_ = victimCtx

	_, err := s.ChangePassword(context.Background(), &pb.ChangePasswordRequest{UserId: victimID, StepUpToken: "x"})
	if code, _ := reasonOf(t, err); code != codes.Unauthenticated {
		t.Fatalf("sin usuario en el contexto: %v", code)
	}
	_, err = s.ChangePassword(ctx, &pb.ChangePasswordRequest{CurrentPassword: "contraseña-super-segura-123", NewPassword: "nueva-contraseña-muy-larga"})
	if code, reason := reasonOf(t, err); code != codes.PermissionDenied || reason != "STEP_UP_REQUIRED" {
		t.Fatalf("sin token: %v %s", code, reason)
	}
	_, err = s.ChangePassword(ctx, &pb.ChangePasswordRequest{CurrentPassword: "contraseña-super-segura-123", NewPassword: "nueva-contraseña-muy-larga", StepUpToken: "inventado"})
	if code, reason := reasonOf(t, err); code != codes.PermissionDenied || reason != "STEP_UP_INVALID" {
		t.Fatalf("token inventado (antes bastaba con no estar vacío, B12): %v %s", code, reason)
	}
}
