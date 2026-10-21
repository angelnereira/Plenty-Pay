package domain

import (
	"errors"
	"slices"
	"time"
)

// Métodos de confirmación fuerte (ADR 0020, security-standards.md §4.1). La biometría no es un
// método: solo libera la passkey en el dispositivo y su resultado nunca llega al servidor.
const (
	MethodPasskey  = "PASSKEY"
	MethodPIN      = "PIN"
	MethodPassword = "PASSWORD"
)

// Operaciones de confirmación fuerte. El nombre es el que el servicio consume en ConsumeStepUp.
const (
	OpPaymentsIntentCreate        = "payments.intent.create"
	OpPaymentsIntentConfirm       = "payments.intent.confirm"
	OpPaymentsRefund              = "payments.refund"
	OpWalletTransfer              = "wallet.transfer"
	OpPosSaleVoid                 = "pos.sale.void"
	OpPayrollRunApprove           = "payroll.run.approve"
	OpPayrollRunPay               = "payroll.run.pay"
	OpSettlementDestinationUpdate = "settlement.destination.update"
	OpSecurityCredentialsUpdate   = "security.credentials.update"
	OpRoleUpsert                  = "identity.role.upsert"
	OpStaffInvite                 = "identity.staff.invite"
	OpMembershipUpdate            = "identity.membership.update"
	OpCapabilitiesSet             = "identity.capabilities.set"
	OpPasswordChange              = "identity.password.change"
	OpEmailChange                 = "identity.email.change"
	OpPhoneChange                 = "identity.phone.change"
	OpDataExport                  = "identity.data.export"
	OpPasskeyRegister             = "identity.passkey.register"
	OpPasskeyRevoke               = "identity.passkey.revoke"
	OpPinSet                      = "identity.pin.set"
)

// StepUpPolicy es la fila del catálogo que aplica a una operación (R27).
type StepUpPolicy struct {
	Operation string
	Level     int      // 2 confirmación fuerte · 3 reautenticación
	Methods   []string // en orden de preferencia
}

// Allows dice si el método está permitido para la operación.
func (p StepUpPolicy) Allows(method string) bool { return slices.Contains(p.Methods, method) }

var levelTwo = []string{MethodPasskey, MethodPIN}

// stepUpCatalog copia security-standards.md §4.1. identity.passkey.register no está aquí: su nivel
// depende de si la persona ya tiene otra passkey (PolicyFor).
var stepUpCatalog = map[string]StepUpPolicy{}

func init() {
	for _, op := range []string{
		OpPaymentsIntentCreate, OpPaymentsIntentConfirm, OpPaymentsRefund, OpWalletTransfer, OpPosSaleVoid,
		OpPayrollRunApprove, OpPayrollRunPay, OpSettlementDestinationUpdate, OpSecurityCredentialsUpdate,
		OpRoleUpsert, OpStaffInvite, OpMembershipUpdate, OpCapabilitiesSet, OpPasswordChange,
		OpEmailChange, OpPhoneChange, OpDataExport, OpPasskeyRevoke,
	} {
		stepUpCatalog[op] = StepUpPolicy{Operation: op, Level: 2, Methods: levelTwo}
	}
	// El PIN nunca se cambia con el propio PIN (R27).
	stepUpCatalog[OpPinSet] = StepUpPolicy{Operation: OpPinSet, Level: 3, Methods: []string{MethodPassword}}
}

// PolicyFor devuelve la política de la operación. hasPasskey solo cambia identity.passkey.register:
// la primera passkey exige la contraseña; con otra ya registrada vale también el nivel 2.
func PolicyFor(operation string, hasPasskey bool) (StepUpPolicy, error) {
	if operation == OpPasskeyRegister {
		if hasPasskey {
			return StepUpPolicy{Operation: operation, Level: 2, Methods: []string{MethodPasskey, MethodPIN, MethodPassword}}, nil
		}
		return StepUpPolicy{Operation: operation, Level: 3, Methods: []string{MethodPassword}}, nil
	}
	p, ok := stepUpCatalog[operation]
	if !ok {
		return StepUpPolicy{}, ErrUnknownOperation
	}
	return p, nil
}

