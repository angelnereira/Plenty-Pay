// Package server es el adaptador gRPC de pos.
package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"time"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/pos/internal/client"
	"plentypay/pos/internal/domain"
	"plentypay/pos/internal/observability"
	"plentypay/pos/internal/pb"
	"plentypay/pos/internal/service"
	"plentypay/pos/internal/store"
	"plentypay/pos/internal/tenancy"
)

// PayLinkBase es la dirección pública de los códigos de cobro (la misma que imprime S-FIN-04).
const PayLinkBase = "https://plentypay.app/t/"

// ErrorInfo construye un error con `reason` estable (grpc-conventions.md §4).
func ErrorInfo(code codes.Code, reason, message string) error {
	st := status.New(code, message)
	if d, err := st.WithDetails(&errdetails.ErrorInfo{Reason: reason, Domain: "plentypay"}); err == nil {
		return d.Err()
	}
	return st.Err()
}

func toStatus(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, domain.ErrNotFound):
		return ErrorInfo(codes.NotFound, "NOT_FOUND", "no existe")
	case errors.Is(err, domain.ErrSessionOpen):
		return ErrorInfo(codes.AlreadyExists, "SESSION_ALREADY_OPEN", "esta caja ya tiene una sesión abierta")
	case errors.Is(err, domain.ErrSessionClosed):
		return ErrorInfo(codes.FailedPrecondition, "SESSION_CLOSED", "la sesión de caja está cerrada")
	case errors.Is(err, domain.ErrNotYourSession):
		return ErrorInfo(codes.PermissionDenied, "NOT_SESSION_OWNER", "la sesión es de otro cajero")
	case errors.Is(err, domain.ErrSalesPending):
		return ErrorInfo(codes.FailedPrecondition, "SALES_PENDING", "hay ventas esperando su cobro")
	case errors.Is(err, domain.ErrInvalidTransition):
		return ErrorInfo(codes.FailedPrecondition, "INVALID_STATE_TRANSITION", "la venta no admite ese cambio")
	case errors.Is(err, domain.ErrEmptySale):
		return ErrorInfo(codes.FailedPrecondition, "EMPTY_SALE", "agrega productos a la venta")
	case errors.Is(err, domain.ErrTendersMismatch):
		return ErrorInfo(codes.InvalidArgument, "TENDERS_MISMATCH", "los pagos no suman el total")
	case errors.Is(err, domain.ErrRailNotSupported):
		return ErrorInfo(codes.FailedPrecondition, "RAIL_NOT_SUPPORTED", "ese medio de pago aún no está disponible en caja")
	case errors.Is(err, domain.ErrHasCaptured):
		return ErrorInfo(codes.FailedPrecondition, "HAS_CAPTURED_PAYMENTS", "la venta ya tiene cobros; haz una devolución")
	case errors.Is(err, domain.ErrReasonRequired):
		return ErrorInfo(codes.InvalidArgument, "REASON_REQUIRED", "indica el motivo")
	case errors.Is(err, domain.ErrVersionConflict):
		return ErrorInfo(codes.Aborted, "VERSION_CONFLICT", "la venta cambió; vuelve a cargarla")
	case errors.Is(err, domain.ErrProductInactive), errors.Is(err, client.ErrProductNotFound):
		return ErrorInfo(codes.NotFound, "PRODUCT_NOT_FOUND", "el producto no existe o está archivado")
	case errors.Is(err, service.ErrDiscountNotAllowed):
		return ErrorInfo(codes.PermissionDenied, "DISCOUNT_EXCEEDS_LIMIT", "necesitas autorización para descontar")
	case errors.Is(err, domain.ErrInvalidLabel):
		return ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "la nota admite hasta 60 caracteres")
	case errors.Is(err, domain.ErrInvalidLine), errors.Is(err, domain.ErrInvalidAmount), errors.Is(err, domain.ErrOverflow):
		return ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", err.Error())
	case errors.Is(err, client.ErrUnavailable):
		return ErrorInfo(codes.Unavailable, "DEPENDENCY_UNAVAILABLE", "servicio temporalmente no disponible")
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		return status.Error(codes.DeadlineExceeded, "tiempo agotado")
	}
	return status.Error(codes.Internal, observability.Wrap(err, "pos").Error())
}

