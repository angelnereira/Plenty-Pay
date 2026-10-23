package client

import (
	"context"
	"errors"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/pb"
)

// ErrIdentityUnavailable: identity no respondió a tiempo (R11).
var ErrIdentityUnavailable = errors.New("identity unavailable")

// Identity lee las sucursales del negocio con la identidad de la persona que llama (F16.9, R11;
// SPEC §7: 500 ms, lectura). inventory se identifica como `x-pp-actor-service: inventory`.
type Identity struct {
	conn    *grpc.ClientConn
	api     pb.IdentityClient
	timeout time.Duration
}

// NewIdentity abre una conexión que se reconecta sola.
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

// ListBranches devuelve las sucursales que la persona ve (identity aplica su alcance).
func (c *Identity) ListBranches(ctx context.Context) ([]domain.Branch, error) {
	in, _ := metadata.FromIncomingContext(ctx)
	out := metadata.MD{}
	for _, k := range []string{"x-pp-tenant-id", "x-pp-user-id", "x-pp-request-id"} {
		if v := in.Get(k); len(v) > 0 {
			out.Set(k, v[0])
		}
	}
	out.Set("x-pp-actor-service", "inventory")
	cctx, cancel := context.WithTimeout(metadata.NewOutgoingContext(ctx, out), c.timeout)
	defer cancel()
	res, err := c.api.ListBranches(cctx, &pb.ListBranchesRequest{})
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrIdentityUnavailable, err)
	}
	branches := make([]domain.Branch, 0, len(res.GetBranches()))
	for _, b := range res.GetBranches() {
		branches = append(branches, domain.Branch{ID: b.GetBranchId(), Code: b.GetCode(), Active: b.GetActive()})
	}
	return branches, nil
}
