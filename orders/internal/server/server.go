// Package server es el adaptador gRPC de orders.
package server

import (
	"context"
	"encoding/base64"
	"errors"
	"strconv"
	"time"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/orders/internal/client"
	"plentypay/orders/internal/domain"
	"plentypay/orders/internal/observability"
	"plentypay/orders/internal/pb"
	"plentypay/orders/internal/service"
	"plentypay/orders/internal/store"
	"plentypay/orders/internal/tenancy"
)

// ErrorInfo construye un error con `reason` estable (grpc-conventions.md §4).
func ErrorInfo(code codes.Code, reason, message string) error {
	st := status.New(code, message)
	if d, err := st.WithDetails(&errdetails.ErrorInfo{Reason: reason, Domain: "plentypay"}); err == nil {
		return d.Err()
	}
	return st.Err()
}

func toStatus(err error) error {
	var rej *client.Rejected
	switch {
	case err == nil:
		return nil
	case errors.Is(err, domain.ErrNotFound), errors.Is(err, client.ErrNotFound):
		return ErrorInfo(codes.NotFound, "NOT_FOUND", "no existe")
	case errors.Is(err, domain.ErrInvalidTransition):
		return ErrorInfo(codes.FailedPrecondition, "INVALID_STATE_TRANSITION", "el pedido no admite ese cambio")
	case errors.Is(err, domain.ErrCartLimit):
		return ErrorInfo(codes.FailedPrecondition, "CART_LIMIT", "el carrito admite 50 productos de 10 comercios")
	case errors.Is(err, domain.ErrListingUnavailable):
		return ErrorInfo(codes.FailedPrecondition, "LISTING_UNAVAILABLE", "el producto ya no está disponible")
	case errors.Is(err, domain.ErrPriceChanged):
		return ErrorInfo(codes.Aborted, "PRICE_CHANGED", "los precios cambiaron; revisa tu carrito")
	case errors.Is(err, domain.ErrOutOfStock):
		return ErrorInfo(codes.FailedPrecondition, "OUT_OF_STOCK", "no hay existencia suficiente")
	case errors.Is(err, domain.ErrDeliveryUnavailable):
		return ErrorInfo(codes.FailedPrecondition, "DELIVERY_UNAVAILABLE", "la entrega a domicilio aún no está disponible")
	case errors.Is(err, domain.ErrDeadlinePassed):
		return ErrorInfo(codes.FailedPrecondition, "ACCEPT_DEADLINE_PASSED", "venció el plazo para aceptar")
	case errors.Is(err, domain.ErrReasonRequired):
		return ErrorInfo(codes.InvalidArgument, "REASON_REQUIRED", "indica el motivo")
	case errors.Is(err, domain.ErrEmptyCart):
		return ErrorInfo(codes.FailedPrecondition, "EMPTY_CART", "tu carrito está vacío")
	case errors.Is(err, domain.ErrPickupCode):
		return ErrorInfo(codes.FailedPrecondition, "PICKUP_CODE_MISMATCH", "el código de retiro no coincide")
	case errors.Is(err, domain.ErrInvalidQty), errors.Is(err, domain.ErrOverflow):
		return ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", err.Error())
	case errors.Is(err, service.ErrRailNotSupported):
		return ErrorInfo(codes.FailedPrecondition, "RAIL_NOT_SUPPORTED", "por ahora el marketplace cobra con saldo PlentyPay")
	case errors.As(err, &rej):
		// El "no" de payments-core (step-up, límites, comercio inactivo…) llega tal cual a la app.
		return ErrorInfo(codes.FailedPrecondition, rej.Reason, "no se pudo completar el pago")
	case errors.Is(err, client.ErrUnavailable):
		return ErrorInfo(codes.Unavailable, "DEPENDENCY_UNAVAILABLE", "servicio temporalmente no disponible")
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		return status.Error(codes.DeadlineExceeded, "tiempo agotado")
	}
	return status.Error(codes.Internal, observability.Wrap(err, "orders").Error())
}

// Server implementa pb.OrdersServer.
type Server struct {
	pb.UnimplementedOrdersServer
	svc *service.Orders
}

