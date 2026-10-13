package store

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"io"
	"math/big"
	"strconv"
	"strings"
	"sync"
	"time"

	"plentypay/security/internal/domain"
)

// MemoryStore implementa todas las interfaces de almacenamiento en memoria para pruebas L1/L2.
type MemoryStore struct {
	mu sync.RWMutex

	// Secretos
	secrets        map[string]map[string]*domain.Secret // name -> version -> Secret
	secretMetadata map[string]*domain.SecretMetadata   // name -> latest metadata
	secretVersions map[string]int                      // name -> latest version number
	secretIdem     map[string]*domain.SecretMetadata   // idempotency_key -> metadata

	// Transit Crypto
	cryptoKeys    map[string]map[string][]byte // purpose -> version -> 32-byte AES key
	activeVersion map[string]int               // purpose -> active version
	cryptoIdem    map[string]string            // idempotency_key -> version

	// Auditoría
	auditEvents []domain.AuditEvent
	auditIdem   map[string]*domain.AuditEvent

	// Eventos de seguridad y bloqueos
	securityEvents []domain.SecurityEvent
	secIdem        map[string]bool
	blocks         map[string]*domain.Block // subjectOrIP -> Block

	// PKI / Certificados
	bootstrapToken string
	certIdem       map[string]*domain.ServiceCertificate
}

// NewMemoryStore inicializa el store en memoria con llaves transit para los propósitos permitidos.
func NewMemoryStore(bootstrapToken string) *MemoryStore {
	m := &MemoryStore{
		secrets:        make(map[string]map[string]*domain.Secret),
		secretMetadata: make(map[string]*domain.SecretMetadata),
		secretVersions: make(map[string]int),
		secretIdem:     make(map[string]*domain.SecretMetadata),

		cryptoKeys:    make(map[string]map[string][]byte),
		activeVersion: make(map[string]int),
		cryptoIdem:    make(map[string]string),

		auditEvents: make([]domain.AuditEvent, 0),
		auditIdem:   make(map[string]*domain.AuditEvent),

		securityEvents: make([]domain.SecurityEvent, 0),
		secIdem:        make(map[string]bool),
		blocks:         make(map[string]*domain.Block),

		bootstrapToken: bootstrapToken,
		certIdem:       make(map[string]*domain.ServiceCertificate),
	}

	// Inicializar versión 1 para cada propósito permitido (SPEC §5 R3)
	for purpose := range domain.AllowedPurposes {
		key := make([]byte, 32)
		if _, err := io.ReadFull(rand.Reader, key); err != nil {
			panic(err)
		}
		m.cryptoKeys[purpose] = map[string][]byte{"1": key}
		m.activeVersion[purpose] = 1
	}

	return m
}

// --- SecretStore ---

func (m *MemoryStore) Get(_ context.Context, name, version string) (*domain.Secret, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	versions, ok := m.secrets[name]
	if !ok || len(versions) == 0 {
		return nil, domain.ErrNotFound
	}

	if version == "" {
		version = strconv.Itoa(m.secretVersions[name])
	}

	sec, ok := versions[version]
	if !ok {
		return nil, domain.ErrNotFound
	}

	valCopy := make([]byte, len(sec.Value))
	copy(valCopy, sec.Value)
	readersCopy := append([]string(nil), sec.AllowedReaders...)
	labelsCopy := make(map[string]string, len(sec.Labels))
	for k, v := range sec.Labels {
		labelsCopy[k] = v
	}

	return &domain.Secret{
		Name:           sec.Name,
		Version:        sec.Version,
		Value:          valCopy,
		AllowedReaders: readersCopy,
		Labels:         labelsCopy,
		CreatedAt:      sec.CreatedAt,
	}, nil
}

func (m *MemoryStore) Put(_ context.Context, secret *domain.Secret, idempotencyKey string) (*domain.SecretMetadata, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if idempotencyKey != "" {
		if meta, ok := m.secretIdem[idempotencyKey]; ok {
			return meta, nil
		}
	}

	nextVer := m.secretVersions[secret.Name] + 1
	verStr := strconv.Itoa(nextVer)
	m.secretVersions[secret.Name] = nextVer

	if m.secrets[secret.Name] == nil {
		m.secrets[secret.Name] = make(map[string]*domain.Secret)
	}

	valCopy := make([]byte, len(secret.Value))
	copy(valCopy, secret.Value)
	readersCopy := append([]string(nil), secret.AllowedReaders...)
	labelsCopy := make(map[string]string, len(secret.Labels))
	for k, v := range secret.Labels {
		labelsCopy[k] = v
	}
	now := time.Now().UTC()

	st := &domain.Secret{
		Name:           secret.Name,
		Version:        verStr,
		Value:          valCopy,
		AllowedReaders: readersCopy,
		Labels:         labelsCopy,
		CreatedAt:      now,
	}
	m.secrets[secret.Name][verStr] = st

	meta := &domain.SecretMetadata{
		Name:           secret.Name,
		Version:        verStr,
		AllowedReaders: readersCopy,
		Labels:         labelsCopy,
		CreatedAt:      now,
	}
	m.secretMetadata[secret.Name] = meta
	if idempotencyKey != "" {
		m.secretIdem[idempotencyKey] = meta
	}

	return meta, nil
}

