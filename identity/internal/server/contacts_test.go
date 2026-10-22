package server

import (
	"context"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/store"
)

// F11.10: GetUserContacts devuelve solo usuarios activos y existentes, ignora ids inválidos o
// repetidos y rechaza más de 100 ids.
func TestGetUserContacts_OnlyActiveExistingUsers(t *testing.T) {
	srv, users := newContactsServer(t)
	res, err := srv.GetUserContacts(context.Background(), &pb.GetUserContactsRequest{
		UserIds: []string{users.active, users.active, users.suspended, "no-es-uuid", "01900000-0000-7000-8000-00000000dead"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Contacts) != 1 || res.Contacts[0].UserId != users.active || res.Contacts[0].FullName != "Ana Pérez" {
		t.Fatalf("contactos: %+v", res.Contacts)
	}
	many := make([]string, 101)
	_, err = srv.GetUserContacts(context.Background(), &pb.GetUserContactsRequest{UserIds: many})
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("101 ids: %v", err)
	}
}

type contactUsers struct{ active, suspended string }

func newContactsServer(t *testing.T) (*IdentityServer, contactUsers) {
	t.Helper()
	tokens, err := auth.NewTokenIssuer("test-access-secret-at-least-32-characters-long", "test-refresh-secret-at-least-32-characters-long")
	if err != nil {
		t.Fatal(err)
	}
	users := store.NewInMemoryUserStore()
	active := &store.User{Email: "ana@example.test", FullName: "Ana Pérez"}
	suspended := &store.User{Email: "luis@example.test", FullName: "Luis Gómez", Status: domain.UserStatusSuspended}
	for _, u := range []*store.User{active, suspended} {
		if err := users.Create(context.Background(), u); err != nil {
			t.Fatal(err)
		}
	}
	srv := NewIdentityServer(users, tokens, nil, observability.NewMetrics("identity", "test", "none"))
	return srv, contactUsers{active: active.ID, suspended: suspended.ID}
}