// New arma el adaptador.
func New(svc *service.Orders) *Server { return &Server{svc: svc} }

func buyer(ctx context.Context, perm string) (service.Buyer, error) {
	a := tenancy.FromContext(ctx)
	if a.UserID == "" {
		return service.Buyer{}, ErrorInfo(codes.Unauthenticated, "UNAUTHENTICATED", "inicia sesión")
	}
	if !a.Permissions[perm] {
		return service.Buyer{}, ErrorInfo(codes.PermissionDenied, "PERMISSION_DENIED", "no tienes permiso")
	}
	return service.Buyer{UserID: a.UserID, RequestID: a.RequestID}, nil
}

func merchant(ctx context.Context, perm string) (service.Merchant, error) {
	a := tenancy.FromContext(ctx)
	if a.TenantID == "" {
		return service.Merchant{}, ErrorInfo(codes.PermissionDenied, "TENANT_REQUIRED", "necesitas un negocio activo")
	}
	if !a.Permissions[perm] {
		return service.Merchant{}, ErrorInfo(codes.PermissionDenied, "PERMISSION_DENIED", "no tienes permiso")
	}
	return service.Merchant{TenantID: a.TenantID, UserID: a.UserID}, nil
}

func money(v int64) *pb.Money { return &pb.Money{AmountMinor: v, Currency: "USD"} }

func ts(t time.Time) *timestamppb.Timestamp {
	if t.IsZero() || t.Unix() == 0 {
		return nil
	}
	return timestamppb.New(t)
}

func cartPB(items []domain.CartItem) *pb.Cart {
	out := &pb.Cart{}
	var latest time.Time
	for _, it := range items {
		out.Items = append(out.Items, &pb.CartItem{ProductId: it.ProductID, MerchantTenantId: it.TenantID, QuantityMilli: it.QtyMilli,
			UnitPriceSnapshot: money(it.UnitPriceMinor), NameSnapshot: it.Name})
		if it.AddedAt.After(latest) {
			latest = it.AddedAt
		}
	}
	out.UpdatedAt = ts(latest)
	return out
}

// subPB: el código de retiro solo viaja al comprador (forBuyer).
func subPB(s domain.SubOrder, forBuyer bool) *pb.SubOrder {
	out := &pb.SubOrder{SubOrderId: s.ID, OrderId: s.OrderID, MerchantTenantId: s.TenantID, Status: pb.SubOrderStatus(s.Status),
		Total: money(s.TotalMinor), Fulfillment: pb.FulfillmentMethod(s.Fulfillment), ReservationId: s.ReservationID,
		RejectionReason: s.RejectReason, AcceptanceDeadline: ts(s.AcceptDeadline)}
	if forBuyer {
		out.PickupCode = s.PickupCode
	}
	for _, l := range s.Lines {
		out.Lines = append(out.Lines, &pb.SubOrderLine{ProductId: l.ProductID, Name: l.Name, QuantityMilli: l.QtyMilli,
			UnitPrice: money(l.UnitPriceMinor), LineTotal: money(l.TotalMinor)})
	}
	return out
}

func orderPB(o domain.Order, forBuyer bool) *pb.Order {
	out := &pb.Order{OrderId: o.ID, BuyerUserId: o.BuyerID, Status: pb.OrderStatus(o.Status), GrandTotal: money(o.TotalMinor),
		PaymentIntentId: o.PaymentIntentID, Rail: pb.PaymentRail_PAYMENT_RAIL_WALLET, Fulfillment: pb.FulfillmentMethod(o.Fulfillment),
		CreatedAt: ts(o.CreatedAt)}
	for _, s := range o.Subs {
		out.SubOrders = append(out.SubOrders, subPB(s, forBuyer))
	}
	return out
}

func page(p *pb.PageRequest) (int, int, error) {
	limit := int(p.GetPageSize())
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := 0
	if t := p.GetPageToken(); t != "" {
		b, err := base64.RawURLEncoding.DecodeString(t)
		if err == nil {
			offset, err = strconv.Atoi(string(b))
		}
		if err != nil || offset < 0 || offset > 100000 {
			return 0, 0, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "page_token inválido")
		}
	}
	return offset, limit, nil
}