// Server implementa pb.PosServer.
type Server struct {
	pb.UnimplementedPosServer
	svc *service.Pos
}

// New arma el adaptador.
func New(svc *service.Pos) *Server { return &Server{svc: svc} }

// authorize: tenant, usuario y alguno de los permisos.
func authorize(ctx context.Context, perms ...string) (service.Actor, error) {
	a := tenancy.FromContext(ctx)
	act := service.Actor{TenantID: a.TenantID, UserID: a.UserID, RequestID: a.RequestID, Permissions: a.Permissions}
	if a.TenantID == "" || a.UserID == "" {
		return act, ErrorInfo(codes.PermissionDenied, "TENANT_REQUIRED", "necesitas un negocio activo")
	}
	for _, p := range perms {
		if a.Permissions[p] {
			return act, nil
		}
	}
	return act, ErrorInfo(codes.PermissionDenied, "PERMISSION_DENIED", "no tienes permiso")
}

func money(v int64, cur string) *pb.Money { return &pb.Money{AmountMinor: v, Currency: cur} }

func ts(t time.Time) *timestamppb.Timestamp {
	if t.IsZero() || t.Unix() == 0 {
		return nil
	}
	return timestamppb.New(t)
}

func sessionPB(s domain.Session) *pb.CashSession {
	out := &pb.CashSession{SessionId: s.ID, TerminalLabel: s.TerminalLabel, CashierUserId: s.CashierID, Status: s.Status,
		OpeningFloat: money(s.OpeningFloat, s.Currency), ExpectedCash: money(s.ExpectedCash, s.Currency),
		OpenedAt: ts(s.OpenedAt), ClosedAt: ts(s.ClosedAt), CloseNotes: s.CloseNotes}
	if s.Status == "CLOSED" {
		out.CountedCash, out.Difference = money(s.CountedCash, s.Currency), money(s.DifferenceMinor, s.Currency)
	}
	return out
}

// salePB incluye, para cada medio de billetera pendiente, el QR que el cliente escanea con su app.
func salePB(s domain.Sale, terminal string) *pb.Sale {
	out := &pb.Sale{SaleId: s.ID, SessionId: s.SessionID, Status: pb.SaleStatus(s.Status),
		Subtotal: money(s.SubtotalMinor, s.Currency), Tax: money(s.TaxMinor, s.Currency), Total: money(s.TotalMinor, s.Currency),
		ChangeDue: money(s.ChangeMinor, s.Currency), ClientSaleId: s.ClientSaleID, CreatedAt: ts(s.CreatedAt),
		PaidAt: ts(s.PaidAt), Version: s.Version, DocumentType: pb.DocumentType_DOCUMENT_TYPE_INTERNAL_RECEIPT,
		ParkLabel: s.ParkLabel, ParkedAt: ts(s.ParkedAt)}
	if s.ReceiptNumber > 0 {
		out.ReceiptNumber = fmt.Sprintf("%08d", s.ReceiptNumber)
	}
	for _, l := range s.Lines {
		out.Lines = append(out.Lines, &pb.SaleLine{LineId: l.ID, ProductId: l.ProductID, Description: l.Description,
			QuantityMilli: l.QtyMilli, UnitPrice: money(l.UnitPriceMinor, s.Currency), Discount: money(l.DiscountMinor, s.Currency),
			TaxRateBps: l.TaxRateBps, LineTotal: money(l.LineTotalMinor, s.Currency)})
	}
	for _, t := range s.Tenders {
		tp := &pb.Tender{Rail: pb.PaymentRail(t.Rail), Amount: money(t.AmountMinor, s.Currency), PaymentIntentId: t.PaymentIntentID,
			Status: t.Status}
		if t.Rail == domain.RailCash {
			tp.CashTendered = money(t.CashTendered, s.Currency)
		}
		if t.Rail == domain.RailWallet && t.Status == domain.TenderPending && terminal != "" {
			q := url.Values{"sale": {s.ID}, "amount": {fmt.Sprint(t.AmountMinor)}, "currency": {s.Currency}}
			link := PayLinkBase + url.PathEscape(terminal) + "?" + q.Encode()
			tp.NextAction = &pb.NextActionInfo{Type: "QR", Url: link, QrPayload: link}
		}
		out.Tenders = append(out.Tenders, tp)
	}
	return out
}

