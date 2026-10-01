// Package server implementa plentypay.identity.v1.IdentityService y
// plentypay.common.v1.HealthService sobre el store inyectado.
package server

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	commonv1 "plentypay.dev/contracts/gen/go/plentypay/common/v1"
	identityv1 "plentypay.dev/contracts/gen/go/plentypay/identity/v1"
	"plentypay.dev/services/identity/internal/auth"
	"plentypay.dev/services/identity/internal/authz"
	"plentypay.dev/services/identity/internal/store"
)

// Identity implementa el contrato v1. Toda decisión de autorización ocurre
// aquí (backend), nunca en el cliente (mandato §7).
type Identity struct {
	identityv1.UnimplementedIdentityServiceServer

	commonv1.UnimplementedHealthServiceServer

	hasher   *auth.PasswordHasher
	sessions *auth.SessionStore
	db       store.Storage
	log      *slog.Logger
}

// NewIdentity construye el servicio. `db` es la interfaz del store (hoy
// memoria; PostgreSQL al cerrar Etapa 1).
func NewIdentity(db store.Storage, hasher *auth.PasswordHasher, sessionTTL time.Duration, log *slog.Logger) *Identity {
	return &Identity{
		hasher:   hasher,
		sessions: auth.NewSessionStore(sessionTTL),
		db:       db,
		log:      log,
	}
}

func mapStoreErr(err error) error {
	switch {
	case errors.Is(err, store.ErrDuplicateTenantName), errors.Is(err, store.ErrDuplicateEmail):
		return status.Error(codes.AlreadyExists, err.Error())
	case errors.Is(err, store.ErrUserNotFound), errors.Is(err, store.ErrTenantNotFound):
		return status.Error(codes.NotFound, err.Error())
	default:
		return status.Error(codes.Internal, "error interno")
	}
}

// requireNotEmpty falla rápido con InvalidArgument (mandato §21).
func requireNotEmpty(fields map[string]string) error {
	for name, v := range fields {
		if v == "" {
			return status.Errorf(codes.InvalidArgument, "campo obligatorio vacío: %s", name)
		}
	}
	return nil
}

func (s *Identity) CreateTenant(ctx context.Context, req *identityv1.CreateTenantRequest) (*identityv1.CreateTenantResponse, error) {
	if err := requireNotEmpty(map[string]string{
		"name": req.GetName(), "owner_email": req.GetOwnerEmail(), "owner_password": req.GetOwnerPassword(),
	}); err != nil {
		return nil, err
	}
	hash, err := s.hasher.Hash(req.GetOwnerPassword())
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	tenant, owner, err := s.db.CreateTenant(req.GetName(), req.GetOwnerEmail(), hash, []authz.RoleKey{authz.RoleOwner})
	if err != nil {
		return nil, mapStoreErr(err)
	}
	s.log.Info("tenant creado", "tenant_id", tenant.ID, "owner_id", owner.ID)
	return &identityv1.CreateTenantResponse{
		Tenant: toProtoTenant(tenant),
		Owner:  toProtoUser(owner),
	}, nil
}

func (s *Identity) CreateUser(ctx context.Context, req *identityv1.CreateUserRequest) (*identityv1.CreateUserResponse, error) {
	if err := requireNotEmpty(map[string]string{
		"tenant_id": req.GetTenantId(), "email": req.GetEmail(), "password": req.GetPassword(),
	}); err != nil {
		return nil, err
	}
	hash, err := s.hasher.Hash(req.GetPassword())
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	// TODO(Etapa3): roles custom por tenant vía request; hoy rol mínimo.
	user, err := s.db.CreateUser(req.GetTenantId(), req.GetEmail(), hash, []authz.RoleKey{authz.RoleCashier})
	if err != nil {
		return nil, mapStoreErr(err)
	}
	return &identityv1.CreateUserResponse{User: toProtoUser(user)}, nil
}

func (s *Identity) AuthenticatePassword(ctx context.Context, req *identityv1.AuthenticatePasswordRequest) (*identityv1.AuthenticatePasswordResponse, error) {
	if err := requireNotEmpty(map[string]string{"email": req.GetEmail(), "password": req.GetPassword()}); err != nil {
		return nil, err
	}
	user, err := s.db.UserByEmail(req.GetEmail())
	if err != nil {
		if errors.Is(err, store.ErrUserNotFound) {
			// Mismo error para usuario inexistente y contraseña mala:
			// no filtrar existencia de cuentas (anti-enumeración, §13).
			return nil, status.Error(codes.Unauthenticated, auth.ErrInvalidPassword.Error())
		}
		return nil, mapStoreErr(err)
	}
	if !s.hasher.Verify(req.GetPassword(), user.PasswordHash) {
		return nil, status.Error(codes.Unauthenticated, auth.ErrInvalidPassword.Error())
	}
	token, sess, err := s.sessions.Create(user.ID, user.TenantID)
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	s.log.Info("autenticación OK", "user_id", user.ID, "session_id", sess.ID)
	return &identityv1.AuthenticatePasswordResponse{
		Session: toProtoSession(sess, token),
		User:    toProtoUser(user),
	}, nil
}