func next(offset, limit int, more bool) *pb.PageInfo {
	if !more {
		return &pb.PageInfo{}
	}
	return &pb.PageInfo{NextPageToken: base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset + limit)))}
}

func (s *Server) GetCart(ctx context.Context, _ *pb.GetCartRequest) (*pb.Cart, error) {
	b, err := buyer(ctx, "orders:create:self")
	if err != nil {
		return nil, err
	}
	items, err := s.svc.Cart(ctx, b)
	if err != nil {
		return nil, toStatus(err)
	}
	return cartPB(items), nil
}

func (s *Server) SetCartItem(ctx context.Context, req *pb.SetCartItemRequest) (*pb.Cart, error) {
	b, err := buyer(ctx, "orders:create:self")
	if err != nil {
		return nil, err
	}
	items, err := s.svc.SetCartItem(ctx, b, req.GetProductId(), req.GetQuantityMilli())
	if err != nil {
		return nil, toStatus(err)
	}
	return cartPB(items), nil
}

func (s *Server) ClearCart(ctx context.Context, _ *pb.ClearCartRequest) (*pb.Cart, error) {
	b, err := buyer(ctx, "orders:create:self")
	if err != nil {
		return nil, err
	}
	if err := s.svc.ClearCart(ctx, b); err != nil {
		return nil, toStatus(err)
	}
	return &pb.Cart{}, nil
}

func (s *Server) QuoteCheckout(ctx context.Context, req *pb.QuoteCheckoutRequest) (*pb.CheckoutQuote, error) {
	b, err := buyer(ctx, "orders:create:self")
	if err != nil {
		return nil, err
	}
	f := int16(req.GetFulfillment())
	if f == 0 {
		f = 2
	}
	q, err := s.svc.QuoteCheckout(ctx, b, f)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.CheckoutQuote{QuoteId: q.ID, GrandTotal: money(q.TotalMinor), CustomerFees: money(0), ExpiresAt: ts(q.ExpiresAt)}
	for _, m := range q.Merchants {
		out.Merchants = append(out.Merchants, &pb.MerchantQuote{MerchantTenantId: m.TenantID, MerchantName: m.MerchantName,
			ItemsTotal: money(m.TotalMinor), DeliveryFee: money(0), Tax: money(m.TaxMinor), AllInStock: m.AllInStock,
			UnavailableProductIds: m.Unavailable})
	}
	return out, nil
}

func (s *Server) Checkout(ctx context.Context, req *pb.OrderCheckoutRequest) (*pb.Order, error) {
	b, err := buyer(ctx, "orders:create:self")
	if err != nil {
		return nil, err
	}
	if n := len(req.GetIdempotencyKey()); n < 16 || n > 100 {
		return nil, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "la clave de idempotencia debe tener entre 16 y 100 caracteres")
	}
	f := int16(req.GetFulfillment())
	if f == 0 {
		f = 2
	}
	stepUp := req.GetStepUpToken()
	if stepUp == "" {
		stepUp = tenancy.StepUp(ctx)
	}
	o, err := s.svc.Checkout(ctx, b, service.CheckoutRequest{IdempotencyKey: req.GetIdempotencyKey(), QuoteID: req.GetQuoteId(),
		Fulfillment: f, Rail: int32(req.GetRail()), StepUp: stepUp})
	if err != nil {
		return nil, toStatus(err)
	}
	return orderPB(o, true), nil
}

func (s *Server) GetOrder(ctx context.Context, req *pb.GetOrderRequest) (*pb.Order, error) {
	a := tenancy.FromContext(ctx)
	if a.UserID == "" {
		return nil, ErrorInfo(codes.Unauthenticated, "UNAUTHENTICATED", "inicia sesión")
	}
	// El comprador ve su pedido; un comercio ve el pedido de sus sub-pedidos (sin el código de retiro).
	who := store.Who{UserID: a.UserID}
	if a.TenantID != "" && a.Permissions["orders:read"] {
		who.TenantID = a.TenantID
	}
	o, err := s.svc.GetOrder(ctx, who, req.GetOrderId())
	if err != nil {
		return nil, toStatus(err)
	}
	return orderPB(o, o.BuyerID == a.UserID), nil
}

