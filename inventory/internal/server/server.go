// Package server es el adaptador gRPC de inventory.
package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"github.com/google/uuid"
	"time"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/inventory/internal/client"
	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/observability"
	"plentypay/inventory/internal/pb"
	"plentypay/inventory/internal/service"
	"plentypay/inventory/internal/store"
	"plentypay/inventory/internal/tenancy"
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
	switch {
	case err == nil:
		return nil
	case errors.Is(err, domain.ErrNotFound):
		return ErrorInfo(codes.NotFound, "NOT_FOUND", "no existe")
	case errors.Is(err, domain.ErrProductNotFound):
		return ErrorInfo(codes.NotFound, "VARIANT_NOT_FOUND", "el producto no existe o está archivado")
	case errors.Is(err, domain.ErrNotTracked):
		return ErrorInfo(codes.FailedPrecondition, "INVENTORY_NOT_TRACKED", "el producto no lleva inventario")
	case errors.Is(err, domain.ErrLotRequired):
		return ErrorInfo(codes.InvalidArgument, "LOT_REQUIRED", "este producto controla lotes: indica el lote")
	case errors.Is(err, domain.ErrLotExpired):
		return ErrorInfo(codes.FailedPrecondition, "LOT_EXPIRED", "el lote está vencido")
	case errors.Is(err, domain.ErrLotNotFound):
		return ErrorInfo(codes.NotFound, "LOT_NOT_FOUND", "ese lote no existe en esta bodega")
	case errors.Is(err, domain.ErrInvalidLot):
		return ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "código de lote inválido")
	case errors.Is(err, domain.ErrOutOfStock):
		return ErrorInfo(codes.FailedPrecondition, "OUT_OF_STOCK", "no hay existencia suficiente")
	case errors.Is(err, domain.ErrReasonRequired):
		return ErrorInfo(codes.InvalidArgument, "MOVEMENT_REASON_REQUIRED", "indica el motivo del ajuste")
	case errors.Is(err, domain.ErrInvalidMovementType), errors.Is(err, domain.ErrServiceOnly):
		return ErrorInfo(codes.InvalidArgument, "INVALID_MOVEMENT_TYPE", "tipo de movimiento no permitido")
	case errors.Is(err, domain.ErrInvalidQty):
		return ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "cantidad inválida para el tipo de movimiento")
	case errors.Is(err, domain.ErrSameWarehouse):
		return ErrorInfo(codes.InvalidArgument, "SAME_WAREHOUSE", "elige dos bodegas distintas")
	case errors.Is(err, domain.ErrInvalidWarehouse):
		return ErrorInfo(codes.InvalidArgument, "INVALID_WAREHOUSE", "bodega inválida o inactiva")
	case errors.Is(err, domain.ErrInvalidTransition):
		return ErrorInfo(codes.FailedPrecondition, "INVALID_STATE_TRANSITION", "la reserva ya no está activa")
	case errors.Is(err, domain.ErrInvalidSupplier):
		return ErrorInfo(codes.InvalidArgument, "INVALID_SUPPLIER", "revisa los datos del proveedor")
	case errors.Is(err, domain.ErrInvalidOrder):
		return ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "revisa las líneas de la orden")
	case errors.Is(err, domain.ErrPOTransition):
		return ErrorInfo(codes.FailedPrecondition, "INVALID_STATE_TRANSITION", "la orden no admite ese cambio en su estado")
	case errors.Is(err, domain.ErrOverReceipt):
		return ErrorInfo(codes.FailedPrecondition, "RECEIPT_EXCEEDS_ORDERED", "recibes más de lo pedido")
	case errors.Is(err, domain.ErrNotInOrder):
		return ErrorInfo(codes.InvalidArgument, "UNKNOWN_ORDER_LINE", "ese producto no está en la orden")
	case errors.Is(err, domain.ErrKeyReused):
		return ErrorInfo(codes.AlreadyExists, "IDEMPOTENCY_KEY_REUSED", "la clave de idempotencia ya se usó con otra operación")
	case errors.Is(err, client.ErrUnavailable):
		return ErrorInfo(codes.Unavailable, "DEPENDENCY_UNAVAILABLE", "servicio temporalmente no disponible")
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		return status.Error(codes.DeadlineExceeded, "tiempo agotado")
	}
	return status.Error(codes.Internal, observability.Wrap(err, "inventory").Error())
}

