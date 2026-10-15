package store

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"plentypay/identity/internal/domain"
)

// Los tipos y errores del dominio viven en internal/domain (go-standards.md
// seccion 2: el dominio no importa SQL ni gRPC). Estos alias mantienen la
// superficie del paquete estable para el resto del codigo.
type (
	User          = domain.User
	ConsentRecord = domain.ConsentRecord
)

var (
	ErrUserNotFound = domain.ErrUserNotFound
	ErrEmailTaken   = domain.ErrEmailTaken
)

// UserStore es la interfaz que usa el servidor gRPC — nunca una base de datos concreta.
// Hoy: implementación en memoria (desarrollo/pruebas). Fase 8 (identity/SPEC.md §12): implementación
// sobre postgres-db que cumple esta MISMA interfaz, sin tocar el servidor (inversión de dependencias).
type UserStore interface {
	Create(ctx context.Context, u *User) error
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByID(ctx context.Context, id string) (*User, error)
}

type InMemoryUserStore struct {
	mu    sync.RWMutex
	byID  map[string]*User
	email map[string]string // email -> id
}

func NewInMemoryUserStore() *InMemoryUserStore {
	return &InMemoryUserStore{byID: make(map[string]*User), email: make(map[string]string)}
}

func (s *InMemoryUserStore) Create(_ context.Context, u *User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.email[u.Email]; exists {
		return ErrEmailTaken
	}
	if u.ID == "" {
		id, err := uuid.NewV7() // UUIDv7: ordenable por tiempo, no enumerable (ADR 0013)
		if err != nil {
			return err
		}
		u.ID = id.String()
	}
	s.byID[u.ID] = u
	s.email[u.Email] = u.ID
	return nil
}

func (s *InMemoryUserStore) FindByEmail(_ context.Context, email string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, ok := s.email[email]
	if !ok {
		return nil, ErrUserNotFound
	}
	return s.byID[id], nil
}

func (s *InMemoryUserStore) FindByID(_ context.Context, id string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.byID[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	return u, nil
}
