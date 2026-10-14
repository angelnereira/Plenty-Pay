package server

import (
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/observability"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/service"
	"plentypay/identity/internal/store"
)

// IdentityServer es el adaptador gRPC: traduce pb <-> service y los errores del
// servicio a AuthResult con `reason` estable. No contiene reglas de negocio:
// las tiene service/domain (go-standards.md seccion 2).
type IdentityServer struct {
	pb.UnimplementedIdentityServer
	users    store.UserStore
	tokens   *auth.TokenIssuer
	svc      *service.IdentityService
	stepUp   *auth.StepUpManager
	reporter *observability.Reporter
	metrics  *observability.Metrics
	// now es el reloj del servidor; se inyecta para que las pruebas sean deterministas.
	now func() time.Time
}

// NewIdentityServer cablea el servicio de identity sobre el store recibido.
func NewIdentityServer(users store.UserStore, tokens *auth.TokenIssuer, reporter *observability.Reporter, metrics *observability.Metrics) *IdentityServer {
	svc := service.New(users, tokens, reporter, metrics)
	return &IdentityServer{
		users:    users,
		tokens:   tokens,
		svc:      svc,
		stepUp:   auth.NewStepUpManager(),
		reporter: reporter,
		metrics:  metrics,
		now:      time.Now,
	}
}

// rejected construye un AuthResult fallido con su `reason` estable (docs/glossary.md §7.3).
func rejected(reason, message string) *pb.AuthResult {
	return &pb.AuthResult{Success: false, Reason: reason, ErrorMessage: message}
}

func toPB(r *service.AuthResult) *pb.AuthResult {
	if r == nil {
		return rejected("INTERNAL", "error interno")
	}
	return &pb.AuthResult{
		Success:      r.Success,
		Reason:       r.Reason,
		ErrorMessage: r.ErrorMessage,
		AccessToken:  r.AccessToken,
		RefreshToken: r.RefreshToken,
		UserId:       r.UserID,
		TenantId:     r.TenantID,
		Role:         pb.UserRole(pb.UserRole_value[r.Role]),
	}
}

func grantsFrom(req *pb.RegisterRequest) []service.ConsentGrant {
	out := make([]service.ConsentGrant, 0, len(req.Consents))
	for _, c := range req.Consents {
		if c == nil {
			continue
		}
		out = append(out, service.ConsentGrant{
			Purpose: c.Purpose, TextVersion: c.TextVersion, Granted: c.Granted,
			Channel: req.Channel, Device: req.Device,
		})
	}
	return out
}

// Register delega en el servicio (R1-R3, R18).
func (s *IdentityServer) Register(ctx context.Context, req *pb.RegisterRequest) (*pb.AuthResult, error) {
	res, err := s.svc.Register(ctx, service.RegisterInput{
		Email: req.Email, Password: req.Password, FullName: req.FullName,
		Role: req.Role.String(), TenantID: req.TenantId,
		Consents: grantsFrom(req), Now: s.now(),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	return toPB(res), nil
}

// Login delega en el servicio (R4).
func (s *IdentityServer) Login(ctx context.Context, req *pb.LoginRequest) (*pb.AuthResult, error) {
	res, err := s.svc.Login(ctx, req.Email, req.Password)
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	return toPB(res), nil
}

// ValidateToken delega en el servicio (R9).
func (s *IdentityServer) ValidateToken(_ context.Context, req *pb.ValidateTokenRequest) (*pb.ValidateTokenResult, error) {
	claims, err := s.svc.ValidateAccessToken(req.AccessToken)
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

// GetUserPermissions delega en el servicio (R10).
func (s *IdentityServer) GetUserPermissions(ctx context.Context, req *pb.GetUserPermissionsRequest) (*pb.UserPermissions, error) {
	perms, err := s.svc.PermissionsForUser(ctx, req.UserId)
	if err != nil {
		return &pb.UserPermissions{}, nil
	}
	return &pb.UserPermissions{
		Role:           pb.UserRole(pb.UserRole_value[perms.Role]),
		EnabledModules: perms.EnabledModules,
		Permissions:    perms.Permissions,
	}, nil
}

// RefreshToken delega en el servicio (F08.3 añade rotacion del refresh).
func (s *IdentityServer) RefreshToken(ctx context.Context, req *pb.RefreshTokenRequest) (*pb.AuthResult, error) {
	res, err := s.svc.Refresh(ctx, req.RefreshToken)
	if err != nil {
		return nil, status.Error(codes.Internal, "error interno")
	}
	return toPB(res), nil
}

// IssueStepUpChallenge emite un reto de confirmación fuerte (Passkey/WebAuthn) atado a la operación.
func (s *IdentityServer) IssueStepUpChallenge(_ context.Context, req *pb.StepUpRequest) (*pb.PasskeyChallenge, error) {
	chID, optionsJSON := s.stepUp.IssueChallenge(req.UserId, req.Operation, req.AmountMinor, req.Currency)
	return &pb.PasskeyChallenge{
		ChallengeId:           chID,
		PublicKeyOptionsJson: optionsJSON,
	}, nil
}

// VerifyStepUp valida el reto y emite un token de confirmación de un solo uso (TTL 5 min).
func (s *IdentityServer) VerifyStepUp(_ context.Context, req *pb.VerifyStepUpRequest) (*pb.StepUpToken, error) {
	token, expiresAt, err := s.stepUp.VerifyChallenge(req.ChallengeId, req.AssertionJson)
	if err != nil {
		return &pb.StepUpToken{}, nil
	}
	return &pb.StepUpToken{
		Token:     token,
		ExpiresAt: timestamppb.New(expiresAt),
	}, nil
}

// ConsumeStepUp valida y consume el token atado a la operación exacta. Single-use.
func (s *IdentityServer) ConsumeStepUp(_ context.Context, req *pb.ConsumeStepUpRequest) (*pb.ConsumeStepUpResult, error) {
	valid, reason := s.stepUp.ConsumeToken(req.Token, req.UserId, req.Operation, req.AmountMinor, req.Currency)
	return &pb.ConsumeStepUpResult{
		Valid:  valid,
		Reason: reason,
	}, nil
}
