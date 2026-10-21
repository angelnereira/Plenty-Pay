package service_test

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/service"
	"plentypay/identity/internal/store"
	"plentypay/identity/internal/tenancy"
)

// Confirmación fuerte (ADR 0020): identity verifica el PIN o la contraseña y emite el token.

const testPIN = "482915"

var (
	pinHashOnce sync.Once
	pinHash     string
)

// testPinHash calcula una sola vez el hash del PIN de prueba (bcrypt costo 12 es lento a propósito).
func testPinHash() string {
	pinHashOnce.Do(func() {
		h, err := auth.HashPassword(testPIN)
		if err != nil {
			panic(err)
		}
		pinHash = h
	})
	return pinHash
}

// pinStepUpToken obtiene un token por el camino real: PIN guardado, reto y verificación en identity.
func pinStepUpToken(svc *service.IdentityService, strong *store.InMemoryStrongAuthStore, userID, op string, amount int64, cur string) string {
	ctx := tenancy.WithUser(context.Background(), userID)
	if err := strong.SetPin(ctx, userID, testPinHash(), time.Now()); err != nil {
		panic(err)
	}
	ch, err := svc.IssueStepUpChallenge(ctx, service.StepUpChallengeInput{Operation: op, AmountMinor: amount, Currency: cur})
	if err != nil {
		panic(err)
	}
	tok, err := svc.VerifyStepUp(ctx, service.VerifyStepUpInput{ChallengeID: ch.ID, Method: domain.MethodPIN, PIN: testPIN})
	if err != nil {
		panic(err)
	}
	return tok.Token
}

// eventReporter registra los eventos que identity manda a security.
type eventReporter struct {
	mu     sync.Mutex
	events []string
}

func (r *eventReporter) ReportTokenReuse(context.Context, string, string) error  { return nil }
func (r *eventReporter) ReportLoginFailed(context.Context, string, string) error { return nil }
func (r *eventReporter) ReportSecurityEvent(_ context.Context, kind, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, kind+":"+userID)
	return nil
}

func (r *eventReporter) has(event string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, e := range r.events {
		if e == event {
			return true
		}
	}
	return false
}

type stepUpFixture struct {
	svc     *service.IdentityService
	strong  *store.InMemoryStrongAuthStore
	events  *eventReporter
	metrics *observability.Metrics
	now     time.Time
	userID  string
	ctx     context.Context
}

func newStepUpFixture(t *testing.T) *stepUpFixture {
	t.Helper()
	fs := newFakeStore()
	tokens, err := auth.NewTokenIssuer("secreto-de-prueba-32-caracteres-ok", "otro-secreto-distinto-32-caracteres")
	if err != nil {
		t.Fatal(err)
	}
	f := &stepUpFixture{
		strong: store.NewInMemoryStrongAuthStore(), events: &eventReporter{},
		metrics: observability.NewMetrics("identity", "test", "none"),
		now:     time.Date(2026, 10, 20, 15, 0, 0, 0, time.UTC),
	}
	f.svc = service.New(fs, tokens, nil, f.metrics).
		WithClock(func() time.Time { return f.now }).
		WithSecurityReporter(f.events).
		WithStrongAuth(f.strong, domain.DefaultPinPolicy)
	f.userID = register(t, f.svc, "confirma-"+strings.ReplaceAll(t.Name(), "/", "-")+"@example.com").UserID
	f.ctx = tenancy.WithUser(context.Background(), f.userID)
	return f
}

func (f *stepUpFixture) setPin(t *testing.T) {
	t.Helper()
	if err := f.strong.SetPin(f.ctx, f.userID, testPinHash(), f.now); err != nil {
		t.Fatal(err)
	}
}

func (f *stepUpFixture) challenge(t *testing.T, op string, amount int64, cur string) *service.StepUpChallengeView {
	t.Helper()
	ch, err := f.svc.IssueStepUpChallenge(f.ctx, service.StepUpChallengeInput{Operation: op, AmountMinor: amount, Currency: cur})
	if err != nil {
		t.Fatalf("IssueStepUpChallenge(%s): %v", op, err)
	}
	return ch
}