// Server implementa pb.InventoryServer.
type Server struct {
	pb.UnimplementedInventoryServer
	svc *service.Inventory
}

// New arma el adaptador.
func New(svc *service.Inventory) *Server { return &Server{svc: svc} }

// authorize: tenant obligatorio; una persona necesita el permiso; pos y orders (red interna)
// actúan con el permiso de su propio caso de uso.
func authorize(ctx context.Context, permission string) (tenancy.Actor, error) {
	a := tenancy.FromContext(ctx)
	if a.TenantID == "" {
		return a, ErrorInfo(codes.PermissionDenied, "TENANT_REQUIRED", "necesitas un negocio activo")
	}
	if domain.SellingServices[a.Service] || a.Permissions[permission] {
		return a, nil
	}
	return a, ErrorInfo(codes.PermissionDenied, "PERMISSION_DENIED", "no tienes permiso")
}

func caller(a tenancy.Actor) service.Caller {
	return service.Caller{TenantID: a.TenantID, UserID: a.UserID, Service: a.Service}
}

const minKey, maxKey = 16, 100

func checkKey(k string) error {
	if len(k) < minKey || len(k) > maxKey {
		return ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "la clave de idempotencia debe tener entre 16 y 100 caracteres")
	}
	return nil
}

func movementPB(m domain.Movement) *pb.StockMovement {
	return &pb.StockMovement{
		MovementId: m.ID, ProductId: m.ProductID, WarehouseId: m.WarehouseID, Type: pb.MovementType(m.Type),
		DeltaMilli: m.DeltaMilli, Reason: m.Reason,
		Reference:  &pb.Reference{Type: m.ReferenceType, Id: m.ReferenceID},
		OccurredAt: timestamppb.New(m.OccurredAt), ActorUserId: m.ActorUserID,
		LotId: m.LotID, LotCode: m.LotCode, LotExpiresAt: dateTS(m.LotExpiresOn),
	}
}

// optTime: un Timestamp ausente es «sin valor», nunca la época.
func optTime(ts *timestamppb.Timestamp) *time.Time {
	if ts == nil {
		return nil
	}
	v := ts.AsTime()
	return &v
}

// dateTS: una fecha pura (vencimiento de un lote) como 00:00 de ese día en Panamá.
func dateTS(d *time.Time) *timestamppb.Timestamp {
	if d == nil {
		return nil
	}
	return timestamppb.New(time.Date(d.Year(), d.Month(), d.Day(), 5, 0, 0, 0, time.UTC))
}

func lotPB(l domain.Lot, today time.Time) *pb.Lot {
	return &pb.Lot{LotId: l.ID, ProductId: l.ProductID, WarehouseId: l.WarehouseID, Code: l.Code,
		ExpiresAt: dateTS(l.ExpiresOn), OnHandMilli: l.OnHandMilli, Expired: l.Expired(today)}
}

// ListLots devuelve los lotes de un producto, primero los que vencen antes (F16.4, R5).
func (s *Server) ListLots(ctx context.Context, req *pb.ListLotsRequest) (*pb.ListLotsResponse, error) {
	a, err := authorize(ctx, "inventory:read")
	if err != nil {
		return nil, err
	}
	if _, err := uuid.Parse(req.GetProductId()); err != nil {
		return nil, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "producto inválido")
	}
	lots, err := s.svc.ListLots(ctx, a.TenantID, req.GetProductId(), req.GetWarehouseId(), req.GetIncludeEmpty())
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListLotsResponse{}
	today := domain.Today(time.Now())
	for _, l := range lots {
		out.Lots = append(out.Lots, lotPB(l, today))
	}
	return out, nil
}

func levelPB(l domain.Level) *pb.StockLevel {
	return &pb.StockLevel{ProductId: l.ProductID, WarehouseId: l.WarehouseID, OnHandMilli: l.OnHandMilli,
		ReservedMilli: l.ReservedMilli, AvailableMilli: l.Available(), ReorderPointMilli: l.ReorderPointMilli}
}

func warehousePB(w domain.Warehouse) *pb.Warehouse {
	return &pb.Warehouse{WarehouseId: w.ID, TenantId: w.TenantID, Name: w.Name, BranchCode: w.BranchCode,
		Active: w.Active, IsDefault: w.IsDefault}
}

