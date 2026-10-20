// Package client habla con catalog, inventory y payments-core (SPEC §7). orders se identifica como
// `x-pp-actor-service: orders`; reenvía el comprador (catalog, payments) o el comercio (inventory).
package client

import (
	"context"
	"errors"
	"fmt"
	"time"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"plentypay/orders/internal/pb"
)

// Errores de dependencia.
var (
	ErrUnavailable = errors.New("dependency unavailable")
	ErrNotFound    = errors.New("not found")
)

// Rejected es un "no" definitivo de otro servicio, con su `reason` estable.
type Rejected struct {
	Dep    string
	Reason string
}

func (r *Rejected) Error() string { return r.Dep + " rejected: " + r.Reason }

func reasonOf(err error) string {
	for _, d := range status.Convert(err).Details() {
		if info, ok := d.(*errdetails.ErrorInfo); ok {
			return info.GetReason()
		}
	}
	return ""
}

func classify(dep string, err error) error {
	switch status.Code(err) {
	case codes.OK:
		return nil
	case codes.NotFound:
		return fmt.Errorf("%w: %s", ErrNotFound, dep)
	case codes.InvalidArgument, codes.FailedPrecondition, codes.PermissionDenied, codes.AlreadyExists, codes.OutOfRange:
		return &Rejected{Dep: dep, Reason: reasonOf(err)}
	}
	return fmt.Errorf("%w: %s: %v", ErrUnavailable, dep, err)
}

func dial(addr string) (*grpc.ClientConn, error) {
	return grpc.NewClient("passthrough:///"+addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithConnectParams(grpc.ConnectParams{Backoff: backoff.Config{
			BaseDelay: 200 * time.Millisecond, Multiplier: 1.6, Jitter: 0.2, MaxDelay: 5 * time.Second,
		}, MinConnectTimeout: 2 * time.Second}))
}

func outgoing(ctx context.Context, userID, tenantID, requestID, stepUp string) context.Context {
	md := metadata.Pairs("x-pp-actor-service", "orders")
	if userID != "" {
		md.Set("x-pp-user-id", userID)
	}
	if tenantID != "" {
		md.Set("x-pp-tenant-id", tenantID)
	}
	if requestID != "" {
		md.Set("x-pp-request-id", requestID)
	}
	if stepUp != "" {
		md.Set("x-pp-step-up", stepUp)
	}
	return metadata.NewOutgoingContext(ctx, md)
}

// Clients agrupa las conexiones.
type Clients struct {
	conns     []*grpc.ClientConn
	catalog   pb.CatalogClient
	inventory pb.InventoryClient
	payments  pb.PaymentsClient
	timeout   time.Duration
	payTO     time.Duration
}

// New abre las tres conexiones (se reconectan solas).
func New(catalogAddr, inventoryAddr, paymentsAddr string, timeout, paymentsTimeout time.Duration) (*Clients, error) {
	c := &Clients{timeout: timeout, payTO: paymentsTimeout}
	for _, a := range []string{catalogAddr, inventoryAddr, paymentsAddr} {
		conn, err := dial(a)
		if err != nil {
			return nil, fmt.Errorf("dial %s: %w", a, err)
		}
		c.conns = append(c.conns, conn)
	}
	c.catalog = pb.NewCatalogClient(c.conns[0])
	c.inventory = pb.NewInventoryClient(c.conns[1])
	c.payments = pb.NewPaymentsClient(c.conns[2])
	return c, nil
}

// Close cierra las conexiones.
func (c *Clients) Close() error {
	var errs []error
	for _, conn := range c.conns {
		errs = append(errs, conn.Close())
	}
	return errors.Join(errs...)
}

// Listing es la instantánea de un producto publicado (R2: solo listados de comercios ACTIVE).
type Listing struct {
	ProductID       string
	TenantID        string
	MerchantName    string
	Name            string
	PriceMinor      int64
	Currency        string
	TaxRateBps      int32
	TracksInventory bool
	InStock         bool
	Pickup          bool
	Delivery        bool
}

// MarketplaceProduct lee un producto publicado en catalog.
func (c *Clients) MarketplaceProduct(ctx context.Context, buyer, requestID, productID string) (Listing, error) {
	ctx, cancel := context.WithTimeout(outgoing(ctx, buyer, "", requestID, ""), c.timeout)
	defer cancel()
	m, err := c.catalog.GetMarketplaceProduct(ctx, &pb.GetMarketplaceProductRequest{ProductId: productID})
	if err := classify("catalog", err); err != nil {
		return Listing{}, err
	}
	p := m.GetProduct()
	return Listing{ProductID: p.GetProductId(), TenantID: p.GetTenantId(), MerchantName: m.GetStorefront().GetDisplayName(),
		Name: p.GetName(), PriceMinor: m.GetListing().GetMarketplacePrice().GetAmountMinor(), Currency: p.GetPrice().GetCurrency(),
		TaxRateBps: p.GetTaxRateBps(), TracksInventory: p.GetTracksInventory(), InStock: m.GetInStock(),
		Pickup: m.GetListing().GetPickupAvailable(), Delivery: m.GetListing().GetDeliveryAvailable()}, nil
}

// ReserveLine es una línea a reservar.
type ReserveLine struct {
	ProductID string
	QtyMilli  int64
}

