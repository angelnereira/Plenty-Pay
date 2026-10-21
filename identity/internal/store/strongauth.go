package store

import (
	"bytes"
	"context"
	"sync"
	"time"

	"plentypay/identity/internal/domain"
)

// Propósitos de un reto WebAuthn/confirmación (identity/SPEC.md §3, webauthn_challenges.purpose).
const (
	ChallengePurposeStepUp   = "STEP_UP"
	ChallengePurposeRegister = "REGISTER"
	ChallengePurposeLogin    = "LOGIN"
)

// StepUpChallenge es un reto persistido (R32). UserID vacío solo en el inicio de sesión con passkey.
type StepUpChallenge struct {
	ID          string
	UserID      string
	Purpose     string
	Challenge   []byte
	SessionData []byte // estado WebAuthn serializado (JSON); vacío si la persona no tiene passkeys
	Operation   string
	AmountMinor int64
	Currency    string
	ExpiresAt   time.Time
	ConsumedAt  *time.Time
}

// StepUpBinding es aquello a lo que queda atado un token: usuario, operación, monto y moneda (R15).
type StepUpBinding struct {
	UserID      string
	Operation   string
	AmountMinor int64
	Currency    string
}

// Motivos de ConsumeToken (identity.proto ConsumeStepUpResult.reason). Vacío = válido.
const (
	ConsumeNotFound    = "NOT_FOUND"
	ConsumeExpired     = "EXPIRED"
	ConsumeAlreadyUsed = "ALREADY_USED"
	ConsumeMismatch    = "MISMATCH"
)

// StrongAuthStore guarda retos, tokens y PIN de la confirmación fuerte (ADR 0020, R28, R32).
// Del token solo se guarda su SHA-256.
type StrongAuthStore interface {
	CreateChallenge(ctx context.Context, c StepUpChallenge) error
	// GetChallenge devuelve un reto vigente y sin usar del usuario; si no existe, venció, ya se usó o
	// es de otra persona responde domain.ErrChallengeInvalid (R26: no se distingue).
	GetChallenge(ctx context.Context, id, userID string, now time.Time) (*StepUpChallenge, error)
	// ConsumeChallenge marca el reto como usado de forma atómica (un solo uso).
	ConsumeChallenge(ctx context.Context, id, userID string, now time.Time) error
	IssueToken(ctx context.Context, tokenHash []byte, b StepUpBinding, method string, expiresAt time.Time) error
	// ConsumeToken consume el token si coincide con la vinculación; devuelve "" si fue válido o el
	// motivo del rechazo. Un rechazo no consume el token.
	ConsumeToken(ctx context.Context, tokenHash []byte, b StepUpBinding, now time.Time) (string, error)
	// GetPin devuelve el estado del PIN o nil si la persona no tiene.
	GetPin(ctx context.Context, userID string) (*domain.PinState, error)
	// SetPin crea o reemplaza el PIN y reinicia intentos y bloqueo.
	SetPin(ctx context.Context, userID, hash string, now time.Time) error
	// RecordPinFailure suma un intento fallido de forma atómica y aplica el bloqueo (R28).
	RecordPinFailure(ctx context.Context, userID string, p domain.PinPolicy, now time.Time) (domain.PinState, error)
	// ResetPinFailures reinicia el contador tras un acierto.
	ResetPinFailures(ctx context.Context, userID string, now time.Time) error
	// PurgeStepUp borra retos y tokens vencidos antes de `before`.
	PurgeStepUp(ctx context.Context, before time.Time) (int64, error)
}

// InMemoryStrongAuthStore implementa StrongAuthStore en memoria. Solo se usa cuando identity corre
// sin base de datos (pruebas unitarias y el E2E sin BD); con PP_DB_DSN se usa PostgreSQL (R32).
type InMemoryStrongAuthStore struct {
	mu         sync.Mutex
	challenges map[string]*StepUpChallenge
	tokens     map[string]*memToken
	pins       map[string]*domain.PinState
}

