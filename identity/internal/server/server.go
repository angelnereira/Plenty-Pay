package server

import (
	"context"
	"log"
	"regexp"
	"strings"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/store"
)

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// IdentityServer implementa los RPC ya implementados de identity.proto. Los demás devuelven
// UNIMPLEMENTED (pb.UnimplementedIdentityServer) hasta su paso del roadmap (identity/SPEC.md §12).
type IdentityServer struct {
	pb.UnimplementedIdentityServer
	users  store.UserStore
	tokens *auth.TokenIssuer
}

func NewIdentityServer(users store.UserStore, tokens *auth.TokenIssuer) *IdentityServer {
	return &IdentityServer{users: users, tokens: tokens}
}

// R1–R3 (identity/SPEC.md §5).
func (s *IdentityServer) Register(ctx context.Context, req *pb.RegisterRequest) (*pb.AuthResult, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !emailPattern.MatchString(email) {
		return &pb.AuthResult{Success: false, ErrorMessage: "correo inválido"}, nil
	}
	if len(req.Password) < 12 {
		return &pb.AuthResult{Success: false, ErrorMessage: "la contraseña debe tener al menos 12 caracteres"}, nil
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		log.Printf("error al hashear contraseña: %v", err)
		return &pb.AuthResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	user := &store.User{Email: email, PasswordHash: hash, FullName: req.FullName, Role: req.Role.String(), TenantID: req.TenantId}
	if err := s.users.Create(ctx, user); err != nil {
		if err == store.ErrEmailTaken {
			return &pb.AuthResult{Success: false, ErrorMessage: "ese correo ya está registrado"}, nil
		}
		log.Printf("error al crear usuario: %v", err)
		return &pb.AuthResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	return s.issueTokens(user)
}

// R4: mismo mensaje si el correo no existe o si la contraseña falla (anti-enumeración).
func (s *IdentityServer) Login(ctx context.Context, req *pb.LoginRequest) (*pb.AuthResult, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	user, err := s.users.FindByEmail(ctx, email)
	if err != nil || !auth.VerifyPassword(req.Password, user.PasswordHash) {
		return &pb.AuthResult{Success: false, ErrorMessage: "correo o contraseña incorrectos"}, nil
	}
	return s.issueTokens(user)
}

func (s *IdentityServer) ValidateToken(_ context.Context, req *pb.ValidateTokenRequest) (*pb.ValidateTokenResult, error) {
	claims, err := s.tokens.VerifyAccessToken(req.AccessToken)
	if err != nil {
		return &pb.ValidateTokenResult{Valid: false}, nil
	}
	return &pb.ValidateTokenResult{
		Valid:    true,
		UserId:   claims.UserID,
		TenantId: claims.TenantID,
		Role:     pb.UserRole(pb.UserRole_value[claims.Role]),
	}, nil
}

func (s *IdentityServer) GetUserPermissions(ctx context.Context, req *pb.GetUserPermissionsRequest) (*pb.UserPermissions, error) {
	user, err := s.users.FindByID(ctx, req.UserId)
	if err != nil {
		return &pb.UserPermissions{}, nil
	}
	// R10: módulos derivados de permisos (security-standards.md §3). Roles personalizados por comercio: F08.6.
	perms := auth.PermissionsFor(user.Role)
	return &pb.UserPermissions{
		Role:           pb.UserRole(pb.UserRole_value[user.Role]),
		EnabledModules: auth.ModulesForPermissions(perms),
		Permissions:    perms,
	}, nil
}

// R6: un access token nunca sirve como refresh token (secretos distintos).
func (s *IdentityServer) RefreshToken(ctx context.Context, req *pb.RefreshTokenRequest) (*pb.AuthResult, error) {
	claims, err := s.tokens.VerifyRefreshToken(req.RefreshToken)
	if err != nil {
		return &pb.AuthResult{Success: false, ErrorMessage: "refresh token inválido o expirado"}, nil
	}
	user, err := s.users.FindByID(ctx, claims.UserID)
	if err != nil {
		return &pb.AuthResult{Success: false, ErrorMessage: "usuario no encontrado"}, nil
	}
	return s.issueTokens(user)
}

func (s *IdentityServer) issueTokens(user *store.User) (*pb.AuthResult, error) {
	access, err := s.tokens.IssueAccessToken(user.ID, user.TenantID, user.Role)
	if err != nil {
		log.Printf("error al emitir access token: %v", err)
		return &pb.AuthResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	refresh, err := s.tokens.IssueRefreshToken(user.ID, user.TenantID, user.Role)
	if err != nil {
		log.Printf("error al emitir refresh token: %v", err)
		return &pb.AuthResult{Success: false, ErrorMessage: "error interno"}, nil
	}
	return &pb.AuthResult{
		Success: true, AccessToken: access, RefreshToken: refresh,
		UserId: user.ID, TenantId: user.TenantID, Role: pb.UserRole(pb.UserRole_value[user.Role]),
	}, nil
}