func (f *stepUpFixture) verifyPIN(chID, pin string) (*service.StepUpTokenView, error) {
	return f.svc.VerifyStepUp(f.ctx, service.VerifyStepUpInput{ChallengeID: chID, Method: domain.MethodPIN, PIN: pin})
}

// R26: el reto es del usuario del contexto; sin usuario no hay reto y otra persona no puede usarlo.
func TestR26_ChallengeBelongsToContextUser(t *testing.T) {
	f := newStepUpFixture(t)
	f.setPin(t)
	if _, err := f.svc.IssueStepUpChallenge(context.Background(), service.StepUpChallengeInput{Operation: domain.OpPaymentsRefund}); !errors.Is(err, domain.ErrUnauthenticated) {
		t.Fatalf("sin usuario en el contexto: %v", err)
	}
	ch := f.challenge(t, domain.OpPaymentsRefund, 1500, "USD")
	other := tenancy.WithUser(context.Background(), "otra-persona")
	_, err := f.svc.VerifyStepUp(other, service.VerifyStepUpInput{ChallengeID: ch.ID, Method: domain.MethodPIN, PIN: testPIN})
	if !errors.Is(err, domain.ErrChallengeInvalid) {
		t.Fatalf("el reto de otra persona debe ser TOKEN_INVALID: %v", err)
	}
	if _, err := f.verifyPIN(ch.ID, testPIN); err != nil {
		t.Fatalf("el dueño del reto sí lo verifica: %v", err)
	}
}

// R27: operación fuera del catálogo y montos inválidos se rechazan antes de crear el reto.
func TestR27_UnknownOperationAndInvalidAmount(t *testing.T) {
	f := newStepUpFixture(t)
	if _, err := f.svc.IssueStepUpChallenge(f.ctx, service.StepUpChallengeInput{Operation: "payout.confirm"}); !errors.Is(err, domain.ErrUnknownOperation) {
		t.Fatalf("operación desconocida: %v", err)
	}
	for _, in := range []service.StepUpChallengeInput{
		{Operation: domain.OpPaymentsRefund, AmountMinor: -1, Currency: "USD"},
		{Operation: domain.OpPaymentsRefund, AmountMinor: 100, Currency: "usd"},
		{Operation: domain.OpPaymentsRefund, AmountMinor: 100},
		{},
	} {
		if _, err := f.svc.IssueStepUpChallenge(f.ctx, in); !errors.Is(err, domain.ErrInvalidRequest) {
			t.Fatalf("%+v debe ser INVALID_REQUEST: %v", in, err)
		}
	}
}

// R27: el reto devuelve lo que se confirma y los métodos permitidos y disponibles.
func TestR27_ChallengeListsAllowedAndAvailableMethods(t *testing.T) {
	f := newStepUpFixture(t)
	ch := f.challenge(t, domain.OpPaymentsRefund, 2500, "USD")
	if ch.Operation != domain.OpPaymentsRefund || ch.AmountMinor != 2500 || ch.Currency != "USD" || ch.Level != 2 {
		t.Fatalf("el reto debe repetir operación, monto y nivel: %+v", ch)
	}
	if strings.Join(ch.AllowedMethods, ",") != "PASSKEY,PIN" || len(ch.AvailableMethods) != 0 {
		t.Fatalf("sin PIN ni passkey no hay métodos disponibles: %+v", ch)
	}
	if !ch.ExpiresAt.Equal(f.now.Add(5 * time.Minute)) {
		t.Fatalf("el reto vence en 5 min: %v", ch.ExpiresAt)
	}
	f.setPin(t)
	if ch := f.challenge(t, domain.OpPaymentsRefund, 2500, "USD"); strings.Join(ch.AvailableMethods, ",") != "PIN" {
		t.Fatalf("con PIN, el PIN está disponible: %+v", ch.AvailableMethods)
	}
	if ch := f.challenge(t, domain.OpPinSet, 0, ""); ch.Level != 3 || strings.Join(ch.AvailableMethods, ",") != "PASSWORD" {
		t.Fatalf("identity.pin.set es nivel 3 con contraseña: %+v", ch)
	}
	if ch := f.challenge(t, domain.OpPasskeyRegister, 0, ""); ch.Level != 3 {
		t.Fatalf("la primera passkey exige la contraseña: %+v", ch)
	}
}

