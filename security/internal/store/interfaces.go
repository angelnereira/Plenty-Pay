package store

import (
	"context"
	"time"

	"plentypay/security/internal/domain"
)

// SecretStore maneja el ciclo de vida de los secretos en OpenBao / vault.
type SecretStore interface {
	Get(ctx context.Context, name, version string) (*domain.Secret, error)
	Put(ctx context.Context, secret *domain.Secret, idempotencyKey string) (*domain.SecretMetadata, error)
	Rotate(ctx context.Context, name string, newValue []byte, idempotencyKey string) (*domain.SecretMetadata, error)
	List(ctx context.Context, prefix string) ([]domain.SecretMetadata, error)
}

// CryptoStore maneja el cifrado de datos por propósito y la rotación de llaves (Transit).
type CryptoStore interface {
	Encrypt(ctx context.Context, purpose string, plaintext, aad []byte) (*domain.EncryptedPayload, error)
	Decrypt(ctx context.Context, purpose string, ciphertext, aad []byte, version string) ([]byte, error)
	RotateKey(ctx context.Context, purpose string, idempotencyKey string) (string, error)
}

// AuditFilter define los filtros de búsqueda de eventos de auditoría.
type AuditFilter struct {
	TenantID     string
	ActorUserID  string
	ActionPrefix string
	From         time.Time
	To           time.Time
	Limit        int
	Offset       int
}

// AuditStore maneja el almacenamiento inmutable y encadenado de auditoría.
type AuditStore interface {
	Append(ctx context.Context, event *domain.AuditEvent, idempotencyKey string) (*domain.AuditEvent, error)
	Query(ctx context.Context, filter AuditFilter) ([]domain.AuditEvent, int, error)
	VerifyChain(ctx context.Context, from, to time.Time) (bool, string, error)
}

// SecurityEventStore maneja el registro de eventos de abuso y el estado de bloqueos.
type SecurityEventStore interface {
	RecordEvent(ctx context.Context, ev *domain.SecurityEvent, idempotencyKey string) error
	CountEvents(ctx context.Context, kind, subjectOrIP string, window time.Duration) (int, error)
	SetBlock(ctx context.Context, block *domain.Block) error
	GetBlock(ctx context.Context, subject, ip string) (*domain.Block, error)
}

// CertStore maneja la emisión de certificados de servicio (SPIFFE / mTLS).
type CertStore interface {
	IssueCert(ctx context.Context, serviceName string, csrPEM []byte, bootstrapToken, idempotencyKey string) (*domain.ServiceCertificate, error)
}
