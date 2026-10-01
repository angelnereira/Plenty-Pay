package auth

import (
	"errors"
	"testing"
	"time"
)

func TestCreateValidateRevoke(t *testing.T) {
	s := NewSessionStore(1 * time.Minute)
	token, sess, err := s.Create("usr_1", "ten_1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if token == "" || sess.ID == "" {
		t.Fatal("token/sesión no vacíos")
	}
	got, err := s.Validate(token)
	if err != nil || got.UserID != "usr_1" {
		t.Fatalf("validar sesión recién creada: %v", err)
	}

	// Logout revoca: la misma sesión deja de validar.
	s.Revoke(token)
	if _, err := s.Validate(token); !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("sesión revocada debe dar ErrSessionNotFound, got %v", err)
	}
}

func TestSessionExpiry(t *testing.T) {
	s := NewSessionStore(10 * time.Millisecond)
	token, _, _ := s.Create("usr_1", "ten_1")
	time.Sleep(20 * time.Millisecond)
	if _, err := s.Validate(token); !errors.Is(err, ErrSessionExpired) {
		t.Fatalf("sesión expirada debe dar ErrSessionExpired, got %v", err)
	}
}

func TestTokensAreDistinct(t *testing.T) {
	s := NewSessionStore(time.Minute)
	t1, _, _ := s.Create("usr_1", "ten_1")
	t2, _, _ := s.Create("usr_1", "ten_1")
	if t1 == t2 {
		t.Fatal("dos sesiones NO deben compartir token")
	}
}
