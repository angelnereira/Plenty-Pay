package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/store"
	"plentypay/identity/internal/tenancy"
)

// Confirmación fuerte (ADR 0020, identity/SPEC.md R14, R15, R25–R28, R32). identity es el único que
// decide: verifica una passkey, el PIN o la contraseña y emite un token de un solo uso ligado a
// usuario + operación + monto + moneda. El usuario sale siempre del contexto (R26).

// PasskeyAuthenticator verifica aserciones WebAuthn de confirmación fuerte (R25, R29). nil = las
// passkeys están apagadas (sin WEBAUTHN_RP_ID, Q-39) y el método PASSKEY no está disponible.
type PasskeyAuthenticator interface {
	HasPasskeys(ctx context.Context, userID string) (bool, error)
	// BeginAssertion devuelve las opciones públicas para el cliente y el estado a guardar con el reto.
	BeginAssertion(ctx context.Context, userID string, challenge []byte) (options, session []byte, err error)
	// FinishAssertion verifica la aserción contra el estado guardado; error = verificación fallida.
	FinishAssertion(ctx context.Context, userID string, session, assertion []byte) error
}

// SecurityEventReporter reporta los eventos de la confirmación fuerte a `security`
// (STEP_UP_FAILED, PIN_LOCKED, PASSKEY_COUNTER_REGRESSION). Es opcional: lo implementa el cliente
// real de security además de SecurityReporter.
type SecurityEventReporter interface {
	ReportSecurityEvent(ctx context.Context, kind, userID string) error
}

// Tipos de evento de seguridad que reporta identity (security.proto ReportSecurityEventRequest.kind).
const (
	SecurityEventStepUpFailed             = "STEP_UP_FAILED"
	SecurityEventPinLocked                = "PIN_LOCKED"
	SecurityEventPasskeyCounterRegression = "PASSKEY_COUNTER_REGRESSION"
)

// WithStrongAuth activa la confirmación fuerte persistida (R32) con la política del PIN.
func (s *IdentityService) WithStrongAuth(st store.StrongAuthStore, pin domain.PinPolicy) *IdentityService {
	s.strong = st
	s.pinPolicy = pin
	return s
}

// WithPasskeyAuthenticator activa el método PASSKEY (R25).
func (s *IdentityService) WithPasskeyAuthenticator(p PasskeyAuthenticator) *IdentityService {
	s.passkeys = p
	return s
}

// StepUpChallengeInput es lo que la persona quiere confirmar.
type StepUpChallengeInput struct {
	Operation   string
	AmountMinor int64
	Currency    string
}

// StepUpChallengeView es el reto que ve la app: qué se confirma y con qué métodos (S-GEN-21).
type StepUpChallengeView struct {
	ID               string
	OptionsJSON      []byte
	Operation        string
	AmountMinor      int64
	Currency         string
	Level            int
	AllowedMethods   []string
	AvailableMethods []string
	ExpiresAt        time.Time
}

// VerifyStepUpInput es la prueba que envía la app. Nunca se registra.
type VerifyStepUpInput struct {
	ChallengeID string
	Method      string
	PIN         string
	Password    string
	Assertion   []byte
}

// StepUpTokenView es el token emitido (el único momento en que existe en claro).
type StepUpTokenView struct {
	Token     string
	ExpiresAt time.Time
	Method    string
}

// PinError lleva el estado del PIN junto al rechazo (la app lo muestra en S-GEN-21).
type PinError struct {
	Err               error
	AttemptsRemaining int
	LockedUntil       *time.Time
}

func (e *PinError) Error() string { return e.Err.Error() }
func (e *PinError) Unwrap() error { return e.Err }

// PinStatusView es el estado del PIN de la persona (GetStepUpPinStatus).
type PinStatusView struct {
	IsSet             bool
	AttemptsRemaining int
	LockedUntil       *time.Time
}

func (s *IdentityService) clock() time.Time { return s.now().UTC() }

// contextUser devuelve el usuario de los metadatos validados (R26); el cuerpo nunca cuenta.
func contextUser(ctx context.Context) (string, error) {
	if u := tenancy.UserIDFromContext(ctx); u != "" {
		return u, nil
	}
	return "", domain.ErrUnauthenticated
}

func (s *IdentityService) hasPasskeys(ctx context.Context, userID string) (bool, error) {
	if s.passkeys == nil {
		return false, nil
	}
	ok, err := s.passkeys.HasPasskeys(ctx, userID)
	if err != nil {
		return false, observability.Wrap(err, "check passkeys")
	}
	return ok, nil
}