func (s *Server) ListMyOrders(ctx context.Context, req *pb.ListMyOrdersRequest) (*pb.ListOrdersResponse, error) {
	b, err := buyer(ctx, "orders:read:self")
	if err != nil {
		return nil, err
	}
	offset, limit, err := page(req.GetPage())
	if err != nil {
		return nil, err
	}
	items, more, err := s.svc.ListMyOrders(ctx, b, domain.OrderStatus(req.GetStatus()), offset, limit)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListOrdersResponse{Page: next(offset, limit, more)}
	for _, o := range items {
		out.Orders = append(out.Orders, orderPB(o, true))
	}
	return out, nil
}

func (s *Server) CancelOrder(ctx context.Context, req *pb.CancelOrderRequest) (*pb.Order, error) {
	b, err := buyer(ctx, "orders:create:self")
	if err != nil {
		return nil, err
	}
	o, err := s.svc.Cancel(ctx, b, req.GetOrderId())
	if err != nil {
		return nil, toStatus(err)
	}
	return orderPB(o, true), nil
}

func (s *Server) ListMerchantOrders(ctx context.Context, req *pb.ListMerchantOrdersRequest) (*pb.ListSubOrdersResponse, error) {
	m, err := merchant(ctx, "orders:read")
	if err != nil {
		return nil, err
	}
	offset, limit, err := page(req.GetPage())
	if err != nil {
		return nil, err
	}
	var from, to time.Time
	if r := req.GetRange(); r != nil {
		if r.GetFrom() != nil {
			from = r.GetFrom().AsTime()
		}
		if r.GetTo() != nil {
			to = r.GetTo().AsTime()
		}
	}
	items, more, err := s.svc.ListMerchantSubs(ctx, m, domain.SubStatus(req.GetStatus()), from, to, offset, limit)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListSubOrdersResponse{Page: next(offset, limit, more)}
	for _, sub := range items {
		out.SubOrders = append(out.SubOrders, subPB(sub, false))
	}
	return out, nil
}

func (s *Server) AcceptSubOrder(ctx context.Context, req *pb.SubOrderActionRequest) (*pb.SubOrder, error) {
	m, err := merchant(ctx, "orders:manage")
	if err != nil {
		return nil, err
	}
	sub, err := s.svc.Accept(ctx, m, req.GetSubOrderId())
	if err != nil {
		return nil, toStatus(err)
	}
	return subPB(sub, false), nil
}

func (s *Server) RejectSubOrder(ctx context.Context, req *pb.RejectSubOrderRequest) (*pb.SubOrder, error) {
	m, err := merchant(ctx, "orders:manage")
	if err != nil {
		return nil, err
	}
	sub, err := s.svc.Reject(ctx, m, req.GetSubOrderId(), req.GetReason())
	if err != nil {
		return nil, toStatus(err)
	}
	return subPB(sub, false), nil
}

func (s *Server) MarkSubOrderReady(ctx context.Context, req *pb.SubOrderActionRequest) (*pb.SubOrder, error) {
	m, err := merchant(ctx, "orders:manage")
	if err != nil {
		return nil, err
	}
	sub, err := s.svc.MarkReady(ctx, m, req.GetSubOrderId())
	if err != nil {
		return nil, toStatus(err)
	}
	return subPB(sub, false), nil
}

func (s *Server) MarkSubOrderCompleted(ctx context.Context, req *pb.SubOrderActionRequest) (*pb.SubOrder, error) {
	m, err := merchant(ctx, "orders:manage")
	if err != nil {
		return nil, err
	}
	sub, err := s.svc.MarkCompleted(ctx, m, req.GetSubOrderId(), req.GetPickupCode())
	if err != nil {
		return nil, toStatus(err)
	}
	return subPB(sub, false), nil
}
