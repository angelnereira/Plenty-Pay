// Package store contiene el almacenamiento de identidad. Estado Etapa 1:
// memoria con locks (PARTIAL). La persistencia PostgreSQL con esquema
// `identity.*` (aislamiento por servicio, mandato §18) sustituye este store
// manteniendo la misma interfaz (ADR-0010: datos vía sqlc).
package store

import (
	"errors"
	"fmt"
	"sync"

	"plentypay.dev/services/identity/internal/authz"
)

var (
	ErrDuplicateTenantName = errors.New("nombre de tenant ya existe")
	ErrDuplicateEmail      = errors.New("email ya registrado en el tenant")
	ErrUserNotFound        = errors.New("usuario no encontrado")
	ErrTenantNotFound      = errors.New("tenant no encontrado")
)

// Tenant es un negocio/organización (multi-tenant estricto, doc 01 §6).
type Tenant struct {
	ID     string
	Name   string
	Status string // "active" | "suspended"
}

// User es un usuario dentro de un tenant.
type User struct {
	ID           string
	TenantID     string
	Email        string
	PasswordHash string
	Status       string // "active" | "suspended" | "disabled"
	Roles        []authz.RoleKey
}

// Storage es la interfaz del almacén de identidad. La implementación actual
// es memoria (PARTIAL, Etapa 1); PostgreSQL la implementa sin cambiar al
// servicio (sustitución por contrato, mandato §33).
type Storage interface {
	CreateTenant(name, ownerEmail, ownerPasswordHash string, roles []authz.RoleKey) (*Tenant, *User, error)
	CreateUser(tenantID, email, passwordHash string, roles []authz.RoleKey) (*User, error)
	UserByEmail(email string) (*User, error)
	UserByID(id string) (*User, error)
	TenantByID(id string) (*Tenant, error)
}

// MemoryStore es el store en memoria de Etapa 1.
type MemoryStore struct {
	mu                sync.RWMutex
	tenants           map[string]*Tenant
	tenantByName      map[string]string
	userByEmailGlob   map[string]string // email -> userID (login global, v1)
	userByTenantEmail map[string]string // tenantID:email -> userID (unicidad por tenant)
	users             map[string]*User
	seq               int
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		tenants:           make(map[string]*Tenant),
		tenantByName:      make(map[string]string),
		userByEmailGlob:   make(map[string]string),
		userByTenantEmail: make(map[string]string),
		users:             make(map[string]*User),
	}
}

// nextID asume el lock YA tomado por el llamador.
func (s *MemoryStore) nextID(prefix string) string {
	s.seq++
	return fmt.Sprintf("%s_%d", prefix, s.seq)
}

func (s *MemoryStore) CreateTenant(name, ownerEmail, ownerPasswordHash string, roles []authz.RoleKey) (*Tenant, *User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, taken := s.tenantByName[name]; taken {
		return nil, nil, ErrDuplicateTenantName
	}
	t := &Tenant{ID: s.nextID("ten"), Name: name, Status: "active"}
	s.tenants[t.ID] = t
	s.tenantByName[name] = t.ID

	u := &User{
		ID:           s.nextID("usr"),
		TenantID:     t.ID,
		Email:        ownerEmail,
		PasswordHash: ownerPasswordHash,
		Status:       "active",
		Roles:        roles,
	}
	if err := s.insertUserLocked(u); err != nil {
		// Rollback de tenant (atomicidad del agregado en memoria).
		delete(s.tenants, t.ID)
		delete(s.tenantByName, name)
		return nil, nil, err
	}
	return t, u, nil
}

func (s *MemoryStore) CreateUser(tenantID, email, passwordHash string, roles []authz.RoleKey) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.tenants[tenantID] == nil {
		return nil, ErrTenantNotFound
	}
	u := &User{
		ID:           s.nextID("usr"),
		TenantID:     tenantID,
		Email:        email,
		PasswordHash: passwordHash,
		Status:       "active",
		Roles:        roles,
	}
	if err := s.insertUserLocked(u); err != nil {
		return nil, err
	}
	return u, nil
}

// insertUserLocked asume lock tomado (convención explícita, sin deadlock).
func (s *MemoryStore) insertUserLocked(u *User) error {
	key := u.TenantID + ":" + u.Email
	if _, dup := s.userByTenantEmail[key]; dup {
		return ErrDuplicateEmail
	}
	if _, dupG := s.userByEmailGlob[u.Email]; dupG {
		// Regla v1 (documentada en README del servicio): el email es el
		// identificador global de login (el contrato AuthenticatePassword
		// no lleva tenant). Un email pertenece a UN tenant hasta que el
		// login pase a ser tenant-scoped.
		return ErrDuplicateEmail
	}
	s.userByTenantEmail[key] = u.ID
	s.userByEmailGlob[u.Email] = u.ID
	s.users[u.ID] = u
	return nil
}

func (s *MemoryStore) UserByEmail(email string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, ok := s.userByEmailGlob[email]
	if !ok {
		return nil, ErrUserNotFound
	}
	return s.users[id], nil
}

func (s *MemoryStore) UserByID(id string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	return u, nil
}

func (s *MemoryStore) TenantByID(id string) (*Tenant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.tenants[id]
	if !ok {
		return nil, ErrTenantNotFound
	}
	return t, nil
}