// IsCatalogOperation dice si la operación existe (sirve para acotar etiquetas de métricas).
func IsCatalogOperation(operation string) bool {
	_, err := PolicyFor(operation, false)
	return err == nil
}

// StepUpTTL es la vigencia del reto y del token (R15).
const StepUpTTL = 5 * time.Minute

// PINLength es el largo del PIN de confirmación (R28).
const PINLength = 6

// ValidatePIN exige exactamente 6 dígitos ASCII (R28).
func ValidatePIN(pin string) error {
	if len(pin) != PINLength {
		return ErrPinFormat
	}
	for i := 0; i < len(pin); i++ {
		if pin[i] < '0' || pin[i] > '9' {
			return ErrPinFormat
		}
	}
	return nil
}

// PinPolicy son los intentos y el bloqueo del PIN (`stepup.pin.max_attempts`,
// `stepup.pin.lock_minutes`): configuración de riesgo, no una constante legal.
type PinPolicy struct {
	MaxAttempts int
	LockFor     time.Duration
}

// DefaultPinPolicy es el respaldo local (identity/SPEC.md §8: 3 intentos, 5 minutos).
var DefaultPinPolicy = PinPolicy{MaxAttempts: 3, LockFor: 5 * time.Minute}

// PinState es el estado guardado del PIN de una persona.
type PinState struct {
	Hash           string
	FailedAttempts int
	LockedUntil    *time.Time
}

// LockedAt dice si el PIN está bloqueado en el instante dado.
func (s PinState) LockedAt(now time.Time) bool {
	return s.LockedUntil != nil && now.Before(*s.LockedUntil)
}

// AttemptsRemaining devuelve cuántos intentos quedan antes del bloqueo.
func (s PinState) AttemptsRemaining(p PinPolicy, now time.Time) int {
	if s.LockedAt(now) {
		return 0
	}
	failed := s.FailedAttempts
	if s.LockedUntil != nil { // el bloqueo anterior ya venció: el contador vuelve a empezar
		failed = 0
	}
	if r := p.MaxAttempts - failed; r > 0 {
		return r
	}
	return 0
}

// AfterFailure calcula el estado tras un PIN incorrecto: suma un intento y, al llegar al máximo,
// bloquea durante LockFor (R28). Un bloqueo ya vencido reinicia el contador.
func (s PinState) AfterFailure(p PinPolicy, now time.Time) PinState {
	next := s
	if s.LockedUntil != nil && !now.Before(*s.LockedUntil) {
		next.FailedAttempts = 0
		next.LockedUntil = nil
	}
	next.FailedAttempts++
	if next.FailedAttempts >= p.MaxAttempts {
		until := now.Add(p.LockFor)
		next.LockedUntil = &until
	}
	return next
}

// Errores de la confirmación fuerte (identity/SPEC.md §4, R25–R28).
var (
	ErrUnknownOperation          = errors.New("operación fuera del catálogo de confirmación fuerte")
	ErrStepUpMethodNotAllowed    = errors.New("ese método no está permitido para esta operación")
	ErrChallengeInvalid          = errors.New("el reto no existe, venció, ya se usó o es de otra persona")
	ErrPinNotSet                 = errors.New("la persona no tiene PIN de confirmación")
	ErrPinFormat                 = errors.New("el PIN debe tener 6 dígitos")
	ErrPinIncorrect              = errors.New("PIN incorrecto")
	ErrPinLocked                 = errors.New("PIN bloqueado por demasiados intentos")
	ErrPasskeysUnavailable       = errors.New("las passkeys no están disponibles")
	ErrPasskeyVerificationFailed = errors.New("no se pudo verificar la passkey")
	ErrStepUpPasswordIncorrect   = errors.New("contraseña incorrecta")
)
