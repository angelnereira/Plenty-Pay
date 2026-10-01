package store

import (
	"errors"
	"testing"

	"plentypay.dev/services/identity/internal/authz"
)

func newStore(t *testing.T) *MemoryStore {
	t.Helper()
	return NewMemoryStore()
}

func TestCreateTenantAndOwner(t *testing.T) {
	s := newStore(t)
	ten, owner, err := s.CreateTenant("Cafe", "owner@cafe.com", "hash", []authz.RoleKey{authz.RoleOwner})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if ten.ID == "" || owner.TenantID != ten.ID {
		t.Fatal("owner debe pertenecer al tenant creado")
	}
	got, err := s.TenantByID(ten.ID)
	if err != nil || got.Name != "Cafe" {
		t.Fatalf("TenantByID: %v", err)
	}
}

func TestDuplicateTenantNameRejected(t *testing.T) {
	s := newStore(t)
	_, _, err := s.CreateTenant("X", "a@x.com", "h", nil)
	if err != nil {
		t.Fatalf("primera: %v", err)
	}
	if _, _, err := s.CreateTenant("X", "b@x.com", "h", nil); !errors.Is(err, ErrDuplicateTenantName) {
		t.Fatalf("duplicado esperado ErrDuplicateTenantName, got %v", err)
	}
}

func TestEmailUniquenessGlobalAndPerTenant(t *testing.T) {
	s := newStore(t)
	ten1, _, _ := s.CreateTenant("T1", "dupe@mail.com", "h", nil)
	if _, err := s.CreateUser(ten1.ID, "dupe@mail.com", "h", nil); !errors.Is(err, ErrDuplicateEmail) {
		t.Fatalf("duplicado en mismo tenant debe fallar, got %v", err)
	}
	ten2, _, err := s.CreateTenant("T2", "dupe@mail.com", "h", nil)
	// Regla v1: email global único (login no tenant-scoped todavía).
	if !errors.Is(err, ErrDuplicateEmail) {
		t.Fatalf("email global duplicado debe fallar (regla v1), got %v", err)
	}
	if ten2 != nil {
		t.Fatal("no debe crearse tenant si el owner no pudo crearse (rollback)")
	}
}

func TestUserByEmailAndNotFound(t *testing.T) {
	s := newStore(t)
	s.CreateTenant("T", "u@mail.com", "h", nil)
	u, err := s.UserByEmail("u@mail.com")
	if err != nil || u.Email != "u@mail.com" {
		t.Fatalf("UserByEmail: %v", err)
	}
	if _, err := s.UserByEmail("ghost@mail.com"); !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("esperado ErrUserNotFound, got %v", err)
	}
}

func TestCreateUserInUnknownTenantRejected(t *testing.T) {
	s := newStore(t)
	if _, err := s.CreateUser("ten_fantasma", "x@mail.com", "h", nil); !errors.Is(err, ErrTenantNotFound) {
		t.Fatalf("esperado ErrTenantNotFound, got %v", err)
	}
}