// validCurrency acepta "" solo sin monto; con monto exige un código ISO 4217 de 3 letras.
func validCurrency(amount int64, currency string) bool {
	if amount == 0 && currency == "" {
		return true
	}
	if len(currency) != 3 {
		return false
	}
	for i := 0; i < 3; i++ {
		if currency[i] < 'A' || currency[i] > 'Z' {
			return false
		}
	}
	return true
}

// IssueStepUpChallenge crea un reto persistido ligado a la operación y dice qué métodos sirven (R27).
func (s *IdentityService) IssueStepUpChallenge(ctx context.Context, in StepUpChallengeInput) (*StepUpChallengeView, error) {
	if s.strong == nil {
		return nil, observability.Wrap(errors.New("strong auth store not configured"), "issue step-up challenge")
	}
	userID, err := contextUser(ctx)
	if err != nil {
		return nil, err
	}
	if in.Operation == "" || in.AmountMinor < 0 || !validCurrency(in.AmountMinor, in.Currency) {
		return nil, domain.ErrInvalidRequest
	}
	hasPasskey, err := s.hasPasskeys(ctx, userID)
	if err != nil {
		return nil, err
	}
	policy, err := domain.PolicyFor(in.Operation, hasPasskey)
	if err != nil {
		return nil, err
	}
	pin, err := s.strong.GetPin(ctx, userID)
	if err != nil {
		return nil, observability.Wrap(err, "load pin for challenge")
	}
	available := make([]string, 0, len(policy.Methods))
	for _, m := range policy.Methods {
		switch {
		case m == domain.MethodPasskey && hasPasskey,
			m == domain.MethodPIN && pin != nil,
			m == domain.MethodPassword:
			available = append(available, m)
		}
	}
	challenge := make([]byte, 32)
	if _, err := rand.Read(challenge); err != nil {
		return nil, observability.Wrap(err, "generate challenge")
	}
	var options, session []byte
	if hasPasskey && policy.Allows(domain.MethodPasskey) {
		if options, session, err = s.passkeys.BeginAssertion(ctx, userID, challenge); err != nil {
			return nil, observability.Wrap(err, "begin passkey assertion")
		}
	}
	now := s.clock()
	c := store.StepUpChallenge{
		ID: uuid.Must(uuid.NewV7()).String(), UserID: userID, Purpose: store.ChallengePurposeStepUp,
		Challenge: challenge, SessionData: session, Operation: in.Operation,
		AmountMinor: in.AmountMinor, Currency: in.Currency, ExpiresAt: now.Add(domain.StepUpTTL),
	}
	if err := s.strong.CreateChallenge(ctx, c); err != nil {
		return nil, observability.Wrap(err, "persist step-up challenge")
	}
	return &StepUpChallengeView{
		ID: c.ID, OptionsJSON: options, Operation: c.Operation, AmountMinor: c.AmountMinor, Currency: c.Currency,
		Level: policy.Level, AllowedMethods: policy.Methods, AvailableMethods: available, ExpiresAt: c.ExpiresAt,
	}, nil
}

// VerifyStepUp verifica la prueba en el servidor y emite el token (R25–R28). El reto solo se
// consume con una prueba válida: un PIN equivocado deja reintentar con el mismo reto hasta el bloqueo.
func (s *IdentityService) VerifyStepUp(ctx context.Context, in VerifyStepUpInput) (*StepUpTokenView, error) {
	if s.strong == nil {
		return nil, observability.Wrap(errors.New("strong auth store not configured"), "verify step-up")
	}
	userID, err := contextUser(ctx)
	if err != nil {
		return nil, err
	}
	now := s.clock()
	ch, err := s.strong.GetChallenge(ctx, in.ChallengeID, userID, now)
	if err != nil {
		if errors.Is(err, domain.ErrChallengeInvalid) {
			return nil, err
		}
		return nil, observability.Wrap(err, "load step-up challenge")
	}
	if ch.Purpose != store.ChallengePurposeStepUp {
		return nil, domain.ErrChallengeInvalid
	}
	method := in.Method
	if method == "" && len(in.Assertion) > 0 {
		method = domain.MethodPasskey // compatibilidad: VerifyStepUpRequest sin método y con aserción
	}
	hasPasskey, err := s.hasPasskeys(ctx, userID)
	if err != nil {
		return nil, err
	}
	policy, err := domain.PolicyFor(ch.Operation, hasPasskey)
	if err != nil {
		return nil, err
	}
	if !policy.Allows(method) {
		s.countStepUp(ch.Operation, "method_not_allowed")
		return nil, domain.ErrStepUpMethodNotAllowed
	}
	switch method {
	case domain.MethodPIN:
		err = s.verifyPIN(ctx, userID, in.PIN, now)
	case domain.MethodPassword:
		err = s.verifyStepUpPassword(ctx, userID, in.Password)
	case domain.MethodPasskey:
		err = s.verifyPasskey(ctx, userID, ch.SessionData, in.Assertion)
	}
	if err != nil {
		s.countStepUp(ch.Operation, "failed")
		// Una prueba equivocada es señal de abuso; un PIN sin crear o mal tecleado, no.
		if errors.Is(err, domain.ErrPinIncorrect) || errors.Is(err, domain.ErrStepUpPasswordIncorrect) ||
			errors.Is(err, domain.ErrPasskeyVerificationFailed) {
			s.reportSecurityEvent(ctx, SecurityEventStepUpFailed, userID)
		}
		return nil, err
	}
	if err := s.strong.ConsumeChallenge(ctx, ch.ID, userID, now); err != nil {
		if errors.Is(err, domain.ErrChallengeInvalid) {
			return nil, err // otra verificación concurrente ganó el reto
		}
		return nil, observability.Wrap(err, "consume step-up challenge")
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, observability.Wrap(err, "generate step-up token")
	}
	token := hex.EncodeToString(raw)
	expiresAt := now.Add(domain.StepUpTTL)
	binding := store.StepUpBinding{UserID: userID, Operation: ch.Operation, AmountMinor: ch.AmountMinor, Currency: ch.Currency}
	if err := s.strong.IssueToken(ctx, hashToken(token), binding, method, expiresAt); err != nil {
		return nil, observability.Wrap(err, "persist step-up token")
	}
	s.countStepUp(ch.Operation, "verified")
	return &StepUpTokenView{Token: token, ExpiresAt: expiresAt, Method: method}, nil
}