// R27: el PIN nunca autoriza identity.pin.set y la contraseña no vale en nivel 2.
func TestR27_MethodNotInCatalogIsRejected(t *testing.T) {
	f := newStepUpFixture(t)
	f.setPin(t)
	ch := f.challenge(t, domain.OpPinSet, 0, "")
	if _, err := f.verifyPIN(ch.ID, testPIN); !errors.Is(err, domain.ErrStepUpMethodNotAllowed) {
		t.Fatalf("el PIN no cambia el PIN: %v", err)
	}
	ch = f.challenge(t, domain.OpPaymentsRefund, 100, "USD")
	_, err := f.svc.VerifyStepUp(f.ctx, service.VerifyStepUpInput{ChallengeID: ch.ID, Method: domain.MethodPassword, Password: "una-clave-muy-larga"})
	if !errors.Is(err, domain.ErrStepUpMethodNotAllowed) {
		t.Fatalf("la contraseña solo vale en nivel 3: %v", err)
	}
	// Sin método ni aserción (lo que mandaba la app antes de ADR 0020) ya no emite token.
	if _, err := f.svc.VerifyStepUp(f.ctx, service.VerifyStepUpInput{ChallengeID: ch.ID}); !errors.Is(err, domain.ErrStepUpMethodNotAllowed) {
		t.Fatalf("una verificación sin prueba no emite token: %v", err)
	}
	if f.metrics.Value("pp_step_up_total", "operation", domain.OpPaymentsRefund, "result", "method_not_allowed") != 2 {
		t.Fatal("cada método rechazado cuenta en pp_step_up_total")
	}
}

// R25: sin autenticador WebAuthn configurado (WEBAUTHN_RP_ID vacío) la passkey no está disponible.
func TestR25_PasskeyUnavailableWithoutRelyingParty(t *testing.T) {
	f := newStepUpFixture(t)
	ch := f.challenge(t, domain.OpPaymentsRefund, 100, "USD")
	_, err := f.svc.VerifyStepUp(f.ctx, service.VerifyStepUpInput{ChallengeID: ch.ID, Method: domain.MethodPasskey, Assertion: []byte(`{"id":"x"}`)})
	if !errors.Is(err, domain.ErrPasskeysUnavailable) {
		t.Fatalf("sin relying party: %v", err)
	}
}

// R28: sin PIN → PIN_NOT_SET; formato inválido → PIN_INVALID sin contar intento.
func TestR28_PinNotSetAndBadFormat(t *testing.T) {
	f := newStepUpFixture(t)
	ch := f.challenge(t, domain.OpPaymentsRefund, 100, "USD")
	if _, err := f.verifyPIN(ch.ID, testPIN); !errors.Is(err, domain.ErrPinNotSet) {
		t.Fatalf("sin PIN: %v", err)
	}
	f.setPin(t)
	for _, bad := range []string{"", "12345", "1234567", "12a456", "１２３４５６"} {
		if _, err := f.verifyPIN(ch.ID, bad); !errors.Is(err, domain.ErrPinFormat) {
			t.Fatalf("%q debe ser PIN_INVALID por formato: %v", bad, err)
		}
	}
	st, _ := f.svc.GetStepUpPinStatus(f.ctx)
	if st.AttemptsRemaining != 3 {
		t.Fatalf("un formato inválido no cuenta como intento: %+v", st)
	}
}