// Reserve aparta existencias en el comercio (todo o nada, inventory R4).
func (c *Clients) Reserve(ctx context.Context, tenantID, requestID, key, subOrderID string, lines []ReserveLine, ttlSeconds int32) (string, error) {
	ctx, cancel := context.WithTimeout(outgoing(ctx, "", tenantID, requestID, ""), c.timeout)
	defer cancel()
	req := &pb.ReserveStockRequest{IdempotencyKey: key, TtlSeconds: ttlSeconds,
		Reference: &pb.Reference{Type: "sub_order", Id: subOrderID}}
	for _, l := range lines {
		req.Lines = append(req.Lines, &pb.ReservationLine{ProductId: l.ProductID, QuantityMilli: l.QtyMilli})
	}
	r, err := c.inventory.ReserveStock(ctx, req)
	if err := classify("inventory", err); err != nil {
		return "", err
	}
	return r.GetReservationId(), nil
}

// Commit confirma la reserva (venta).
func (c *Clients) Commit(ctx context.Context, tenantID, reservationID string) error {
	ctx, cancel := context.WithTimeout(outgoing(ctx, "", tenantID, "", ""), c.timeout)
	defer cancel()
	_, err := c.inventory.CommitReservation(ctx, &pb.CommitReservationRequest{ReservationId: reservationID})
	return classify("inventory", err)
}

// Release libera la reserva.
func (c *Clients) Release(ctx context.Context, tenantID, reservationID string) error {
	ctx, cancel := context.WithTimeout(outgoing(ctx, "", tenantID, "", ""), c.timeout)
	defer cancel()
	_, err := c.inventory.ReleaseReservation(ctx, &pb.ReleaseReservationRequest{ReservationId: reservationID})
	return classify("inventory", err)
}

// Return devuelve existencias de una venta ya confirmada (orders R5).
func (c *Clients) Return(ctx context.Context, tenantID, key, subOrderID, productID string, qtyMilli int64) error {
	ctx, cancel := context.WithTimeout(outgoing(ctx, "", tenantID, "", ""), c.timeout)
	defer cancel()
	_, err := c.inventory.AdjustStock(ctx, &pb.AdjustStockRequest{IdempotencyKey: key, ProductId: productID, DeltaMilli: qtyMilli,
		Type: pb.MovementType_MOVEMENT_TYPE_RETURN, Reference: &pb.Reference{Type: "sub_order", Id: subOrderID}})
	return classify("inventory", err)
}

// Split es la parte de un comercio en el cobro.
type Split struct {
	TenantID    string
	SubOrderID  string
	AmountMinor int64
}

// Intent es lo que el comprador confirma.
type Intent struct {
	ID         string
	Status     string
	PaymentID  string
	ActionType string
	ActionURL  string
	ActionQR   string
}

func intentOf(i *pb.PaymentIntent) Intent {
	return Intent{ID: i.GetPaymentIntentId(), Status: i.GetStatus().String(), PaymentID: i.GetPaymentId(),
		ActionType: i.GetNextAction().GetType(), ActionURL: i.GetNextAction().GetUrl(), ActionQR: i.GetNextAction().GetQrPayload()}
}

// CreateIntent crea UN cobro con un split por comercio, a nombre del comprador (R3.4).
func (c *Clients) CreateIntent(ctx context.Context, buyer, requestID, stepUp, key, orderID string, currency string,
	total int64, rail int32, splits []Split, ttlSeconds int32) (Intent, error) {
	ctx, cancel := context.WithTimeout(outgoing(ctx, buyer, "", requestID, stepUp), c.payTO)
	defer cancel()
	req := &pb.CreatePaymentIntentRequest{IdempotencyKey: key, Amount: &pb.Money{AmountMinor: total, Currency: currency},
		Rail: pb.PaymentRail(rail), Reference: &pb.Reference{Type: "order", Id: orderID}, ExpiresInSeconds: ttlSeconds,
		StepUpToken: stepUp}
	for _, s := range splits {
		req.Splits = append(req.Splits, &pb.Split{MerchantPartyId: s.TenantID, Amount: &pb.Money{AmountMinor: s.AmountMinor, Currency: currency},
			Reference: &pb.Reference{Type: "sub_order", Id: s.SubOrderID}})
	}
	i, err := c.payments.CreatePaymentIntent(ctx, req)
	if err := classify("payments-core", err); err != nil {
		return Intent{}, err
	}
	return intentOf(i), nil
}

// GetIntent consulta el cobro (jobs de recuperación).
func (c *Clients) GetIntent(ctx context.Context, intentID string) (Intent, error) {
	ctx, cancel := context.WithTimeout(outgoing(ctx, "", "", "", ""), c.payTO)
	defer cancel()
	i, err := c.payments.GetPaymentIntent(ctx, &pb.GetPaymentIntentRequest{PaymentIntentId: intentID})
	if err := classify("payments-core", err); err != nil {
		return Intent{}, err
	}
	return intentOf(i), nil
}

// Refund devuelve todo el split de un comercio (orders R4/R5/R9), sin step-up: lo origina el
// sistema con una clave auditada.
func (c *Clients) Refund(ctx context.Context, key, paymentID, tenantID, reason string) error {
	ctx, cancel := context.WithTimeout(outgoing(ctx, "", "", "", ""), c.payTO)
	defer cancel()
	_, err := c.payments.RefundPayment(ctx, &pb.RefundPaymentRequest{PaymentId: paymentID, MerchantPartyId: tenantID,
		Reason: reason, IdempotencyKey: key})
	return classify("payments-core", err)
}
