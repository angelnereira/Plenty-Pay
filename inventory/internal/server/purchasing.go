package server

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/inventory/internal/domain"
	"plentypay/inventory/internal/pb"
	"plentypay/inventory/internal/tenancy"
)

// authorizePerson: compras y recepción las hace una persona con su permiso, nunca pos u orders.
func authorizePerson(ctx context.Context, permission string) (tenancy.Actor, error) {
	a := tenancy.FromContext(ctx)
	if a.TenantID == "" {
		return a, ErrorInfo(codes.PermissionDenied, "TENANT_REQUIRED", "necesitas un negocio activo")
	}
	if a.Permissions[permission] {
		return a, nil
	}
	return a, ErrorInfo(codes.PermissionDenied, "PERMISSION_DENIED", "no tienes permiso")
}

func supplierPB(s domain.Supplier) *pb.Supplier {
	return &pb.Supplier{SupplierId: s.ID, Name: s.Name, TaxId: s.TaxID, CheckDigit: s.CheckDigit, Email: s.Email,
		Phone: s.Phone, Active: s.Active, LeadTimeDays: int32(s.LeadTimeDays)}
}

func poPB(o domain.PurchaseOrder) *pb.PurchaseOrder {
	out := &pb.PurchaseOrder{PurchaseOrderId: o.ID, SupplierId: o.SupplierID, SupplierName: o.SupplierName,
		WarehouseId: o.WarehouseID, Status: pb.PurchaseOrderStatus(o.Status),
		Total: &pb.Money{AmountMinor: o.TotalMinor, Currency: "USD"}, CreatedAt: timestamppb.New(o.CreatedAt),
		Version: int32(o.Version)}
	if o.ExpectedAt != nil {
		out.ExpectedAt = timestamppb.New(*o.ExpectedAt)
	}
	for _, l := range o.Lines {
		out.Lines = append(out.Lines, &pb.PurchaseOrderLine{ProductId: l.ProductID, OrderedMilli: l.OrderedMilli,
			ReceivedMilli: l.ReceivedMilli, UnitCost: &pb.Money{AmountMinor: l.UnitCostMinor, Currency: "USD"}})
	}
	return out
}

func (s *Server) UpsertSupplier(ctx context.Context, req *pb.UpsertSupplierRequest) (*pb.Supplier, error) {
	a, err := authorizePerson(ctx, "inventory:purchase:manage")
	if err != nil {
		return nil, err
	}
	in := req.GetSupplier()
	if in == nil {
		return nil, toStatus(domain.ErrInvalidSupplier)
	}
	sup, err := s.svc.UpsertSupplier(ctx, caller(a), domain.Supplier{ID: in.GetSupplierId(), Name: in.GetName(),
		TaxID: in.GetTaxId(), CheckDigit: in.GetCheckDigit(), Email: in.GetEmail(), Phone: in.GetPhone(),
		LeadTimeDays: int(in.GetLeadTimeDays()), Active: in.GetActive() || in.GetSupplierId() == ""}, req.GetIdempotencyKey())
	if err != nil {
		return nil, toStatus(err)
	}
	return supplierPB(sup), nil
}

func (s *Server) ListSuppliers(ctx context.Context, req *pb.ListSuppliersRequest) (*pb.ListSuppliersResponse, error) {
	a, err := authorizePerson(ctx, "inventory:purchase:manage")
	if err != nil {
		if a2, err2 := authorizePerson(ctx, "inventory:read"); err2 == nil {
			a, err = a2, nil
		} else {
			return nil, err
		}
	}
	list, next, err := s.svc.ListSuppliers(ctx, a.TenantID, req.GetPage().GetPageToken(), pageSize(req.GetPage()))
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListSuppliersResponse{Page: &pb.PageInfo{NextPageToken: next}}
	for _, sup := range list {
		out.Suppliers = append(out.Suppliers, supplierPB(sup))
	}
	return out, nil
}