// R28: 3 PIN equivocados bloquean 5 minutos y avisan a security; al vencer, un acierto reinicia.
func TestR28_WrongPinLocksAndReportsToSecurity(t *testing.T) {
	f := newStepUpFixture(t)
	f.setPin(t)
	ch := f.challenge(t, domain.OpPaymentsRefund, 100, "USD")
	for i, want := range []int{2, 1} {
		_, err := f.verifyPIN(ch.ID, "000000")
		var pe *service.PinError
		if !errors.As(err, &pe) || !errors.Is(err, domain.ErrPinIncorrect) || pe.AttemptsRemaining != want {
			t.Fatalf("intento %d: se esperaba PIN_INVALID con %d intentos: %v %+v", i+1, want, err, pe)
		}
	}
	_, err := f.verifyPIN(ch.ID, "000000")
	if !errors.Is(err, domain.ErrPinLocked) {
		t.Fatalf("el tercer error bloquea: %v", err)
	}
	if !f.events.has("PIN_LOCKED:"+f.userID) || !f.events.has("STEP_UP_FAILED:"+f.userID) {
		t.Fatalf("security recibe PIN_LOCKED y STEP_UP_FAILED: %v", f.events.events)
	}
	if _, err := f.verifyPIN(ch.ID, testPIN); !errors.Is(err, domain.ErrPinLocked) {
		t.Fatalf("bloqueado, ni el PIN correcto entra: %v", err)
	}
	st, _ := f.svc.GetStepUpPinStatus(f.ctx)
	if !st.IsSet || st.LockedUntil == nil || !st.LockedUntil.Equal(f.now.Add(5*time.Minute)) {
		t.Fatalf("el estado muestra el bloqueo de 5 min: %+v", st)
	}
	f.now = f.now.Add(5 * time.Minute)
	ch = f.challenge(t, domain.OpPaymentsRefund, 100, "USD")
	if _, err := f.verifyPIN(ch.ID, testPIN); err != nil {
		t.Fatalf("vencido el bloqueo, el PIN correcto entra: %v", err)
	}
	if st, _ := f.svc.GetStepUpPinStatus(f.ctx); st.AttemptsRemaining != 3 || st.LockedUntil != nil {
		t.Fatalf("un acierto reinicia el contador: %+v", st)
	}
}

// R28: un PIN equivocado no gasta el reto; un acierto lo consume (un solo uso).
func TestR28_WrongPinKeepsChallengeAndSuccessConsumesIt(t *testing.T) {
	f := newStepUpFixture(t)
	f.setPin(t)
	ch := f.challenge(t, domain.OpPaymentsRefund, 100, "USD")
	if _, err := f.verifyPIN(ch.ID, "111111"); !errors.Is(err, domain.ErrPinIncorrect) {
		t.Fatalf("PIN equivocado: %v", err)
	}
	if _, err := f.verifyPIN(ch.ID, testPIN); err != nil {
		t.Fatalf("el mismo reto sirve tras un error: %v", err)
	}
	if _, err := f.verifyPIN(ch.ID, testPIN); !errors.Is(err, domain.ErrChallengeInvalid) {
		t.Fatalf("un reto verificado no se reutiliza: %v", err)
	}
}

// R28 y R27: crear el PIN exige un token de identity.pin.set obtenido con la contraseña; un
// formato inválido no gasta el token.
func TestR28_SetPinRequiresPasswordStepUp(t *testing.T) {
	f := newStepUpFixture(t)
	if err := f.svc.SetStepUpPin(f.ctx, testPIN); !errors.Is(err, domain.ErrStepUpRequired) {
		t.Fatalf("sin token: %v", err)
	}
	ch := f.challenge(t, domain.OpPinSet, 0, "")
	_, err := f.svc.VerifyStepUp(f.ctx, service.VerifyStepUpInput{ChallengeID: ch.ID, Method: domain.MethodPassword, Password: "no-es-la-clave-123"})
	if !errors.Is(err, domain.ErrStepUpPasswordIncorrect) || !f.events.has("STEP_UP_FAILED:"+f.userID) {
		t.Fatalf("contraseña equivocada: %v %v", err, f.events.events)
	}
	tok, err := f.svc.VerifyStepUp(f.ctx, service.VerifyStepUpInput{ChallengeID: ch.ID, Method: domain.MethodPassword, Password: "una-clave-muy-larga"})
	if err != nil || tok.Method != domain.MethodPassword {
		t.Fatalf("la contraseña correcta emite el token: %v %+v", err, tok)
	}
	ctx := tenancy.WithStepUpToken(f.ctx, tok.Token)
	if err := f.svc.SetStepUpPin(ctx, "12345"); !errors.Is(err, domain.ErrPinFormat) {
		t.Fatalf("formato inválido: %v", err)
	}
	if err := f.svc.SetStepUpPin(ctx, testPIN); err != nil {
		t.Fatalf("el token sigue sirviendo tras un formato inválido: %v", err)
	}
	if err := f.svc.SetStepUpPin(ctx, "135790"); !errors.Is(err, domain.ErrStepUpInvalid) {
		t.Fatalf("el token es de un solo uso: %v", err)
	}
	if st, _ := f.svc.GetStepUpPinStatus(f.ctx); !st.IsSet || st.AttemptsRemaining != 3 {
		t.Fatalf("el PIN queda creado: %+v", st)
	}
	// Un token de otra operación no crea el PIN.
	other := tenancy.WithStepUpToken(f.ctx, pinStepUpToken(f.svc, f.strong, f.userID, domain.OpPaymentsRefund, 0, ""))
	if err := f.svc.SetStepUpPin(other, "135790"); !errors.Is(err, domain.ErrStepUpInvalid) {
		t.Fatalf("un token de otra operación: %v", err)
	}
}