func (s *Identity) ValidateSession(ctx context.Context, req *identityv1.ValidateSessionRequest) (*identityv1.ValidateSessionResponse, error) {
	if req.GetToken() == "" {
		return nil, status.Error(codes.InvalidArgument, "token vacío")
	}
	sess, err := s.sessions.Validate(req.GetToken())
	if err != nil {
		return &identityv1.ValidateSessionResponse{Valid: false}, nil
	}
	user, err := s.db.UserByID(sess.UserID)
	if err != nil {
		return &identityv1.ValidateSessionResponse{Valid: false}, nil
	}
	return &identityv1.ValidateSessionResponse{Valid: true, User: toProtoUser(user)}, nil
}

func (s *Identity) GetAuthorizationContext(ctx context.Context, req *identityv1.GetAuthorizationContextRequest) (*identityv1.GetAuthorizationContextResponse, error) {
	if req.GetSessionToken() == "" {
		return nil, status.Error(codes.InvalidArgument, "token vacío")
	}
	sess, err := s.sessions.Validate(req.GetSessionToken())
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "sesión inválida")
	}
	user, err := s.db.UserByID(sess.UserID)
	if err != nil {
		return nil, mapStoreErr(err)
	}
	tenant, err := s.db.TenantByID(sess.TenantID)
	if err != nil {
		return nil, mapStoreErr(err)
	}
	perms, features := authz.ContextOf(user.Roles)
	resp := &identityv1.GetAuthorizationContextResponse{
		User:   toProtoUser(user),
		Tenant: toProtoTenant(tenant),
	}
	for _, r := range user.Roles {
		resp.Roles = append(resp.Roles, &identityv1.Role{Key: string(r), Name: string(r)})
	}
	for _, p := range perms {
		resp.Permissions = append(resp.Permissions, &identityv1.Permission{Resource: p.Resource, Action: p.Action})
	}
	for _, f := range features {
		resp.Features = append(resp.Features, &identityv1.Feature{Key: f.Key, Enabled: f.Enabled})
	}
	return resp, nil
}

func (s *Identity) Logout(ctx context.Context, req *identityv1.LogoutRequest) (*identityv1.LogoutResponse, error) {
	if req.GetSessionToken() == "" {
		return nil, status.Error(codes.InvalidArgument, "token vacío")
	}
	s.sessions.Revoke(req.GetSessionToken())
	return &identityv1.LogoutResponse{}, nil
}

// Check implementa common.v1.HealthService (ADR-0005).
func (s *Identity) Check(ctx context.Context, req *commonv1.CheckRequest) (*commonv1.CheckResponse, error) {
	return &commonv1.CheckResponse{Status: commonv1.ServingStatus_SERVING_STATUS_SERVING}, nil
}

// --- conversores ---

func toProtoTenant(t *store.Tenant) *identityv1.Tenant {
	st := identityv1.TenantStatus_TENANT_STATUS_UNSPECIFIED
	if t.Status == "active" {
		st = identityv1.TenantStatus_TENANT_STATUS_ACTIVE
	}
	return &identityv1.Tenant{TenantId: t.ID, Name: t.Name, Status: st}
}

func toProtoUser(u *store.User) *identityv1.User {
	st := identityv1.UserStatus_USER_STATUS_UNSPECIFIED
	switch u.Status {
	case "active":
		st = identityv1.UserStatus_USER_STATUS_ACTIVE
	case "suspended":
		st = identityv1.UserStatus_USER_STATUS_SUSPENDED
	case "disabled":
		st = identityv1.UserStatus_USER_STATUS_DISABLED
	}
	return &identityv1.User{UserId: u.ID, TenantId: u.TenantID, Email: u.Email, Status: st}
}

func toProtoSession(sess *auth.Session, token string) *identityv1.Session {
	return &identityv1.Session{
		SessionId: sess.ID,
		UserId:    sess.UserID,
		Token:     token,
		ExpiresAt: timestamppb.New(sess.ExpiresAt),
	}
}