// verifyPIN aplica R28: formato, bloqueo, intentos y reinicio tras un acierto.
func (s *IdentityService) verifyPIN(ctx context.Context, userID, pin string, now time.Time) error {
	if err := domain.ValidatePIN(pin); err != nil {
		return err // mal formado: no se compara ni cuenta como intento
	}
	st, err := s.strong.GetPin(ctx, userID)
	if err != nil {
		return observability.Wrap(err, "load pin")
	}
	if st == nil {
		return domain.ErrPinNotSet
	}
	if st.LockedAt(now) {
		return &PinError{Err: domain.ErrPinLocked, LockedUntil: st.LockedUntil}
	}
	if auth.VerifyPassword(pin, st.Hash) {
		if st.FailedAttempts > 0 || st.LockedUntil != nil {
			if err := s.strong.ResetPinFailures(ctx, userID, now); err != nil {
				return observability.Wrap(err, "reset pin failures")
			}
		}
		return nil
	}
	next, err := s.strong.RecordPinFailure(ctx, userID, s.pinPolicy, now)
	if err != nil {
		return observability.Wrap(err, "record pin failure")
	}
	if next.LockedAt(now) {
		s.reportSecurityEvent(ctx, SecurityEventPinLocked, userID)
		return &PinError{Err: domain.ErrPinLocked, LockedUntil: next.LockedUntil}
	}
	return &PinError{Err: domain.ErrPinIncorrect, AttemptsRemaining: next.AttemptsRemaining(s.pinPolicy, now)}
}

// verifyStepUpPassword verifica la contraseña (nivel 3) con el mismo bloqueo progresivo del login
// (R5): la confirmación fuerte no es una vía para adivinar contraseñas.
func (s *IdentityService) verifyStepUpPassword(ctx context.Context, userID, password string) error {
	if s.attempts != nil {
		until, err := s.attempts.BlockedUntil(ctx, userID)
		if err != nil {
			return observability.Wrap(err, "check account lock")
		}
		if until != nil {
			return domain.ErrAccountLocked
		}
	}
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			return domain.ErrUnauthenticated
		}
		return observability.Wrap(err, "load user for step-up")
	}
	if !auth.VerifyPassword(password, user.PasswordHash) {
		if s.registerFailure(ctx, userID) {
			return domain.ErrAccountLocked
		}
		return domain.ErrStepUpPasswordIncorrect
	}
	if s.attempts != nil {
		if err := s.attempts.ResetFailures(ctx, userID); err != nil {
			return observability.Wrap(err, "reset login failures")
		}
	}
	return nil
}

func (s *IdentityService) verifyPasskey(ctx context.Context, userID string, session, assertion []byte) error {
	if s.passkeys == nil {
		return domain.ErrPasskeysUnavailable
	}
	if len(session) == 0 || len(assertion) == 0 {
		return domain.ErrPasskeyVerificationFailed
	}
	if err := s.passkeys.FinishAssertion(ctx, userID, session, assertion); err != nil {
		if errors.Is(err, domain.ErrPasskeyVerificationFailed) || errors.Is(err, domain.ErrPasskeysUnavailable) {
			return err
		}
		return observability.Wrap(err, "finish passkey assertion")
	}
	return nil
}