// R15 y R32: el token es de un uso, 5 minutos, y solo para su usuario, operación, monto y moneda.
func TestR15_TokenSingleUseAndBound(t *testing.T) {
	f := newStepUpFixture(t)
	token := pinStepUpToken(f.svc, f.strong, f.userID, domain.OpPaymentsRefund, 5000, "USD")
	good := store.StepUpBinding{UserID: f.userID, Operation: domain.OpPaymentsRefund, AmountMinor: 5000, Currency: "USD"}
	for _, b := range []store.StepUpBinding{
		{UserID: "otra-persona", Operation: good.Operation, AmountMinor: 5000, Currency: "USD"},
		{UserID: f.userID, Operation: domain.OpWalletTransfer, AmountMinor: 5000, Currency: "USD"},
		{UserID: f.userID, Operation: good.Operation, AmountMinor: 4999, Currency: "USD"},
		{UserID: f.userID, Operation: good.Operation, AmountMinor: 5000, Currency: "PAB"},
	} {
		if r, err := f.svc.ConsumeStepUp(f.ctx, token, b); err != nil || r != store.ConsumeMismatch {
			t.Fatalf("%+v debe ser MISMATCH sin consumir: %q %v", b, r, err)
		}
	}
	if r, _ := f.svc.ConsumeStepUp(f.ctx, token, good); r != "" {
		t.Fatalf("la vinculación exacta consume: %q", r)
	}
	if r, _ := f.svc.ConsumeStepUp(f.ctx, token, good); r != store.ConsumeAlreadyUsed {
		t.Fatalf("segundo consumo: %q", r)
	}
	if r, _ := f.svc.ConsumeStepUp(f.ctx, "no-existe", good); r != store.ConsumeNotFound {
		t.Fatalf("token desconocido: %q", r)
	}
	late := pinStepUpToken(f.svc, f.strong, f.userID, domain.OpPaymentsRefund, 5000, "USD")
	f.now = f.now.Add(5 * time.Minute)
	if r, _ := f.svc.ConsumeStepUp(f.ctx, late, good); r != store.ConsumeExpired {
		t.Fatalf("a los 5 min vence: %q", r)
	}
}

// Nada sensible en errores ni métricas: el PIN y la contraseña nunca aparecen.
func TestObs_StepUpSecretsNeverInErrors(t *testing.T) {
	f := newStepUpFixture(t)
	f.setPin(t)
	ch := f.challenge(t, domain.OpPaymentsRefund, 100, "USD")
	_, err := f.verifyPIN(ch.ID, "975310")
	if err == nil || strings.Contains(err.Error(), "975310") {
		t.Fatalf("el error no lleva el PIN: %v", err)
	}
	ch = f.challenge(t, domain.OpPinSet, 0, "")
	_, err = f.svc.VerifyStepUp(f.ctx, service.VerifyStepUpInput{ChallengeID: ch.ID, Method: domain.MethodPassword, Password: "clave-secreta-filtrable"})
	if err == nil || strings.Contains(err.Error(), "clave-secreta-filtrable") {
		t.Fatalf("el error no lleva la contraseña: %v", err)
	}
	if f.metrics.Value("pp_step_up_total", "operation", domain.OpPaymentsRefund, "result", "failed") != 1 {
		t.Fatal("la verificación fallida cuenta en pp_step_up_total")
	}
}