// terminalOf: la etiqueta de la sesión es el código del punto de cobro (S-FIN-04) en que cobra.
func (s *Server) terminalOf(ctx context.Context, a service.Actor, sale domain.Sale) (string, error) {
	ss, err := s.svc.GetSession(ctx, a, sale.SessionID)
	if err != nil {
		return "", toStatus(err)
	}
	return ss.TerminalLabel, nil
}

func (s *Server) OpenCashSession(ctx context.Context, req *pb.OpenCashSessionRequest) (*pb.CashSession, error) {
	a, err := authorize(ctx, "pos:session:manage", "pos:sell")
	if err != nil {
		return nil, err
	}
	ss, err := s.svc.OpenSession(ctx, a, req.GetTerminalLabel(), req.GetOpeningFloat().GetAmountMinor(), req.GetOpeningFloat().GetCurrency())
	if err != nil {
		return nil, toStatus(err)
	}
	return sessionPB(ss), nil
}

func (s *Server) GetCashSession(ctx context.Context, req *pb.GetCashSessionRequest) (*pb.CashSession, error) {
	a, err := authorize(ctx, "pos:session:manage", "pos:sell", "pos:read")
	if err != nil {
		return nil, err
	}
	ss, err := s.svc.GetSession(ctx, a, req.GetSessionId())
	if err != nil {
		return nil, toStatus(err)
	}
	return sessionPB(ss), nil
}

func (s *Server) CloseCashSession(ctx context.Context, req *pb.CloseCashSessionRequest) (*pb.CashSession, error) {
	a, err := authorize(ctx, "pos:session:manage", "pos:sell")
	if err != nil {
		return nil, err
	}
	ss, err := s.svc.CloseSession(ctx, a, req.GetSessionId(), req.GetCountedCash().GetAmountMinor(), req.GetNotes())
	if err != nil {
		return nil, toStatus(err)
	}
	return sessionPB(ss), nil
}

func (s *Server) RecordCashMovement(ctx context.Context, req *pb.RecordCashMovementRequest) (*pb.CashSession, error) {
	a, err := authorize(ctx, "pos:session:manage")
	if err != nil {
		return nil, err
	}
	ss, err := s.svc.RecordCashMovement(ctx, a, req.GetSessionId(), req.GetDirection(), req.GetAmount().GetAmountMinor(), req.GetReason())
	if err != nil {
		return nil, toStatus(err)
	}
	return sessionPB(ss), nil
}

func (s *Server) CreateSale(ctx context.Context, req *pb.CreateSaleRequest) (*pb.Sale, error) {
	a, err := authorize(ctx, "pos:sell")
	if err != nil {
		return nil, err
	}
	sale, err := s.svc.CreateSale(ctx, a, req.GetSessionId(), req.GetClientSaleId())
	if err != nil {
		return nil, toStatus(err)
	}
	return salePB(sale, ""), nil
}

func (s *Server) UpdateSale(ctx context.Context, req *pb.UpdateSaleRequest) (*pb.Sale, error) {
	a, err := authorize(ctx, "pos:sell")
	if err != nil {
		return nil, err
	}
	var in []service.LineInput
	for _, l := range req.GetLines() {
		in = append(in, service.LineInput{ProductID: l.GetProductId(), QtyMilli: l.GetQuantityMilli(),
			DiscountMinor: l.GetDiscount().GetAmountMinor()})
	}
	sale, err := s.svc.UpdateSale(ctx, a, req.GetSaleId(), req.GetExpectedVersion(), in)
	if err != nil {
		return nil, toStatus(err)
	}
	return salePB(sale, ""), nil
}