func (m *MemoryStore) Rotate(ctx context.Context, name string, newValue []byte, idempotencyKey string) (*domain.SecretMetadata, error) {
	m.mu.RLock()
	existingMeta, ok := m.secretMetadata[name]
	m.mu.RUnlock()

	if !ok {
		return nil, domain.ErrNotFound
	}

	return m.Put(ctx, &domain.Secret{
		Name:           name,
		Value:          newValue,
		AllowedReaders: existingMeta.AllowedReaders,
		Labels:         existingMeta.Labels,
	}, idempotencyKey)
}

func (m *MemoryStore) List(_ context.Context, prefix string) ([]domain.SecretMetadata, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []domain.SecretMetadata
	for name, meta := range m.secretMetadata {
		if strings.HasPrefix(name, prefix) {
			result = append(result, *meta)
		}
	}
	return result, nil
}

// --- CryptoStore (Transit Envelope Encryption) ---

func (m *MemoryStore) Encrypt(_ context.Context, purpose string, plaintext, aad []byte) (*domain.EncryptedPayload, error) {
	if !domain.AllowedPurposes[purpose] {
		return nil, domain.ErrUnknownKeyPurpose
	}

	m.mu.RLock()
	ver := m.activeVersion[purpose]
	verStr := strconv.Itoa(ver)
	key := m.cryptoKeys[purpose][verStr]
	m.mu.RUnlock()

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, aad)
	return &domain.EncryptedPayload{
		Ciphertext: ciphertext,
		KeyVersion: verStr,
	}, nil
}

func (m *MemoryStore) Decrypt(_ context.Context, purpose string, ciphertext, aad []byte, version string) ([]byte, error) {
	if !domain.AllowedPurposes[purpose] {
		return nil, domain.ErrUnknownKeyPurpose
	}

	m.mu.RLock()
	if version == "" {
		version = strconv.Itoa(m.activeVersion[purpose])
	}
	key, ok := m.cryptoKeys[purpose][version]
	m.mu.RUnlock()

	if !ok {
		return nil, domain.ErrNotFound
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, domain.ErrAADMismatch
	}

	nonce := ciphertext[:nonceSize]
	actualCiphertext := ciphertext[nonceSize:]

	plaintext, err := gcm.Open(nil, nonce, actualCiphertext, aad)
	if err != nil {
		return nil, domain.ErrAADMismatch
	}

	return plaintext, nil
}

func (m *MemoryStore) RotateKey(_ context.Context, purpose string, idempotencyKey string) (string, error) {
	if !domain.AllowedPurposes[purpose] {
		return "", domain.ErrUnknownKeyPurpose
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if idempotencyKey != "" {
		if ver, ok := m.cryptoIdem[idempotencyKey]; ok {
			return ver, nil
		}
	}

	newKey := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, newKey); err != nil {
		return "", err
	}

	nextVer := m.activeVersion[purpose] + 1
	verStr := strconv.Itoa(nextVer)
	m.cryptoKeys[purpose][verStr] = newKey
	m.activeVersion[purpose] = nextVer

	if idempotencyKey != "" {
		m.cryptoIdem[idempotencyKey] = verStr
	}

	return verStr, nil
}

// --- AuditStore ---

func (m *MemoryStore) Append(_ context.Context, event *domain.AuditEvent, idempotencyKey string) (*domain.AuditEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if idempotencyKey != "" {
		if ev, ok := m.auditIdem[idempotencyKey]; ok {
			return ev, nil
		}
	}

	var prevHash []byte
	if len(m.auditEvents) > 0 {
		prevHash = m.auditEvents[len(m.auditEvents)-1].Hash
	}

	evCopy := *event
	evCopy.PrevHash = prevHash
	if evCopy.OccurredAt.IsZero() {
		evCopy.OccurredAt = time.Now().UTC()
	}
	evCopy.Hash = domain.ComputeAuditHash(prevHash, &evCopy)

	m.auditEvents = append(m.auditEvents, evCopy)
	if idempotencyKey != "" {
		m.auditIdem[idempotencyKey] = &evCopy
	}

	return &evCopy, nil
}

// TamperEventForTesting modifica un evento directamente para simular alteración física en la BD (F05.4).
func (m *MemoryStore) TamperEventForTesting(idx int, newAction string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if idx >= 0 && idx < len(m.auditEvents) {
		m.auditEvents[idx].Action = newAction
	}
}