func (s *Server) AdjustStock(ctx context.Context, req *pb.AdjustStockRequest) (*pb.StockMovement, error) {
	a, err := authorize(ctx, "inventory:adjust")
	if err != nil {
		return nil, err
	}
	if err := checkKey(req.GetIdempotencyKey()); err != nil {
		return nil, err
	}
	m, err := s.svc.AdjustStock(ctx, caller(a), service.AdjustRequest{
		IdempotencyKey: req.GetIdempotencyKey(), ProductID: req.GetProductId(), WarehouseID: req.GetWarehouseId(),
		DeltaMilli: req.GetDeltaMilli(), Type: domain.MovementType(req.GetType()), Reason: req.GetReason(),
		ReferenceType: req.GetReference().GetType(), ReferenceID: req.GetReference().GetId(),
		LotCode: req.GetLotCode(), LotExpiresOn: optTime(req.GetLotExpiresAt()),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return movementPB(m), nil
}

func (s *Server) TransferStock(ctx context.Context, req *pb.TransferStockRequest) (*pb.TransferStockResponse, error) {
	a, err := authorize(ctx, "inventory:adjust")
	if err != nil {
		return nil, err
	}
	if err := checkKey(req.GetIdempotencyKey()); err != nil {
		return nil, err
	}
	out, in, err := s.svc.TransferStock(ctx, caller(a), req.GetIdempotencyKey(), req.GetProductId(),
		req.GetFromWarehouseId(), req.GetToWarehouseId(), req.GetQuantityMilli(), req.GetReason(), req.GetLotCode())
	if err != nil {
		return nil, toStatus(err)
	}
	return &pb.TransferStockResponse{Out: movementPB(out), In: movementPB(in)}, nil
}

func (s *Server) GetStock(ctx context.Context, req *pb.GetStockRequest) (*pb.StockLevel, error) {
	a, err := authorize(ctx, "inventory:read")
	if err != nil {
		return nil, err
	}
	l, err := s.svc.GetStock(ctx, a.TenantID, req.GetProductId(), req.GetWarehouseId())
	if err != nil {
		return nil, toStatus(err)
	}
	return levelPB(l), nil
}

func pageSize(p *pb.PageRequest) int {
	switch n := int(p.GetPageSize()); {
	case n <= 0:
		return 50
	case n > 200:
		return 200
	default:
		return n
	}
}

func (s *Server) ListStock(ctx context.Context, req *pb.ListStockRequest) (*pb.ListStockResponse, error) {
	a, err := authorize(ctx, "inventory:read")
	if err != nil {
		return nil, err
	}
	after, err := decode[string](req.GetPage().GetPageToken())
	if err != nil {
		return nil, err
	}
	items, next, err := s.svc.ListStock(ctx, a.TenantID, req.GetWarehouseId(), req.GetOnlyLow(), after, pageSize(req.GetPage()))
	if err != nil {
		return nil, toStatus(err)
	}
	tok, err := encode(next, next == "")
	if err != nil {
		return nil, err
	}
	out := &pb.ListStockResponse{Page: &pb.PageInfo{NextPageToken: tok}}
	for _, l := range items {
		out.Levels = append(out.Levels, levelPB(l))
	}
	return out, nil
}

func (s *Server) ListMovements(ctx context.Context, req *pb.ListMovementsRequest) (*pb.ListMovementsResponse, error) {
	a, err := authorize(ctx, "inventory:read")
	if err != nil {
		return nil, err
	}
	var after *store.MovementCursor
	if t := req.GetPage().GetPageToken(); t != "" {
		c, err := decode[store.MovementCursor](t)
		if err != nil {
			return nil, err
		}
		after = &c
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
	items, next, err := s.svc.ListMovements(ctx, a.TenantID, req.GetProductId(), req.GetWarehouseId(), from, to, after, pageSize(req.GetPage()))
	if err != nil {
		return nil, toStatus(err)
	}
	tok, err := encode(next, next == nil)
	if err != nil {
		return nil, err
	}
	out := &pb.ListMovementsResponse{Page: &pb.PageInfo{NextPageToken: tok}}
	for _, m := range items {
		out.Movements = append(out.Movements, movementPB(m))
	}
	return out, nil
}

func (s *Server) UpsertWarehouse(ctx context.Context, req *pb.UpsertWarehouseRequest) (*pb.Warehouse, error) {
	a, err := authorize(ctx, "inventory:adjust")
	if err != nil {
		return nil, err
	}
	w := req.GetWarehouse()
	got, err := s.svc.UpsertWarehouse(ctx, a.TenantID, domain.Warehouse{ID: w.GetWarehouseId(), Name: w.GetName(),
		BranchCode: w.GetBranchCode(), Active: w.GetActive() || w.GetWarehouseId() == "", IsDefault: w.GetIsDefault()})
	if err != nil {
		return nil, toStatus(err)
	}
	return warehousePB(got), nil
}

func (s *Server) ListWarehouses(ctx context.Context, _ *pb.ListWarehousesRequest) (*pb.ListWarehousesResponse, error) {
	a, err := authorize(ctx, "inventory:read")
	if err != nil {
		return nil, err
	}
	items, err := s.svc.ListWarehouses(ctx, a.TenantID)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListWarehousesResponse{}
	for _, w := range items {
		out.Warehouses = append(out.Warehouses, warehousePB(w))
	}
	return out, nil
}

// encode/decode: el page_token es opaco (base64 de JSON).
func encode(v any, empty bool) (string, error) {
	if empty {
		return "", nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "", status.Error(codes.Internal, observability.Wrap(err, "encode page token").Error())
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func decode[T any](t string) (T, error) {
	var v T
	if t == "" {
		return v, nil
	}
	b, err := base64.RawURLEncoding.DecodeString(t)
	if err == nil {
		err = json.Unmarshal(b, &v)
	}
	if err != nil {
		return v, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "page_token inválido")
	}
	return v, nil
}

func reservationPB(r domain.Reservation) *pb.Reservation {
	out := &pb.Reservation{ReservationId: r.ID, WarehouseId: r.WarehouseID, Status: pb.ReservationStatus(r.Status),
		Reference: &pb.Reference{Type: r.ReferenceType, Id: r.ReferenceID}, ExpiresAt: timestamppb.New(r.ExpiresAt)}
	for _, l := range r.Lines {
		out.Lines = append(out.Lines, &pb.ReservationLine{ProductId: l.ProductID, QuantityMilli: l.QtyMilli})
	}
	return out
}

func (s *Server) ReserveStock(ctx context.Context, req *pb.ReserveStockRequest) (*pb.Reservation, error) {
	a, err := authorize(ctx, "inventory:adjust")
	if err != nil {
		return nil, err
	}
	if err := checkKey(req.GetIdempotencyKey()); err != nil {
		return nil, err
	}
	var lines []domain.ReservationLine
	for _, l := range req.GetLines() {
		lines = append(lines, domain.ReservationLine{ProductID: l.GetProductId(), QtyMilli: l.GetQuantityMilli()})
	}
	r, err := s.svc.ReserveStock(ctx, caller(a), service.ReserveRequest{IdempotencyKey: req.GetIdempotencyKey(),
		WarehouseID: req.GetWarehouseId(), Lines: lines, ReferenceType: req.GetReference().GetType(),
		ReferenceID: req.GetReference().GetId(), TTLSeconds: req.GetTtlSeconds(), AllowNegative: req.GetAllowNegative()})
	if err != nil {
		return nil, toStatus(err)
	}
	return reservationPB(r), nil
}

func (s *Server) CommitReservation(ctx context.Context, req *pb.CommitReservationRequest) (*pb.Reservation, error) {
	a, err := authorize(ctx, "inventory:adjust")
	if err != nil {
		return nil, err
	}
	r, err := s.svc.CommitReservation(ctx, caller(a), req.GetReservationId())
	if err != nil {
		return nil, toStatus(err)
	}
	return reservationPB(r), nil
}

func (s *Server) ReleaseReservation(ctx context.Context, req *pb.ReleaseReservationRequest) (*pb.Reservation, error) {
	a, err := authorize(ctx, "inventory:adjust")
	if err != nil {
		return nil, err
	}
	r, err := s.svc.ReleaseReservation(ctx, caller(a), req.GetReservationId())
	if err != nil {
		return nil, toStatus(err)
	}
	return reservationPB(r), nil
}
