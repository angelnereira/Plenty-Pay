package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Errores de Step-Up
var (
	ErrChallengeNotFound = errors.New("challenge not found")
	ErrChallengeExpired  = errors.New("challenge expired")
)

// Binding define a qué operación y monto exacto está atado el step-up (ADR 0011).
type Binding struct {
	UserID      string
	Operation   string
	AmountMinor int64
	Currency    string
}

type stepUpChallenge struct {
	id        string
	binding   Binding
	expiresAt time.Time
}

type stepUpToken struct {
	token     string
	binding   Binding
	expiresAt time.Time
	used      bool
}

// StepUpManager gestiona challenges WebAuthn/Passkey y emisión/consumo de tokens step-up de un solo uso.
type StepUpManager struct {
	mu         sync.RWMutex
	challenges map[string]*stepUpChallenge
	tokens     map[string]*stepUpToken
	now        func() time.Time
}

func NewStepUpManager() *StepUpManager {
	return &StepUpManager{
		challenges: make(map[string]*stepUpChallenge),
		tokens:     make(map[string]*stepUpToken),
		now:        func() time.Time { return time.Now().UTC() },
	}
}

// IssueChallenge crea un reto para confirmación fuerte atado a la operación.
func (m *StepUpManager) IssueChallenge(userID, operation string, amountMinor int64, currency string) (string, []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()

	id := uuid.Must(uuid.NewV7()).String()
	m.challenges[id] = &stepUpChallenge{
		id: id,
		binding: Binding{
			UserID:      userID,
			Operation:   operation,
			AmountMinor: amountMinor,
			Currency:    currency,
		},
		expiresAt: m.now().Add(5 * time.Minute),
	}

	mockOptionsJSON := []byte(`{"challenge":"` + id + `","rpId":"plentypay.internal"}`)
	return id, mockOptionsJSON
}

// VerifyChallenge valida el reto y emite un token de confirmación fuerte de un solo uso (TTL 5 min).
func (m *StepUpManager) VerifyChallenge(challengeID string, _ []byte) (string, time.Time, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	ch, ok := m.challenges[challengeID]
	if !ok {
		return "", time.Time{}, ErrChallengeNotFound
	}
	if m.now().After(ch.expiresAt) {
		delete(m.challenges, challengeID)
		return "", time.Time{}, ErrChallengeExpired
	}

	// El reto fue verificado: se elimina para que no se use otra vez
	delete(m.challenges, challengeID)

	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", time.Time{}, err
	}
	tokenStr := hex.EncodeToString(b)
	expiresAt := m.now().Add(5 * time.Minute)

	m.tokens[tokenStr] = &stepUpToken{
		token:     tokenStr,
		binding:   ch.binding,
		expiresAt: expiresAt,
		used:      false,
	}

	return tokenStr, expiresAt, nil
}

// ConsumeToken valida y consume el token atado a la operación exacta. Devuelve (valid, reason).
// Reasons: "NOT_FOUND" | "EXPIRED" | "ALREADY_USED" | "MISMATCH" (identity.proto §4).
func (m *StepUpManager) ConsumeToken(tokenStr, userID, operation string, amountMinor int64, currency string) (bool, string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tok, ok := m.tokens[tokenStr]
	if !ok {
		return false, "NOT_FOUND"
	}

	if tok.used {
		return false, "ALREADY_USED"
	}

	if m.now().After(tok.expiresAt) {
		return false, "EXPIRED"
	}

	// Validar binding exacto (user_id, operation, amount_minor, currency)
	if tok.binding.UserID != userID ||
		tok.binding.Operation != operation ||
		tok.binding.AmountMinor != amountMinor ||
		tok.binding.Currency != currency {
		return false, "MISMATCH"
	}

	// Marcar como consumido (single use!)
	tok.used = true
	return true, ""
}