func (s *Server) CreatePurchaseOrder(ctx context.Context, req *pb.CreatePurchaseOrderRequest) (*pb.PurchaseOrder, error) {
	a, err := authorizePerson(ctx, "inventory:purchase:manage")
	if err != nil {
		return nil, err
	}
	if err := checkKey(req.GetIdempotencyKey()); err != nil {
		return nil, err
	}
	in := req.GetOrder()
	o := domain.PurchaseOrder{SupplierID: in.GetSupplierId(), WarehouseID: in.GetWarehouseId()}
	if in.GetExpectedAt() != nil {
		t := in.GetExpectedAt().AsTime()
		o.ExpectedAt = &t
	}
	for _, l := range in.GetLines() {
		o.Lines = append(o.Lines, domain.POLine{ProductID: l.GetProductId(), OrderedMilli: l.GetOrderedMilli(),
			UnitCostMinor: l.GetUnitCost().GetAmountMinor()})
	}
	out, err := s.svc.CreatePurchaseOrder(ctx, caller(a), o, req.GetIdempotencyKey())
	if err != nil {
		return nil, toStatus(err)
	}
	return poPB(out), nil
}

func (s *Server) UpdatePurchaseOrderStatus(ctx context.Context, req *pb.UpdatePurchaseOrderStatusRequest) (*pb.PurchaseOrder, error) {
	a, err := authorizePerson(ctx, "inventory:purchase:manage")
	if err != nil {
		return nil, err
	}
	out, err := s.svc.UpdatePurchaseOrderStatus(ctx, a.TenantID, req.GetPurchaseOrderId(), domain.POStatus(req.GetStatus()))
	if err != nil {
		return nil, toStatus(err)
	}
	return poPB(out), nil
}

func (s *Server) ReceiveGoods(ctx context.Context, req *pb.ReceiveGoodsRequest) (*pb.PurchaseOrder, error) {
	a, err := authorizePerson(ctx, "inventory:receive")
	if err != nil {
		return nil, err
	}
	if err := checkKey(req.GetIdempotencyKey()); err != nil {
		return nil, err
	}
	var in []domain.Received
	for _, l := range req.GetLines() {
		in = append(in, domain.Received{ProductID: l.GetProductId(), ReceivedMilli: l.GetReceivedMilli(),
			LotCode: l.GetLotCode(), LotExpiresOn: optTime(l.GetExpiresAt())})
	}
	out, err := s.svc.ReceiveGoods(ctx, caller(a), req.GetPurchaseOrderId(), req.GetIdempotencyKey(), req.GetSupplierInvoice(), in)
	if err != nil {
		return nil, toStatus(err)
	}
	return poPB(out), nil
}

func (s *Server) ListPurchaseOrders(ctx context.Context, req *pb.ListPurchaseOrdersRequest) (*pb.ListPurchaseOrdersResponse, error) {
	a, err := authorizePerson(ctx, "inventory:purchase:manage")
	if err != nil {
		if a2, err2 := authorizePerson(ctx, "inventory:receive"); err2 == nil {
			a, err = a2, nil
		} else {
			return nil, err
		}
	}
	list, next, err := s.svc.ListPurchaseOrders(ctx, a.TenantID, domain.POStatus(req.GetStatus()),
		req.GetPage().GetPageToken(), pageSize(req.GetPage()))
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListPurchaseOrdersResponse{Page: &pb.PageInfo{NextPageToken: next}}
	for _, o := range list {
		out.Orders = append(out.Orders, poPB(o))
	}
	return out, nil
}

func (s *Server) GetReorderSuggestions(ctx context.Context, req *pb.GetReorderSuggestionsRequest) (*pb.GetReorderSuggestionsResponse, error) {
	a, err := authorizePerson(ctx, "inventory:read")
	if err != nil {
		return nil, err
	}
	list, rows, err := s.svc.ReorderSuggestions(ctx, a.TenantID, req.GetWarehouseId())
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.GetReorderSuggestionsResponse{}
	for _, g := range list {
		r := rows[g.WarehouseID+"/"+g.ProductID]
		out.Suggestions = append(out.Suggestions, &pb.ReorderSuggestion{ProductId: g.ProductID, WarehouseId: g.WarehouseID,
			SuggestedQuantityMilli: g.SuggestedMilli, ReorderPointMilli: r.ReorderPoint, AvgDailyDemandMilli: g.VelocityMilli,
			DaysOfCover: g.DaysOfCover, AbcClass: g.ABC, AvailableMilli: g.AvailableMilli, InTransitMilli: g.InTransitMilli,
			SupplierId: r.SupplierID, SupplierName: r.SupplierName, LeadTimeDays: int32(g.LeadTimeDays)})
	}
	return out, nil
}
