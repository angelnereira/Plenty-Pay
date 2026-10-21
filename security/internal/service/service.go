package service

import (
	"context"
	"fmt"
	"time"

	"plentypay/security/internal/domain"
	"plentypay/security/internal/store"
)

// SecurityService orquesta todas las operaciones de seguridad de la plataforma.
type SecurityService struct {
	secretStore store.SecretStore
	cryptoStore store.CryptoStore
	auditStore  store.AuditStore
	secStore    store.SecurityEventStore
	certStore   store.CertStore
}

func NewSecurityService(
	secretStore store.SecretStore,
	cryptoStore store.CryptoStore,
	auditStore store.AuditStore,
	secStore store.SecurityEventStore,
	certStore store.CertStore,
) *SecurityService {
	return &SecurityService{
		secretStore: secretStore,
		cryptoStore: cryptoStore,
		auditStore:  auditStore,
		secStore:    secStore,
		certStore:   certStore,
	}
}

// --- Gestión de Secretos (SPEC §4 y §5 R1, R2) ---

func (s *SecurityService) GetSecret(ctx context.Context, name, version, callerService string) (*domain.Secret, error) {
	sec, err := s.secretStore.Get(ctx, name, version)
	if err != nil {
		return nil, err
	}

	// Comprobar ACL por llamador (SPEC §5 R2).
	if len(sec.AllowedReaders) > 0 {
		allowed := false
		for _, r := range sec.AllowedReaders {
			if r == callerService || r == "*" {
				allowed = true
				break
			}
		}
		if !allowed && callerService != "platform" && callerService != "security" {
			return nil, domain.ErrPermissionDenied
		}
	}

	// Registrar auditoría de lectura (SPEC §4: "cada lectura auditada").
	_, _ = s.auditStore.Append(ctx, &domain.AuditEvent{
		Action:       "secret.read",
		ActorService: callerService,
		TargetKind:   "secret",
		TargetID:     name,
		Outcome:      "SUCCESS",
		OccurredAt:   time.Now().UTC(),
	}, "")

	return sec, nil
}

func (s *SecurityService) PutSecret(ctx context.Context, name string, value []byte, labels map[string]string, allowedReaders []string, idempotencyKey, callerService string) (*domain.SecretMetadata, error) {
	meta, err := s.secretStore.Put(ctx, &domain.Secret{
		Name:           name,
		Value:          value,
		Labels:         labels,
		AllowedReaders: allowedReaders,
	}, idempotencyKey)
	if err != nil {
		return nil, err
	}

	_, _ = s.auditStore.Append(ctx, &domain.AuditEvent{
		Action:       "secret.put",
		ActorService: callerService,
		TargetKind:   "secret",
		TargetID:     name,
		Outcome:      "SUCCESS",
		OccurredAt:   time.Now().UTC(),
	}, idempotencyKey)

	return meta, nil
}

func (s *SecurityService) RotateSecret(ctx context.Context, name string, newValue []byte, idempotencyKey, callerService string) (*domain.SecretMetadata, error) {
	meta, err := s.secretStore.Rotate(ctx, name, newValue, idempotencyKey)
	if err != nil {
		return nil, err
	}

	_, _ = s.auditStore.Append(ctx, &domain.AuditEvent{
		Action:       "secret.rotate",
		ActorService: callerService,
		TargetKind:   "secret",
		TargetID:     name,
		Outcome:      "SUCCESS",
		OccurredAt:   time.Now().UTC(),
	}, idempotencyKey)

	return meta, nil
}

func (s *SecurityService) ListSecrets(ctx context.Context, prefix string) ([]domain.SecretMetadata, error) {
	return s.secretStore.List(ctx, prefix)
}

// --- Envelope Encryption por Propósito (SPEC §4 y §5 R3, R7) ---

func (s *SecurityService) Encrypt(ctx context.Context, purpose string, plaintext, aad []byte) (*domain.EncryptedPayload, error) {
	if !domain.AllowedPurposes[purpose] {
		return nil, domain.ErrUnknownKeyPurpose
	}
	return s.cryptoStore.Encrypt(ctx, purpose, plaintext, aad)
}

func (s *SecurityService) Decrypt(ctx context.Context, purpose string, ciphertext, aad []byte, version string) ([]byte, error) {
	if !domain.AllowedPurposes[purpose] {
		return nil, domain.ErrUnknownKeyPurpose
	}
	return s.cryptoStore.Decrypt(ctx, purpose, ciphertext, aad, version)
}

func (s *SecurityService) RotateDataKey(ctx context.Context, purpose, idempotencyKey string) (string, error) {
	if !domain.AllowedPurposes[purpose] {
		return "", domain.ErrUnknownKeyPurpose
	}
	return s.cryptoStore.RotateKey(ctx, purpose, idempotencyKey)
}

// --- Auditoría Encadenada (SPEC §4 y §5 R4) ---

func (s *SecurityService) AppendAuditEvent(ctx context.Context, event *domain.AuditEvent, idempotencyKey string) (*domain.AuditEvent, error) {
	return s.auditStore.Append(ctx, event, idempotencyKey)
}

