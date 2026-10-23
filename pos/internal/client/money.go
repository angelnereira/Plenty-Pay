package client

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"plentypay/pos/internal/domain"
	"plentypay/pos/internal/pb"
)

// ── identity: solo ConsumeStepUp de las devoluciones (ADR 0023) ─────────────────────────────

// Identity consume tokens de confirmación fuerte.
type Identity struct {
	conn    *grpc.ClientConn
	api     pb.IdentityClient
	timeout time.Duration
}

// NewIdentity abre la conexión.
func NewIdentity(addr string, timeout time.Duration) (*Identity, error) {
	conn, err := dial(addr)
	if err != nil {
		return nil, fmt.Errorf("dial identity: %w", err)
	}
	return &Identity{conn: conn, api: pb.NewIdentityClient(conn), timeout: timeout}, nil
}

// Close cierra la conexión.
func (c *Identity) Close() error { return c.conn.Close() }

// ConsumeStepUp consume el token atado a la persona, la operación y el monto. Devuelve "" si fue
// válido o el motivo del rechazo («EXPIRED», «ALREADY_USED», «MISMATCH», «NOT_FOUND»).
func (c *Identity) ConsumeStepUp(ctx context.Context, w Who, token, operation string, amountMinor int64, currency string) (string, error) {
	md := metadata.Pairs("x-pp-actor-service", "pos")
	if w.RequestID != "" {
		md.Set("x-pp-request-id", w.RequestID)
	}
	ctx, cancel := context.WithTimeout(metadata.NewOutgoingContext(ctx, md), c.timeout)
	defer cancel()
	r, err := c.api.ConsumeStepUp(ctx, &pb.ConsumeStepUpRequest{Token: token, UserId: w.UserID, Operation: operation,
		AmountMinor: amountMinor, Currency: currency})
	if err != nil {
		return "", fmt.Errorf("%w: identity ConsumeStepUp: %v", ErrUnavailable, err)
	}
	if r.GetValid() {
		return "", nil
	}
	return r.GetReason(), nil
}

// ListBranches devuelve las sucursales que la persona ve (F17.12, R15): identity aplica su alcance
// con la identidad reenviada.
func (c *Identity) ListBranches(ctx context.Context, w Who) ([]domain.Branch, error) {
	md := metadata.Pairs("x-pp-actor-service", "pos", "x-pp-tenant-id", w.TenantID, "x-pp-user-id", w.UserID)
	if w.RequestID != "" {
		md.Set("x-pp-request-id", w.RequestID)
	}
	ctx, cancel := context.WithTimeout(metadata.NewOutgoingContext(ctx, md), c.timeout)
	defer cancel()
	r, err := c.api.ListBranches(ctx, &pb.ListBranchesRequest{})
	if err != nil {
		return nil, fmt.Errorf("%w: identity ListBranches: %v", ErrUnavailable, err)
	}
	out := make([]domain.Branch, 0, len(r.GetBranches()))
	for _, b := range r.GetBranches() {
		out = append(out, domain.Branch{ID: b.GetBranchId(), Code: b.GetCode(), Active: b.GetActive()})
	}
	return out, nil
}

// ── payments-core: reintegro de la parte en saldo PlentyPay (F17.9) ─────────────────────────

// Payments pide reembolsos de los cobros de una venta.
type Payments struct {
	conn    *grpc.ClientConn
	api     pb.PaymentsClient
	timeout time.Duration
}

// NewPayments abre la conexión.
func NewPayments(addr string, timeout time.Duration) (*Payments, error) {
	conn, err := dial(addr)
	if err != nil {
		return nil, fmt.Errorf("dial payments-core: %w", err)
	}
	return &Payments{conn: conn, api: pb.NewPaymentsClient(conn), timeout: timeout}, nil
}

// Close cierra la conexión.
func (c *Payments) Close() error { return c.conn.Close() }

// RefundOutcome es el resultado de pedir un reembolso.
type RefundOutcome int

const (
	RefundDone RefundOutcome = iota
	RefundPending
	RefundFailed
)

// Refund reintegra `amount` del cobro del intent al pagador, con el split del propio negocio
// (pos actúa como servicio interno, payments-core SPEC §8). La clave hace que un reintento nunca
// reembolse dos veces. Devuelve el código del fallo si payments-core lo rechazó.
func (c *Payments) Refund(ctx context.Context, w Who, intentID, key, reason string, amountMinor int64) (RefundOutcome, string, error) {
	ctx, cancel := context.WithTimeout(outgoing(ctx, w, ""), c.timeout)
	defer cancel()
	intent, err := c.api.GetPaymentIntent(ctx, &pb.GetPaymentIntentRequest{PaymentIntentId: intentID})
	if err != nil {
		return RefundPending, "", classify("payments-core", err)
	}
	if intent.GetPaymentId() == "" {
		return RefundFailed, "PAYMENT_NOT_CAPTURED", nil
	}
	r, err := c.api.RefundPayment(ctx, &pb.RefundPaymentRequest{PaymentId: intent.GetPaymentId(),
		Amount: &pb.Money{AmountMinor: amountMinor, Currency: "USD"}, Reason: reason, IdempotencyKey: key,
		MerchantPartyId: w.TenantID})
	if err != nil {
		switch status.Code(err) {
		case codes.InvalidArgument, codes.FailedPrecondition, codes.NotFound, codes.PermissionDenied, codes.AlreadyExists:
			return RefundFailed, status.Convert(err).Message(), nil
		}
		return RefundPending, "", fmt.Errorf("%w: payments-core RefundPayment: %v", ErrUnavailable, err)
	}
	switch r.GetStatus() {
	case pb.RefundStatus_REFUND_STATUS_SUCCEEDED:
		return RefundDone, "", nil
	case pb.RefundStatus_REFUND_STATUS_FAILED:
		return RefundFailed, "REFUND_FAILED", nil
	}
	return RefundPending, "", nil
}