type memToken struct {
	binding    StepUpBinding
	method     string
	expiresAt  time.Time
	consumedAt *time.Time
}

var _ StrongAuthStore = (*InMemoryStrongAuthStore)(nil)

// NewInMemoryStrongAuthStore crea el store vacío.
func NewInMemoryStrongAuthStore() *InMemoryStrongAuthStore {
	return &InMemoryStrongAuthStore{
		challenges: map[string]*StepUpChallenge{},
		tokens:     map[string]*memToken{},
		pins:       map[string]*domain.PinState{},
	}
}

func (s *InMemoryStrongAuthStore) CreateChallenge(_ context.Context, c StepUpChallenge) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := c
	cp.Challenge = bytes.Clone(c.Challenge)
	cp.SessionData = bytes.Clone(c.SessionData)
	s.challenges[c.ID] = &cp
	return nil
}

func (s *InMemoryStrongAuthStore) GetChallenge(_ context.Context, id, userID string, now time.Time) (*StepUpChallenge, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.challenges[id]
	if !ok || c.UserID != userID || c.ConsumedAt != nil || !now.Before(c.ExpiresAt) {
		return nil, domain.ErrChallengeInvalid
	}
	cp := *c
	return &cp, nil
}

func (s *InMemoryStrongAuthStore) ConsumeChallenge(_ context.Context, id, userID string, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.challenges[id]
	if !ok || c.UserID != userID || c.ConsumedAt != nil || !now.Before(c.ExpiresAt) {
		return domain.ErrChallengeInvalid
	}
	at := now
	c.ConsumedAt = &at
	return nil
}

func (s *InMemoryStrongAuthStore) IssueToken(_ context.Context, tokenHash []byte, b StepUpBinding, method string, expiresAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tokens[string(tokenHash)] = &memToken{binding: b, method: method, expiresAt: expiresAt}
	return nil
}

func (s *InMemoryStrongAuthStore) ConsumeToken(_ context.Context, tokenHash []byte, b StepUpBinding, now time.Time) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.tokens[string(tokenHash)]
	switch {
	case !ok:
		return ConsumeNotFound, nil
	case t.consumedAt != nil:
		return ConsumeAlreadyUsed, nil
	case !now.Before(t.expiresAt):
		return ConsumeExpired, nil
	case t.binding != b:
		return ConsumeMismatch, nil
	}
	at := now
	t.consumedAt = &at
	return "", nil
}

func (s *InMemoryStrongAuthStore) GetPin(_ context.Context, userID string) (*domain.PinState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.pins[userID]
	if !ok {
		return nil, nil
	}
	cp := *p
	return &cp, nil
}

func (s *InMemoryStrongAuthStore) SetPin(_ context.Context, userID, hash string, _ time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pins[userID] = &domain.PinState{Hash: hash}
	return nil
}

func (s *InMemoryStrongAuthStore) RecordPinFailure(_ context.Context, userID string, p domain.PinPolicy, now time.Time) (domain.PinState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, ok := s.pins[userID]
	if !ok {
		return domain.PinState{}, domain.ErrPinNotSet
	}
	next := cur.AfterFailure(p, now)
	s.pins[userID] = &next
	return next, nil
}

func (s *InMemoryStrongAuthStore) ResetPinFailures(_ context.Context, userID string, _ time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p, ok := s.pins[userID]; ok {
		p.FailedAttempts = 0
		p.LockedUntil = nil
	}
	return nil
}

func (s *InMemoryStrongAuthStore) PurgeStepUp(_ context.Context, before time.Time) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var n int64
	for id, c := range s.challenges {
		if c.ExpiresAt.Before(before) {
			delete(s.challenges, id)
			n++
		}
	}
	for h, t := range s.tokens {
		if t.expiresAt.Before(before) {
			delete(s.tokens, h)
			n++
		}
	}
	return n, nil
}