func (s *SecurityService) QueryAuditEvents(ctx context.Context, filter store.AuditFilter) ([]domain.AuditEvent, int, error) {
	return s.auditStore.Query(ctx, filter)
}

func (s *SecurityService) VerifyAuditChain(ctx context.Context, from, to time.Time) (bool, string, error) {
	return s.auditStore.VerifyChain(ctx, from, to)
}

// --- Eventos de Seguridad y Bloqueos (SPEC §4 y §5 R5) ---

func (s *SecurityService) ReportSecurityEvent(ctx context.Context, kind, subject, ipAddress string, severity int32, details map[string]string, idempotencyKey string) (bool, error) {
	if !domain.AllowedEventKinds[kind] {
		return false, domain.ErrUnknownEventKind
	}

	ev := &domain.SecurityEvent{
		Kind:       kind,
		Subject:    subject,
		IPAddress:  ipAddress,
		Severity:   severity,
		Details:    details,
		OccurredAt: time.Now().UTC(),
	}

	if err := s.secStore.RecordEvent(ctx, ev, idempotencyKey); err != nil {
		return false, err
	}

	now := time.Now().UTC()
	blocked := false

	switch kind {
	case domain.EventKindLoginFailed:
		// 20 LOGIN_FAILED por IP en 10 min -> bloqueo IP 1 h (R5)
		if ipAddress != "" {
			count, err := s.secStore.CountEvents(ctx, domain.EventKindLoginFailed, ipAddress, 10*time.Minute)
			if err == nil && count >= 20 {
				_ = s.secStore.SetBlock(ctx, &domain.Block{
					Subject: ipAddress,
					Kind:    "IP",
					Reason:  domain.EventKindLoginFailed,
					Until:   now.Add(1 * time.Hour),
				})
				blocked = true
			}
		}

	case domain.EventKindTokenReuse:
		// TOKEN_REUSE -> alerta + bloqueo de la cuenta hasta reset (R5)
		if subject != "" {
			_ = s.secStore.SetBlock(ctx, &domain.Block{
				Subject: subject,
				Kind:    "USER",
				Reason:  domain.EventKindTokenReuse,
				Until:   now.Add(100 * 365 * 24 * time.Hour),
			})
			blocked = true
		}

	case domain.EventKindVelocityExceeded:
		// VELOCITY_EXCEEDED -> bloqueo de pagos 1 h y revisión (R5)
		if subject != "" {
			_ = s.secStore.SetBlock(ctx, &domain.Block{
				Subject: subject,
				Kind:    "USER",
				Reason:  domain.EventKindVelocityExceeded,
				Until:   now.Add(1 * time.Hour),
			})
			blocked = true
		}

	case domain.EventKindPinLocked, domain.EventKindPasskeyCounterRegression:
		// Confirmación fuerte (ADR 0020): el evento queda registrado y genera una alerta auditada.
		// No bloquea la cuenta: identity ya bloqueó el PIN o rechazó la passkey.
		action := "security.alert.pin_locked"
		if kind == domain.EventKindPasskeyCounterRegression {
			action = "security.alert.passkey_counter_regression" // posible llave clonada: severidad alta
		}
		if _, err := s.auditStore.Append(ctx, &domain.AuditEvent{
			Action:     action,
			TargetKind: "user",
			TargetID:   subject,
			Outcome:    "ALERT",
			OccurredAt: now,
		}, ""); err != nil {
			return false, fmt.Errorf("append %s alert: %w", kind, err)
		}

	case domain.EventKindWebhookBadSignature:
		// > 10/min de un proveedor -> alerta (R5)
		if subject != "" {
			count, err := s.secStore.CountEvents(ctx, domain.EventKindWebhookBadSignature, subject, 1*time.Minute)
			if err == nil && count > 10 {
				_, _ = s.auditStore.Append(ctx, &domain.AuditEvent{
					Action:     "security.alert.webhook_abuse",
					TargetKind: "webhook_provider",
					TargetID:   subject,
					Outcome:    "ALERT",
					OccurredAt: now,
				}, "")
			}
		}
	}

	return blocked, nil
}

func (s *SecurityService) IsBlocked(ctx context.Context, subject, ipAddress string) (bool, string, time.Time, error) {
	b, err := s.secStore.GetBlock(ctx, subject, ipAddress)
	if err != nil {
		return false, "", time.Time{}, err
	}
	if b != nil {
		return true, b.Reason, b.Until, nil
	}
	return false, "", time.Time{}, nil
}

// --- Emisión de Certificados de Servicio (SPIFFE / mTLS) ---

func (s *SecurityService) IssueServiceCertificate(ctx context.Context, serviceName string, csrPEM []byte, bootstrapToken, idempotencyKey string) (*domain.ServiceCertificate, error) {
	return s.certStore.IssueCert(ctx, serviceName, csrPEM, bootstrapToken, idempotencyKey)
}
