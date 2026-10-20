package client

import (
	"context"
	"errors"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"plentypay/catalog/internal/pb"
)

// ErrTenantNotFound: identity no conoce el negocio.
var ErrTenantNotFound = errors.New("tenant not found")

// Identity lee el estado de un negocio (respaldo de la proyección de TenantStatusChanged: el
// stream PP_IDENTITY guarda 7 días y un negocio aprobado antes no se reproduce).
type Identity struct {
	conn    *grpc.ClientConn
	api     pb.IdentityClient
	timeout time.Duration
}

// NewIdentity abre la conexión.
func NewIdentity(addr string, timeout time.Duration) (*Identity, error) {
	conn, err := grpc.NewClient("passthrough:///"+addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithConnectParams(grpc.ConnectParams{Backoff: backoff.Config{
			BaseDelay: 200 * time.Millisecond, Multiplier: 1.6, Jitter: 0.2, MaxDelay: 5 * time.Second,
		}, MinConnectTimeout: 2 * time.Second}))
	if err != nil {
		return nil, fmt.Errorf("dial identity: %w", err)
	}
	return &Identity{conn: conn, api: pb.NewIdentityClient(conn), timeout: timeout}, nil
}

// Close cierra la conexión.
func (c *Identity) Close() error { return c.conn.Close() }

// TenantStatus devuelve identity.TenantStatus del negocio.
func (c *Identity) TenantStatus(ctx context.Context, requestID, tenantID string) (int16, error) {
	ctx = metadata.AppendToOutgoingContext(ctx, "x-pp-actor-service", "catalog", "x-pp-request-id", requestID)
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()
	t, err := c.api.GetTenant(ctx, &pb.GetTenantRequest{TenantId: tenantID})
	switch status.Code(err) {
	case codes.OK:
		return int16(t.GetStatus()), nil
	case codes.NotFound:
		return 0, ErrTenantNotFound
	}
	return 0, fmt.Errorf("%w: identity: %v", ErrUnavailable, err)
}
