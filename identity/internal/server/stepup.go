package server

import (
	"context"
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/service"
	"plentypay/identity/internal/store"
)

// stepUpErrors traduce los rechazos de la confirmación fuerte (identity/SPEC.md §4, R25–R28).
// Un reto inválido no es 401: la app refrescaría la sesión en vez de pedir otro reto.
var stepUpErrors = []struct {
	err    error
	code   codes.Code
	reason string
}{
	{domain.ErrUnknownOperation, codes.InvalidArgument, "UNKNOWN_OPERATION"},
	{domain.ErrStepUpMethodNotAllowed, codes.InvalidArgument, "STEP_UP_METHOD_NOT_ALLOWED"},
	{domain.ErrChallengeInvalid, codes.FailedPrecondition, "TOKEN_INVALID"},
	{domain.ErrPinNotSet, codes.FailedPrecondition, "PIN_NOT_SET"},
	{domain.ErrPinFormat, codes.InvalidArgument, "PIN_INVALID"},
	{domain.ErrPinIncorrect, codes.PermissionDenied, "PIN_INVALID"},
	{domain.ErrPinLocked, codes.FailedPrecondition, "PIN_LOCKED"},
	{domain.ErrPasskeysUnavailable, codes.FailedPrecondition, "PASSKEYS_UNAVAILABLE"},
	{domain.ErrPasskeyVerificationFailed, codes.PermissionDenied, "PASSKEY_VERIFICATION_FAILED"},
	{domain.ErrStepUpPasswordIncorrect, codes.PermissionDenied, "INVALID_CREDENTIALS"},
	{domain.ErrAccountLocked, codes.FailedPrecondition, "ACCOUNT_LOCKED"},
}

func init() { accessErrors = append(accessErrors, stepUpErrors...) }

// WithStrongAuth reemplaza el store en memoria por el persistido (R32) y fija la política del PIN.
func (s *IdentityServer) WithStrongAuth(st store.StrongAuthStore, pin domain.PinPolicy) *IdentityServer {
	s.svc.WithStrongAuth(st, pin)
	return s
}

// WithPasskeyAuthenticator activa el método PASSKEY (R25); sin él, PASSKEYS_UNAVAILABLE.
func (s *IdentityServer) WithPasskeyAuthenticator(p service.PasskeyAuthenticator) *IdentityServer {
	s.svc.WithPasskeyAuthenticator(p)
	return s
}

// PurgeStepUp borra retos y tokens vencidos (job horario de main).
func (s *IdentityServer) PurgeStepUp(ctx context.Context) (int64, error) {
	return s.svc.PurgeStepUp(ctx, s.now().UTC().Add(-domain.StepUpTTL))
}

func methodToPB(m string) pb.StepUpMethod {
	if v, ok := pb.StepUpMethod_value[m]; ok {
		return pb.StepUpMethod(v)
	}
	return pb.StepUpMethod_STEP_UP_METHOD_UNSPECIFIED
}

func methodFromPB(m pb.StepUpMethod) string {
	if m == pb.StepUpMethod_STEP_UP_METHOD_UNSPECIFIED {
		return ""
	}
	return m.String()
}

func methodsToPB(ms []string) []pb.StepUpMethod {
	out := make([]pb.StepUpMethod, 0, len(ms))
	for _, m := range ms {
		out = append(out, methodToPB(m))
	}
	return out
}

// IssueStepUpChallenge emite un reto persistido ligado a la operación (R26: el usuario sale del
// contexto; StepUpRequest.user_id se ignora).
func (s *IdentityServer) IssueStepUpChallenge(ctx context.Context, req *pb.StepUpRequest) (*pb.PasskeyChallenge, error) {
	v, err := s.svc.IssueStepUpChallenge(ctx, service.StepUpChallengeInput{
		Operation: req.GetOperation(), AmountMinor: req.GetAmountMinor(), Currency: req.GetCurrency(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &pb.PasskeyChallenge{
		ChallengeId:          v.ID,
		PublicKeyOptionsJson: v.OptionsJSON,
		Operation:            v.Operation,
		AmountMinor:          v.AmountMinor,
		Currency:             v.Currency,
		Level:                int32(v.Level),
		AllowedMethods:       methodsToPB(v.AllowedMethods),
		AvailableMethods:     methodsToPB(v.AvailableMethods),
		ExpiresAt:            timestamppb.New(v.ExpiresAt),
	}, nil
}

// VerifyStepUp verifica la passkey, el PIN o la contraseña en identity y emite el token (R25–R28).
func (s *IdentityServer) VerifyStepUp(ctx context.Context, req *pb.VerifyStepUpRequest) (*pb.StepUpToken, error) {
	v, err := s.svc.VerifyStepUp(ctx, service.VerifyStepUpInput{
		ChallengeID: req.GetChallengeId(), Method: methodFromPB(req.GetMethod()),
		PIN: req.GetPin(), Password: req.GetPassword(), Assertion: req.GetAssertionJson(),
	})
	if err != nil {
		var pinErr *service.PinError
		if errors.As(err, &pinErr) {
			return nil, toStatus(pinErr.Err)
		}
		return nil, toStatus(err)
	}
	return &pb.StepUpToken{Token: v.Token, ExpiresAt: timestamppb.New(v.ExpiresAt), Method: methodToPB(v.Method)}, nil
}

// ConsumeStepUp consume el token de forma atómica (R15, R32). Lo llama el servicio que ejecuta la
// operación con la vinculación que espera; el resultado es valid=false + reason, nunca un error.
func (s *IdentityServer) ConsumeStepUp(ctx context.Context, req *pb.ConsumeStepUpRequest) (*pb.ConsumeStepUpResult, error) {
	reason, err := s.svc.ConsumeStepUp(ctx, req.GetToken(), store.StepUpBinding{
		UserID: req.GetUserId(), Operation: req.GetOperation(), AmountMinor: req.GetAmountMinor(), Currency: req.GetCurrency(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &pb.ConsumeStepUpResult{Valid: reason == "", Reason: reason}, nil
}

// SetStepUpPin crea o cambia el PIN de confirmación (R28; step-up identity.pin.set, nivel 3).
func (s *IdentityServer) SetStepUpPin(ctx context.Context, req *pb.SetStepUpPinRequest) (*pb.SimpleResult, error) {
	if err := s.svc.SetStepUpPin(ctx, req.GetPin()); err != nil {
		return nil, toStatus(err)
	}
	return &pb.SimpleResult{Success: true}, nil
}

// GetStepUpPinStatus dice si la persona tiene PIN, cuántos intentos le quedan y si está bloqueado.
func (s *IdentityServer) GetStepUpPinStatus(ctx context.Context, _ *pb.GetStepUpPinStatusRequest) (*pb.StepUpPinStatus, error) {
	v, err := s.svc.GetStepUpPinStatus(ctx)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.StepUpPinStatus{IsSet: v.IsSet, AttemptsRemaining: int32(v.AttemptsRemaining)}
	if v.LockedUntil != nil {
		out.LockedUntil = timestamppb.New(*v.LockedUntil)
	}
	return out, nil
}
