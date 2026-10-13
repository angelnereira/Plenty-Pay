package domain

import (
	"errors"
	"time"
)

// Errores de dominio (grpc-conventions.md §4 y SPEC §4).
var (
	ErrNotFound              = errors.New("not found")
	ErrPermissionDenied      = errors.New("permission denied")
	ErrUnknownKeyPurpose     = errors.New("unknown key purpose")
	ErrAADMismatch           = errors.New("associated data mismatch")
	ErrIdempotencyKeyReused  = errors.New("idempotency key reused")
	ErrUnknownEventKind      = errors.New("unknown event kind")
	ErrBootstrapTokenInvalid = errors.New("bootstrap token invalid")
	ErrAuditChainBroken      = errors.New("audit chain broken")
	ErrInvalidInput          = errors.New("invalid input")
)

// Propósitos de cifrado válidos (SPEC §5 R3).
const (
	PurposeNationalID       = "national_id"
	PurposePayoutDestination = "payout_destination"
	PurposeBiometricTemplate = "biometric_template"
	PurposeTaxID             = "tax_id"
	PurposePACCredentials    = "pac_credentials"
)

// AllowedPurposes lista los propósitos autorizados de envelope encryption.
var AllowedPurposes = map[string]bool{
	PurposeNationalID:       true,
	PurposePayoutDestination: true,
	PurposeBiometricTemplate: true,
	PurposeTaxID:             true,
	PurposePACCredentials:    true,
}

// Kinds de eventos de seguridad (SPEC §4 y §5 R5).
const (
	EventKindLoginFailed         = "LOGIN_FAILED"
	EventKindTokenReuse          = "TOKEN_REUSE"
	EventKindVelocityExceeded    = "VELOCITY_EXCEEDED"
	EventKindWebhookBadSignature = "WEBHOOK_BAD_SIGNATURE"
)

// AllowedEventKinds lista los tipos válidos de SecurityEvent.
var AllowedEventKinds = map[string]bool{
	EventKindLoginFailed:         true,
	EventKindTokenReuse:          true,
	EventKindVelocityExceeded:    true,
	EventKindWebhookBadSignature: true,
}

// Secret representa un secreto almacenado en OpenBao / vault.
type Secret struct {
	Name           string
	Version        string
	Value          []byte
	AllowedReaders []string
	Labels         map[string]string
	CreatedAt      time.Time
}

// ZeroValue sobrescribe el valor del secreto en memoria (SPEC §5 R1).
func (s *Secret) ZeroValue() {
	if s.Value != nil {
		for i := range s.Value {
			s.Value[i] = 0
		}
	}
}

// SecretMetadata representa los metadatos de un secreto, sin su valor.
type SecretMetadata struct {
	Name           string
	Version        string
	AllowedReaders []string
	Labels         map[string]string
	CreatedAt      time.Time
}

// EncryptedPayload representa el resultado de Encrypt con Transit.
type EncryptedPayload struct {
	Ciphertext []byte
	KeyVersion string
}

// AuditEvent representa un evento de auditoría encadenado e inmutable (SPEC §5 R4).
type AuditEvent struct {
	EventID      string
	TenantID     string
	ActorUserID  string
	ActorRole    string
	ActorService string
	Action       string
	TargetKind   string
	TargetID     string
	Outcome      string
	IPAddress    string
	RequestID    string
	Details      map[string]string
	PrevHash     []byte
	Hash         []byte
	OccurredAt   time.Time
}

// SecurityEvent representa un evento reportado para análisis de seguridad y bloqueo.
type SecurityEvent struct {
	Kind       string
	Subject    string
	IPAddress  string
	Severity   int32
	Details    map[string]string
	OccurredAt time.Time
}

// Block representa un bloqueo activo de un subject o IP.
type Block struct {
	Subject string
	Kind    string
	Reason  string
	Until   time.Time
}

// ServiceCertificate representa un certificado emitido para mTLS/SPIFFE.
type ServiceCertificate struct {
	ServiceName    string
	CertificatePEM []byte
	CABundlePEM    []byte
	ExpiresAt      time.Time
}
