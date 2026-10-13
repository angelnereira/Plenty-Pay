package client

import (
	"context"
	"crypto/tls"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
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
	return NewIdentityClientWithCredentials(target, reporter, insecure.NewCredentials())
}

// NewIdentityClientWithCredentials permite inicializar el cliente con credenciales de transporte personalizadas.
func NewIdentityClientWithCredentials(target string, reporter *observability.Reporter, creds credentials.TransportCredentials) (*IdentityClient, error) {
	conn, err := grpc.NewClient(target,
		grpc.WithTransportCredentials(creds),
		grpc.WithUnaryInterceptor(observability.UnaryClientInterceptor(reporter.Metrics())))
	if err != nil {
		return nil, observability.Wrap(err, "create identity client")
	}
	return &IdentityClient{conn: conn, client: pb.NewIdentityClient(conn), reporter: reporter}, nil
}

// NewIdentityClientWithTLS inicializa el cliente con mTLS (SPIFFE, ADR 0011).
func NewIdentityClientWithTLS(target string, reporter *observability.Reporter, tlsConfig *tls.Config) (*IdentityClient, error) {
	return NewIdentityClientWithCredentials(target, reporter, credentials.NewTLS(tlsConfig))
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
	Reason       string // código estable de identity (docs/glossary.md §7.3); el gateway lo propaga tal cual
	AccessToken  string
	RefreshToken string
	UserID       string
	TenantID     string
	Role         string
}

// Consent es una aceptación del registro público (identity.proto ConsentGrant): la versión del
// texto que la persona vio la envía la app; el gateway NUNCA la inventa.
type Consent struct {
	Purpose     string
	TextVersion string
	Granted     bool
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
		Success: res.Success, ErrorMessage: res.ErrorMessage, Reason: res.Reason,
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
// `consents` son las aceptaciones de la persona (N-DAT-02); `channel` y `device` los fija el
// gateway, nunca el cliente (identity.proto RegisterRequest).
func (c *IdentityClient) RegisterCustomer(ctx context.Context, email, password, fullName string, consents []Consent, channel, device string) (*AuthResult, error) {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	pbConsents := make([]*pb.ConsentGrant, 0, len(consents))
	for _, consent := range consents {
		pbConsents = append(pbConsents, &pb.ConsentGrant{
			Purpose: consent.Purpose, TextVersion: consent.TextVersion, Granted: consent.Granted,
		})
	}
	res, err := c.client.Register(ctx, &pb.RegisterRequest{
		Email: email, Password: password, FullName: fullName, Role: pb.UserRole_CUSTOMER,
		Consents: pbConsents, Channel: channel, Device: device,
	})
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
