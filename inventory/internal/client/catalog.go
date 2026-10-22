// Package client habla con otros contenedores por gRPC (grpc-conventions.md §5).
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

	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/pb"
)

// ErrUnavailable: catalog no respondió a tiempo.
var ErrUnavailable = errors.New("catalog unavailable")

// Product es lo que inventory necesita saber de un producto.
type Product struct {
	ID              string
	Active          bool
	TracksInventory bool
	TracksLots      bool // F16.4: las entradas exigen lote
}

// Catalog valida productos contra catalog (SPEC §7: 500 ms, lectura).
type Catalog struct {
	conn    *grpc.ClientConn
	api     pb.CatalogClient
	timeout time.Duration
}

// NewCatalog abre una conexión que se reconecta sola.
func NewCatalog(addr string, timeout time.Duration) (*Catalog, error) {
	conn, err := grpc.NewClient("passthrough:///"+addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithConnectParams(grpc.ConnectParams{Backoff: backoff.Config{
			BaseDelay: 200 * time.Millisecond, Multiplier: 1.6, Jitter: 0.2, MaxDelay: 5 * time.Second,
		}, MinConnectTimeout: 2 * time.Second}))
	if err != nil {
		return nil, fmt.Errorf("dial catalog: %w", err)
	}
	return &Catalog{conn: conn, api: pb.NewCatalogClient(conn), timeout: timeout}, nil
}

// Close cierra la conexión.
func (c *Catalog) Close() error { return c.conn.Close() }

// Product lee el producto con la identidad del llamador original (tenant y permisos viajan en
// los metadatos entrantes; ADR 0011).
func (c *Catalog) Product(ctx context.Context, productID string) (Product, error) {
	in, _ := metadata.FromIncomingContext(ctx)
	out := metadata.MD{}
	for _, k := range []string{"x-pp-tenant-id", "x-pp-user-id", "x-pp-request-id", "x-pp-capabilities"} {
		if v := in.Get(k); len(v) > 0 {
			out.Set(k, v...)
		}
	}
	// Leer el catálogo es lo mínimo que exige validar un movimiento (catalog:read es capacidad base).
	out.Set("x-pp-permissions", "catalog:read")
	out.Set("x-pp-actor-service", "inventory")
	ctx, cancel := context.WithTimeout(metadata.NewOutgoingContext(ctx, out), c.timeout)
	defer cancel()
	p, err := c.api.GetProduct(ctx, &pb.GetProductRequest{ProductId: productID})
	switch status.Code(err) {
	case codes.OK:
		return Product{ID: p.GetProductId(), Active: p.GetStatus() == pb.ProductStatus_PRODUCT_STATUS_ACTIVE,
			TracksInventory: p.GetTracksInventory(), TracksLots: p.GetTracksLots()}, nil
	case codes.NotFound:
		return Product{}, domain.ErrProductNotFound
	}
	return Product{}, fmt.Errorf("%w: %v", ErrUnavailable, err)
}
