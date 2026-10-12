package client

import (
	"context"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"plentypay/api-gateway/internal/observability"
	"plentypay/api-gateway/internal/pb"
)

// IdentityClient envuelve la conexión gRPC hacia identity. El gateway NUNCA valida un token por su cuenta
// (hoy HS256): pregunta aquí (ADR 0011). El resto del gateway no ve tipos pb: solo los de este paquete.
type IdentityClient struct {
	conn     *grpc.ClientConn
	client   pb.IdentityClient
	reporter *observability.Reporter
}

func NewIdentityClient(target string, reporter *observability.Reporter) (*IdentityClient, error) {
	// insecure: válido solo dentro de la red interna; Fase 5 agrega mTLS (ADR 0011).
	conn, err := grpc.NewClient(target,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithUnaryInterceptor(observability.UnaryClientInterceptor()))
	if err != nil {
		return nil, observability.Wrap(err, "create identity client")
	}
	return &IdentityClient{conn: conn, client: pb.NewIdentityClient(conn), reporter: reporter}, nil
}

func (c *IdentityClient) Close() error { return c.conn.Close() }

type ValidatedSession struct {
	Valid    bool
	UserID   string
	TenantID string
	Role     string
}

type AuthResult struct {
	Success      bool
	ErrorMessage string
	AccessToken  string
	RefreshToken string
	UserID       string
	TenantID     string
	Role         string
}

type Permissions struct {
	Role           string
	EnabledModules []string
	Permissions    []string
}

func withDeadline(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, 3*time.Second) // docs/standards/grpc-conventions.md §5
}

func (c *IdentityClient) ValidateToken(ctx context.Context, accessToken string) (*ValidatedSession, error) {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	res, err := c.client.ValidateToken(ctx, &pb.ValidateTokenRequest{AccessToken: accessToken})
	if err != nil {
		return nil, c.fail(ctx, "identity.ValidateToken", err)
	}
	return &ValidatedSession{Valid: res.Valid, UserID: res.UserId, TenantID: res.TenantId, Role: res.Role.String()}, nil
}

func toAuthResult(res *pb.AuthResult) *AuthResult {
	return &AuthResult{
		Success: res.Success, ErrorMessage: res.ErrorMessage,
		AccessToken: res.AccessToken, RefreshToken: res.RefreshToken,
		UserID: res.UserId, TenantID: res.TenantId, Role: res.Role.String(),
	}
}

func (c *IdentityClient) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	res, err := c.client.Login(ctx, &pb.LoginRequest{Email: email, Password: password})
	if err != nil {
		return nil, c.fail(ctx, "identity.Login", err)
	}
	return toAuthResult(res), nil
}

// RegisterCustomer registra SIEMPRE un CUSTOMER sin tenant: el gateway nunca reenvía un rol ni un
// tenant elegidos por quien llama (escalada de privilegios — api-gateway/SPEC.md R3).
func (c *IdentityClient) RegisterCustomer(ctx context.Context, email, password, fullName string) (*AuthResult, error) {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	res, err := c.client.Register(ctx, &pb.RegisterRequest{Email: email, Password: password, FullName: fullName, Role: pb.UserRole_CUSTOMER})
	if err != nil {
		return nil, c.fail(ctx, "identity.Register", err)
	}
	return toAuthResult(res), nil
}

func (c *IdentityClient) RefreshToken(ctx context.Context, refreshToken string) (*AuthResult, error) {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	res, err := c.client.RefreshToken(ctx, &pb.RefreshTokenRequest{RefreshToken: refreshToken})
	if err != nil {
		return nil, c.fail(ctx, "identity.RefreshToken", err)
	}
	return toAuthResult(res), nil
}

func (c *IdentityClient) GetPermissions(ctx context.Context, userID string) (*Permissions, error) {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	res, err := c.client.GetUserPermissions(ctx, &pb.GetUserPermissionsRequest{UserId: userID})
	if err != nil {
		return nil, c.fail(ctx, "identity.GetUserPermissions", err)
	}
	return &Permissions{Role: res.Role.String(), EnabledModules: res.EnabledModules, Permissions: res.Permissions}, nil
}

// fail registra una sola vez el fallo de identity como dependencia (reintentable) y devuelve el
// error con la operación que se intentaba (observability-standards.md §10).
func (c *IdentityClient) fail(ctx context.Context, op string, err error) error {
	wrapped := observability.Wrap(err, op)
	c.reporter.Dependency(ctx, "identity call failed", "identity", wrapped)
	return wrapped
}