// ConsumeStepUp consume el token de forma atómica (R15, R32). Devuelve "" si fue válido o el
// motivo: NOT_FOUND, EXPIRED, ALREADY_USED o MISMATCH.
func (s *IdentityService) ConsumeStepUp(ctx context.Context, token string, b store.StepUpBinding) (string, error) {
	if s.strong == nil {
		return "", observability.Wrap(errors.New("strong auth store not configured"), "consume step-up")
	}
	if token == "" {
		return store.ConsumeNotFound, nil
	}
	reason, err := s.strong.ConsumeToken(ctx, hashToken(token), b, s.clock())
	if err != nil {
		return "", observability.Wrap(err, "consume step-up token")
	}
	if reason == "" {
		s.countStepUp(b.Operation, "consumed")
	} else {
		s.countStepUp(b.Operation, "rejected")
	}
	return reason, nil
}

// requireContextStepUp consume el token del contexto (x-pp-step-up) para una operación sin monto
// del propio identity (R14). Sin token → STEP_UP_REQUIRED; inválido → STEP_UP_INVALID.
func (s *IdentityService) requireContextStepUp(ctx context.Context, userID, operation string) error {
	token := tenancy.StepUpTokenFromContext(ctx)
	if token == "" {
		return domain.ErrStepUpRequired
	}
	if s.strong == nil {
		return domain.ErrStepUpInvalid
	}
	reason, err := s.ConsumeStepUp(ctx, token, store.StepUpBinding{UserID: userID, Operation: operation})
	if err != nil {
		return err
	}
	if reason != "" {
		return domain.ErrStepUpInvalid
	}
	return nil
}

// SetStepUpPin crea o cambia el PIN (R28). Exige el token de identity.pin.set (nivel 3: contraseña).
// El formato se valida antes de consumir el token para que un error de tecleo no lo gaste.
func (s *IdentityService) SetStepUpPin(ctx context.Context, pin string) error {
	if s.strong == nil {
		return observability.Wrap(errors.New("strong auth store not configured"), "set step-up pin")
	}
	userID, err := contextUser(ctx)
	if err != nil {
		return err
	}
	if err := domain.ValidatePIN(pin); err != nil {
		return err
	}
	if err := s.requireContextStepUp(ctx, userID, domain.OpPinSet); err != nil {
		return err
	}
	hash, err := auth.HashPassword(pin)
	if err != nil {
		return observability.Wrap(err, "hash pin")
	}
	if err := s.strong.SetPin(ctx, userID, hash, s.clock()); err != nil {
		return observability.Wrap(err, "save pin")
	}
	return nil
}

// GetStepUpPinStatus dice si la persona tiene PIN, cuántos intentos le quedan y si está bloqueado.
func (s *IdentityService) GetStepUpPinStatus(ctx context.Context) (*PinStatusView, error) {
	if s.strong == nil {
		return nil, observability.Wrap(errors.New("strong auth store not configured"), "get pin status")
	}
	userID, err := contextUser(ctx)
	if err != nil {
		return nil, err
	}
	st, err := s.strong.GetPin(ctx, userID)
	if err != nil {
		return nil, observability.Wrap(err, "load pin status")
	}
	if st == nil {
		return &PinStatusView{}, nil
	}
	now := s.clock()
	v := &PinStatusView{IsSet: true, AttemptsRemaining: st.AttemptsRemaining(s.pinPolicy, now)}
	if st.LockedAt(now) {
		v.LockedUntil = st.LockedUntil
	}
	return v, nil
}

// PurgeStepUp borra retos y tokens vencidos (lo llama el job horario de main).
func (s *IdentityService) PurgeStepUp(ctx context.Context, before time.Time) (int64, error) {
	if s.strong == nil {
		return 0, nil
	}
	n, err := s.strong.PurgeStepUp(ctx, before)
	if err != nil {
		return 0, observability.Wrap(err, "purge step-up")
	}
	return n, nil
}

func (s *IdentityService) countStepUp(operation, result string) {
	if s.metrics == nil {
		return
	}
	if !domain.IsCatalogOperation(operation) {
		operation = "unknown" // etiqueta acotada: nunca un texto que mande el cliente
	}
	s.metrics.Inc("pp_step_up_total", "operation", operation, "result", result)
}

// reportSecurityEvent avisa a security; un fallo del aviso se registra y no cambia la respuesta.
func (s *IdentityService) reportSecurityEvent(ctx context.Context, kind, userID string) {
	r, ok := s.security.(SecurityEventReporter)
	if !ok || r == nil {
		return
	}
	if err := r.ReportSecurityEvent(ctx, kind, userID); err != nil && s.reporter != nil {
		s.reporter.Dependency(ctx, "security event report failed", "security", observability.Wrap(err, fmt.Sprintf("report %s", kind)))
	}
}