func (s *Server) Checkout(ctx context.Context, req *pb.PosCheckoutRequest) (*pb.Sale, error) {
	a, err := authorize(ctx, "pos:sell")
	if err != nil {
		return nil, err
	}
	var tenders []domain.Tender
	for _, t := range req.GetTenders() {
		tenders = append(tenders, domain.Tender{Rail: int16(t.GetRail()), AmountMinor: t.GetAmount().GetAmountMinor(),
			CashTendered: t.GetCashTendered().GetAmountMinor()})
	}
	sale, err := s.svc.Checkout(ctx, a, req.GetSaleId(), tenders)
	if err != nil {
		return nil, toStatus(err)
	}
	terminal, err := s.terminalOf(ctx, a, sale)
	if err != nil {
		return nil, err
	}
	return salePB(sale, terminal), nil
}

func (s *Server) VoidSale(ctx context.Context, req *pb.VoidSaleRequest) (*pb.Sale, error) {
	a, err := authorize(ctx, "pos:void")
	if err != nil {
		return nil, err
	}
	sale, err := s.svc.VoidSale(ctx, a, req.GetSaleId(), req.GetReason())
	if err != nil {
		return nil, toStatus(err)
	}
	return salePB(sale, ""), nil
}

// ParkSale estaciona una venta abierta de la sesión del cajero (F17.4, S-POS-06).
func (s *Server) ParkSale(ctx context.Context, req *pb.ParkSaleRequest) (*pb.Sale, error) {
	a, err := authorize(ctx, "pos:sell")
	if err != nil {
		return nil, err
	}
	sale, err := s.svc.ParkSale(ctx, a, req.GetSaleId(), req.GetLabel())
	if err != nil {
		return nil, toStatus(err)
	}
	return salePB(sale, ""), nil
}

// ResumeSale retoma una venta estacionada (F17.4).
func (s *Server) ResumeSale(ctx context.Context, req *pb.ResumeSaleRequest) (*pb.Sale, error) {
	a, err := authorize(ctx, "pos:sell")
	if err != nil {
		return nil, err
	}
	sale, err := s.svc.ResumeSale(ctx, a, req.GetSaleId())
	if err != nil {
		return nil, toStatus(err)
	}
	return salePB(sale, ""), nil
}

func (s *Server) GetSale(ctx context.Context, req *pb.GetSaleRequest) (*pb.Sale, error) {
	a, err := authorize(ctx, "pos:sell", "pos:read")
	if err != nil {
		return nil, err
	}
	sale, err := s.svc.GetSale(ctx, a, req.GetSaleId())
	if err != nil {
		return nil, toStatus(err)
	}
	terminal, err := s.terminalOf(ctx, a, sale)
	if err != nil {
		return nil, err
	}
	return salePB(sale, terminal), nil
}

func (s *Server) ListSales(ctx context.Context, req *pb.ListSalesRequest) (*pb.ListSalesResponse, error) {
	a, err := authorize(ctx, "pos:sell", "pos:read")
	if err != nil {
		return nil, err
	}
	f := store.SaleFilter{SessionID: req.GetSessionId(), Status: domain.Status(req.GetStatus()), Limit: 50}
	if n := int(req.GetPage().GetPageSize()); n > 0 && n <= 200 {
		f.Limit = n
	}
	if r := req.GetRange(); r != nil {
		if r.GetFrom() != nil {
			f.From = r.GetFrom().AsTime()
		}
		if r.GetTo() != nil {
			f.To = r.GetTo().AsTime()
		}
	}
	if t := req.GetPage().GetPageToken(); t != "" {
		var c store.SaleCursor
		b, err := base64.RawURLEncoding.DecodeString(t)
		if err == nil {
			err = json.Unmarshal(b, &c)
		}
		if err != nil {
			return nil, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "page_token inválido")
		}
		f.After = &c
	}
	items, next, err := s.svc.ListSales(ctx, a, f)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListSalesResponse{Page: &pb.PageInfo{}}
	if next != nil {
		b, err := json.Marshal(next)
		if err != nil {
			return nil, status.Error(codes.Internal, observability.Wrap(err, "encode page token").Error())
		}
		out.Page.NextPageToken = base64.RawURLEncoding.EncodeToString(b)
	}
	for _, sale := range items {
		out.Sales = append(out.Sales, salePB(sale, ""))
	}
	return out, nil
}