func (m *MemoryStore) Query(_ context.Context, filter AuditFilter) ([]domain.AuditEvent, int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var matched []domain.AuditEvent
	for _, e := range m.auditEvents {
		if filter.TenantID != "" && e.TenantID != filter.TenantID {
			continue
		}
		if filter.ActorUserID != "" && e.ActorUserID != filter.ActorUserID {
			continue
		}
		if filter.ActionPrefix != "" && !strings.HasPrefix(e.Action, filter.ActionPrefix) {
			continue
		}
		if !filter.From.IsZero() && e.OccurredAt.Before(filter.From) {
			continue
		}
		if !filter.To.IsZero() && e.OccurredAt.After(filter.To) {
			continue
		}
		matched = append(matched, e)
	}

	total := len(matched)
	offset := filter.Offset
	if offset > total {
		offset = total
	}
	limit := filter.Limit
	if limit <= 0 || offset+limit > total {
		limit = total - offset
	}

	return matched[offset : offset+limit], total, nil
}

func (m *MemoryStore) VerifyChain(_ context.Context, from, to time.Time) (bool, string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var prevHash []byte
	for i, e := range m.auditEvents {
		if !from.IsZero() && e.OccurredAt.Before(from) {
			prevHash = e.Hash
			continue
		}
		if !to.IsZero() && e.OccurredAt.After(to) {
			break
		}

		// Comprobar enlace con el anterior
		if i > 0 && !bytes.Equal(e.PrevHash, prevHash) {
			return false, e.EventID, nil
		}

		// Comprobar hash del propio evento
		expectedHash := domain.ComputeAuditHash(e.PrevHash, &e)
		if !bytes.Equal(e.Hash, expectedHash) {
			return false, e.EventID, nil
		}

		prevHash = e.Hash
	}

	return true, "", nil
}

// --- SecurityEventStore ---

func (m *MemoryStore) RecordEvent(_ context.Context, ev *domain.SecurityEvent, idempotencyKey string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if idempotencyKey != "" {
		if m.secIdem[idempotencyKey] {
			return nil
		}
		m.secIdem[idempotencyKey] = true
	}

	evCopy := *ev
	if evCopy.OccurredAt.IsZero() {
		evCopy.OccurredAt = time.Now().UTC()
	}
	m.securityEvents = append(m.securityEvents, evCopy)
	return nil
}

func (m *MemoryStore) CountEvents(_ context.Context, kind, subjectOrIP string, window time.Duration) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cutoff := time.Now().UTC().Add(-window)
	count := 0
	for _, e := range m.securityEvents {
		if e.Kind == kind && (e.Subject == subjectOrIP || e.IPAddress == subjectOrIP) {
			if e.OccurredAt.After(cutoff) {
				count++
			}
		}
	}
	return count, nil
}

func (m *MemoryStore) SetBlock(_ context.Context, block *domain.Block) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	bCopy := *block
	m.blocks[block.Subject] = &bCopy
	return nil
}

func (m *MemoryStore) GetBlock(_ context.Context, subject, ip string) (*domain.Block, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	now := time.Now().UTC()
	if subject != "" {
		if b, ok := m.blocks[subject]; ok && b.Until.After(now) {
			return b, nil
		}
	}
	if ip != "" {
		if b, ok := m.blocks[ip]; ok && b.Until.After(now) {
			return b, nil
		}
	}
	return nil, nil
}

// --- CertStore ---

func (m *MemoryStore) IssueCert(_ context.Context, serviceName string, _ []byte, bootstrapToken, idempotencyKey string) (*domain.ServiceCertificate, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if idempotencyKey != "" {
		if cert, ok := m.certIdem[idempotencyKey]; ok {
			return cert, nil
		}
	}

	if bootstrapToken == "" || (m.bootstrapToken != "" && bootstrapToken != m.bootstrapToken) {
		return nil, domain.ErrBootstrapTokenInvalid
	}

	// Generar certificado autofirmado para el servicio con SAN (SPIFFE)
	privKey, err := rand.Prime(rand.Reader, 1024)
	if err != nil {
		return nil, err
	}
	_ = privKey

	expiresAt := time.Now().UTC().Add(24 * time.Hour)
	template := x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject: pkix.Name{
			CommonName:   serviceName,
			Organization: []string{"PlentyPay"},
		},
		NotBefore: time.Now().UTC().Add(-1 * time.Minute),
		NotAfter:  expiresAt,
		DNSNames:  []string{serviceName, serviceName + ".plentypay.internal"},
	}

	// Para prueba/dev, emitir DER PEM básico
	certDER := template.Raw
	if len(certDER) == 0 {
		certDER = []byte("MOCK_CERT_DER_FOR_" + serviceName)
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	caPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: []byte("MOCK_CA_BUNDLE")})

	cert := &domain.ServiceCertificate{
		ServiceName:    serviceName,
		CertificatePEM: certPEM,
		CABundlePEM:    caPEM,
		ExpiresAt:      expiresAt,
	}

	if idempotencyKey != "" {
		m.certIdem[idempotencyKey] = cert
	}

	return cert, nil
}
