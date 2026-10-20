// Package client habla con catalog e inventory por gRPC (grpc-conventions.md §5). pos se
// identifica como `x-pp-actor-service: pos` y reenvía tenant y usuario del cajero (ADR 0011).
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

	"plentypay/pos/internal/pb"
)

// Errores de dependencia.
var (
	ErrUnavailable     = errors.New("dependency unavailable")
	ErrProductNotFound = errors.New("product not found")
	ErrRejected        = errors.New("dependency rejected the request")
)

func dial(addr string) (*grpc.ClientConn, error) {
	return grpc.NewClient("passthrough:///"+addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithConnectParams(grpc.ConnectParams{Backoff: backoff.Config{
			BaseDelay: 200 * time.Millisecond, Multiplier: 1.6, Jitter: 0.2, MaxDelay: 5 * time.Second,
		}, MinConnectTimeout: 2 * time.Second}))
}

// Who es la identidad que pos reenvía.
type Who struct {
	TenantID  string
	UserID    string
	RequestID string
}

func outgoing(ctx context.Context, w Who, permissions string) context.Context {
	md := metadata.Pairs("x-pp-tenant-id", w.TenantID, "x-pp-actor-service", "pos", "x-pp-permissions", permissions)
	if w.UserID != "" {
		md.Set("x-pp-user-id", w.UserID)
	}
	if w.RequestID != "" {
		md.Set("x-pp-request-id", w.RequestID)
	}
	return metadata.NewOutgoingContext(ctx, md)
}

func classify(dep string, err error) error {
	switch status.Code(err) {
	case codes.OK:
		return nil
	case codes.NotFound:
		return fmt.Errorf("%w: %s: %v", ErrProductNotFound, dep, status.Convert(err).Message())
	case codes.InvalidArgument, codes.FailedPrecondition, codes.PermissionDenied, codes.AlreadyExists:
		return fmt.Errorf("%w: %s: %v", ErrRejected, dep, status.Convert(err).Message())
	}
	return fmt.Errorf("%w: %s: %v", ErrUnavailable, dep, err)
}

// Product es la instantánea que la venta guarda de un producto.
type Product struct {
	ID              string
	Name            string
	PriceMinor      int64
	Currency        string
	TaxRateBps      int32
	TracksInventory bool
	Active          bool
}

// Catalog lee productos (SPEC §7: 500 ms).
type Catalog struct {
	conn    *grpc.ClientConn
	api     pb.CatalogClient
	timeout time.Duration
}

// NewCatalog abre la conexión.
func NewCatalog(addr string, timeout time.Duration) (*Catalog, error) {
	conn, err := dial(addr)
	if err != nil {
		return nil, fmt.Errorf("dial catalog: %w", err)
	}
	return &Catalog{conn: conn, api: pb.NewCatalogClient(conn), timeout: timeout}, nil
}

// Close cierra la conexión.
func (c *Catalog) Close() error { return c.conn.Close() }

// Product lee el producto vigente del comercio.
func (c *Catalog) Product(ctx context.Context, w Who, productID string) (Product, error) {
	ctx, cancel := context.WithTimeout(outgoing(ctx, w, "catalog:read"), c.timeout)
	defer cancel()
	p, err := c.api.GetProduct(ctx, &pb.GetProductRequest{ProductId: productID})
	if err := classify("catalog", err); err != nil {
		return Product{}, err
	}
	return Product{ID: p.GetProductId(), Name: p.GetName(), PriceMinor: p.GetPrice().GetAmountMinor(),
		Currency: p.GetPrice().GetCurrency(), TaxRateBps: p.GetTaxRateBps(), TracksInventory: p.GetTracksInventory(),
		Active: p.GetStatus() == pb.ProductStatus_PRODUCT_STATUS_ACTIVE}, nil
}

// Inventory registra los movimientos de venta (SPEC §7: 1 s).
type Inventory struct {
	conn    *grpc.ClientConn
	api     pb.InventoryClient
	timeout time.Duration
}

// NewInventory abre la conexión.
func NewInventory(addr string, timeout time.Duration) (*Inventory, error) {
	conn, err := dial(addr)
	if err != nil {
		return nil, fmt.Errorf("dial inventory: %w", err)
	}
	return &Inventory{conn: conn, api: pb.NewInventoryClient(conn), timeout: timeout}, nil
}

// Close cierra la conexión.
func (c *Inventory) Close() error { return c.conn.Close() }

// Move registra SALE (−) o RETURN (+) con clave determinista: un reintento nunca descuenta dos veces.
func (c *Inventory) Move(ctx context.Context, w Who, key, saleID, productID string, movementType int16, qtyMilli int64) error {
	ctx, cancel := context.WithTimeout(outgoing(ctx, w, ""), c.timeout)
	defer cancel()
	delta := -qtyMilli
	if movementType == int16(pb.MovementType_MOVEMENT_TYPE_RETURN) {
		delta = qtyMilli
	}
	_, err := c.api.AdjustStock(ctx, &pb.AdjustStockRequest{IdempotencyKey: key, ProductId: productID,
		DeltaMilli: delta, Type: pb.MovementType(movementType), Reference: &pb.Reference{Type: "sale", Id: saleID}})
	return classify("inventory", err)
}
