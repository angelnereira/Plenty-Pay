// Package auth gestiona sesiones: tokens opacos de alta entropía, expiración
// y revocación server-side (mandato §13; el token nunca es material de firma).
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"
)

var (
	ErrSessionNotFound = errors.New("sesión no encontrada o revocada")
	ErrSessionExpired  = errors.New("sesión expirada")
)

// SessionBackend es el contrato de gestión de sesiones: memoria (tests/dev)
// o PostgreSQL (producción, store.PostgresSessions). Sustituible sin tocar
// al servidor (mandato §33).
type SessionBackend interface {
	Create(userID, tenantID string) (token string, sess *Session, err error)
	Validate(token string) (*Session, error)
	Revoke(token string) error
}

// Session es la sesión almacenada. El token en claro NO se guarda: se guarda
// su SHA-256 (defense in depth ante fuga del store).
type Session struct {
	ID        string
	UserID    string
	TenantID  string
	TokenHash string
	ExpiresAt time.Time
	Revoked   bool
}

// NewToken genera un token opaco de 256 bits y su hash SHA-256 (lo único
// que se persiste).
func NewToken() (token, tokenHash string, err error) {
	raw := make([]byte, 32)
	if _, err = rand.Read(raw); err != nil {
		return "", "", fmt.Errorf("generando token: %w", err)
	}
	token = hex.EncodeToString(raw)
	tokenHash = TokenHash(token)
	return token, tokenHash, nil
}

// TokenHash calcula el hash SHA-256 del token en claro (lo único persistido).
func TokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// SessionStore administra sesiones en memoria (PARTIAL: para tests/dev;
// producción usa store.PostgresSessions con la misma interfaz).
type SessionStore struct {
	mu    sync.RWMutex
	sess  map[string]*Session // tokenHash -> sesión
	ttl   time.Duration
	nowFn func() time.Time // inyectable para tests
	idSeq int
}

func NewSessionStore(ttl time.Duration) *SessionStore {
	return &SessionStore{
		sess:  make(map[string]*Session),
		ttl:   ttl,
		nowFn: time.Now,
	}
}

// Create genera un token opaco y lo registra. El token en claro solo se
// entrega aquí, en el momento de autenticación.
func (s *SessionStore) Create(userID, tenantID string) (string, *Session, error) {
	token, hash, err := NewToken()
	if err != nil {
		return "", nil, err
	}
	sess := &Session{
		ID:        fmt.Sprintf("ses_%d_%s", s.nextSeq(), token[:8]),
		UserID:    userID,
		TenantID:  tenantID,
		TokenHash: hash,
		ExpiresAt: s.nowFn().Add(s.ttl),
	}
	s.mu.Lock()
	s.sess[hash] = sess
	s.mu.Unlock()
	return token, sess, nil
}

// Validate valida un token en claro: existente, no revocado, no expirado.
func (s *SessionStore) Validate(token string) (*Session, error) {
	hash := TokenHash(token)
	s.mu.RLock()
	sess, ok := s.sess[hash]
	s.mu.RUnlock()
	if !ok || sess.Revoked {
		return nil, ErrSessionNotFound
	}
	if s.nowFn().After(sess.ExpiresAt) {
		return nil, ErrSessionExpired
	}
	return sess, nil
}

// Revoke revoca por token (Logout). Revocar un token inexistente no es error
// (idempotencia de red: el cliente puede reintentar el logout).
func (s *SessionStore) Revoke(token string) error {
	hash := TokenHash(token)
	s.mu.Lock()
	if sess, ok := s.sess[hash]; ok {
		sess.Revoked = true
	}
	s.mu.Unlock()
	return nil
}

func (s *SessionStore) nextSeq() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.idSeq++
	return s.idSeq
}
