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

// SessionStore administra sesiones en memoria (PARTIAL: persistencia
// PostgreSQL en la culminación de Etapa 1; la interfaz es la definitiva).
type SessionStore struct {
	mu      sync.RWMutex
	byToken map[string]*Session // tokenHash -> sesión
	ttl     time.Duration
	nowFn   func() time.Time // inyectable para tests
	idSeq   int
}

func NewSessionStore(ttl time.Duration) *SessionStore {
	return &SessionStore{
		byToken: make(map[string]*Session),
		ttl:     ttl,
		nowFn:   time.Now,
	}
}

// Create genera un token opaco de 256 bits y lo registra.
// Devuelve (tokenEnClaro, sesión). El token en claro solo se entrega aquí,
// en el momento de autenticación.
func (s *SessionStore) Create(userID, tenantID string) (string, *Session, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", nil, fmt.Errorf("generando token: %w", err)
	}
	token := hex.EncodeToString(raw)
	sum := sha256.Sum256([]byte(token))
	sess := &Session{
		ID:        fmt.Sprintf("ses_%d_%s", s.nextSeq(), token[:8]),
		UserID:    userID,
		TenantID:  tenantID,
		TokenHash: hex.EncodeToString(sum[:]),
		ExpiresAt: s.nowFn().Add(s.ttl),
	}
	s.mu.Lock()
	s.byToken[sess.TokenHash] = sess
	s.mu.Unlock()
	return token, sess, nil
}

// Validate valida un token en claro: existente, no revocado, no expirado.
func (s *SessionStore) Validate(token string) (*Session, error) {
	sum := sha256.Sum256([]byte(token))
	hash := hex.EncodeToString(sum[:])
	s.mu.RLock()
	sess, ok := s.byToken[hash]
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
func (s *SessionStore) Revoke(token string) {
	sum := sha256.Sum256([]byte(token))
	hash := hex.EncodeToString(sum[:])
	s.mu.Lock()
	if sess, ok := s.byToken[hash]; ok {
		sess.Revoked = true
	}
	s.mu.Unlock()
}

func (s *SessionStore) nextSeq() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.idSeq++
	return s.idSeq
}
