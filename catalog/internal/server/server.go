// Package server es el adaptador gRPC de catalog: traduce pb ↔ dominio, verifica el permiso del
// actor (segunda barrera tras el gateway) y convierte errores de dominio en `reason`.
package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/catalog/internal/client"
	"plentypay/catalog/internal/domain"
	"plentypay/catalog/internal/observability"
	"plentypay/catalog/internal/pb"
	"plentypay/catalog/internal/service"
	"plentypay/catalog/internal/store"
	"plentypay/catalog/internal/tenancy"
)

// ErrorInfo construye un error con `reason` estable (grpc-conventions.md §4).
func ErrorInfo(code codes.Code, reason, message string) error {
	st := status.New(code, message)
	if d, err := st.WithDetails(&errdetails.ErrorInfo{Reason: reason, Domain: "plentypay"}); err == nil {
		return d.Err()
	}
	return st.Err()
}

// toStatus traduce errores de dominio; lo desconocido es un defecto (INTERNAL, con pila en el log).
func toStatus(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, domain.ErrNotFound):
		return ErrorInfo(codes.NotFound, "NOT_FOUND", "no existe")
	case errors.Is(err, domain.ErrSKUTaken):
		return ErrorInfo(codes.AlreadyExists, "SKU_TAKEN", "ya existe un producto con ese código")
	case errors.Is(err, domain.ErrBarcodeTaken):
		return ErrorInfo(codes.AlreadyExists, "BARCODE_TAKEN", "ya existe un producto con ese código de barras")
	case errors.Is(err, domain.ErrCategoryTaken):
		return ErrorInfo(codes.AlreadyExists, "ALREADY_EXISTS", "ya existe una categoría con ese nombre")
	case errors.Is(err, domain.ErrInvalidBarcode):
		return ErrorInfo(codes.InvalidArgument, "INVALID_BARCODE", "código de barras inválido")
	case errors.Is(err, domain.ErrInvalidUnit):
		return ErrorInfo(codes.InvalidArgument, "INVALID_UNIT", "unidad inválida")
	case errors.Is(err, domain.ErrInvalidTaxRate):
		return ErrorInfo(codes.InvalidArgument, "INVALID_TAX_RATE", "la tasa de ITBMS no es una tasa vigente")
	case errors.Is(err, domain.ErrTaxTreatment):
		return ErrorInfo(codes.InvalidArgument, "TAX_TREATMENT_MISSING", "indica el tratamiento de ITBMS")
	case errors.Is(err, domain.ErrCategoryDepth):
		return ErrorInfo(codes.InvalidArgument, "CATEGORY_DEPTH_EXCEEDED", "máximo 4 niveles de categorías")
	case errors.Is(err, domain.ErrInvalidTransition):
		return ErrorInfo(codes.FailedPrecondition, "INVALID_STATE_TRANSITION", "el producto está archivado")
	case errors.Is(err, domain.ErrVersionConflict):
		return ErrorInfo(codes.Aborted, "VERSION_CONFLICT", "el producto cambió; vuelve a cargarlo")
	case errors.Is(err, domain.ErrInvalidName), errors.Is(err, domain.ErrInvalidSKU),
		errors.Is(err, domain.ErrInvalidPrice), errors.Is(err, domain.ErrInvalidCurrency),
		errors.Is(err, domain.ErrInvalidDescription), errors.Is(err, domain.ErrInvalidCategory):
		return ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", err.Error())
	case errors.Is(err, client.ErrUnavailable):
		return ErrorInfo(codes.Unavailable, "DEPENDENCY_UNAVAILABLE", "servicio temporalmente no disponible")
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		return status.Error(codes.DeadlineExceeded, "tiempo agotado")
	}
	return status.Error(codes.Internal, observability.Wrap(err, "catalog").Error())
}

// Server implementa pb.CatalogServer.
type Server struct {
	pb.UnimplementedCatalogServer
	svc *service.Catalog
}

// New arma el adaptador.
func New(svc *service.Catalog) *Server { return &Server{svc: svc} }

// authorize exige tenant y el permiso (el gateway ya lo comprobó; aquí es segunda barrera).
func authorize(ctx context.Context, permission string) (tenancy.Actor, error) {
	a := tenancy.FromContext(ctx)
	if a.TenantID == "" {
		return a, ErrorInfo(codes.PermissionDenied, "TENANT_REQUIRED", "necesitas un negocio activo")
	}
	if !a.Permissions[permission] {
		return a, ErrorInfo(codes.PermissionDenied, "PERMISSION_DENIED", "no tienes permiso")
	}
	return a, nil
}

func fromPB(p *pb.Product) domain.Product {
	if p == nil {
		return domain.Product{}
	}
	return domain.Product{
		ID: p.GetProductId(), SKU: p.GetSku(), Barcode: p.GetBarcode(), Name: p.GetName(),
		Description: p.GetDescription(), CategoryID: p.GetCategoryId(), Brand: p.GetBrand(),
		UnitType: p.GetUnitType(), PriceMinor: p.GetPrice().GetAmountMinor(), Currency: p.GetPrice().GetCurrency(),
		TaxRateBps: p.GetTaxRateBps(), CPBSCode: p.GetCpbsCode(), ImageObjectKeys: p.GetImageObjectKeys(),
		Attributes: p.GetAttributes(), TracksInventory: p.GetTracksInventory(), Version: p.GetVersion(),
	}
}

func toPB(p domain.Product) *pb.Product {
	return &pb.Product{
		ProductId: p.ID, TenantId: p.TenantID, Sku: p.SKU, Barcode: p.Barcode, Name: p.Name,
		Description: p.Description, CategoryId: p.CategoryID, Brand: p.Brand, UnitType: p.UnitType,
		Price: &pb.Money{AmountMinor: p.PriceMinor, Currency: p.Currency}, TaxRateBps: p.TaxRateBps,
		CpbsCode: p.CPBSCode, ImageObjectKeys: p.ImageObjectKeys, Attributes: p.Attributes,
		Status: pb.ProductStatus(p.Status), TracksInventory: p.TracksInventory, TaxExempt: p.TaxRateBps == 0,
		UpdatedAt: timestamppb.New(p.UpdatedAt), Version: p.Version,
	}
}

// taxRateSet: proto3 no distingue «0» de «ausente» en int32, así que el exento se declara con
// `tax_exempt` (N-FIS-01: el tratamiento nunca se asume). Exento con tasa > 0 es contradictorio.
func taxRateSet(p *pb.Product) (bool, error) {
	if p.GetTaxExempt() && p.GetTaxRateBps() != 0 {
		return false, ErrorInfo(codes.InvalidArgument, "INVALID_TAX_RATE", "un producto exento no lleva tasa")
	}
	return p.GetTaxRateBps() > 0 || p.GetTaxExempt(), nil
}

func (s *Server) CreateProduct(ctx context.Context, req *pb.CreateProductRequest) (*pb.Product, error) {
	a, err := authorize(ctx, "catalog:write")
	if err != nil {
		return nil, err
	}
	if req.GetProduct() == nil {
		return nil, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "falta el producto")
	}
	taxSet, err := taxRateSet(req.GetProduct())
	if err != nil {
		return nil, err
	}
	p, err := s.svc.CreateProduct(ctx, a.TenantID, a.UserID, a.RequestID, fromPB(req.GetProduct()), taxSet)
	if err != nil {
		return nil, toStatus(err)
	}
	return toPB(p), nil
}

func (s *Server) UpdateProduct(ctx context.Context, req *pb.UpdateProductRequest) (*pb.Product, error) {
	a, err := authorize(ctx, "catalog:write")
	if err != nil {
		return nil, err
	}
	if req.GetProduct().GetProductId() == "" {
		return nil, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "falta product_id")
	}
	p, err := s.svc.UpdateProduct(ctx, a.TenantID, a.RequestID, fromPB(req.GetProduct()), req.GetUpdateMask())
	if err != nil {
		return nil, toStatus(err)
	}
	return toPB(p), nil
}

func (s *Server) ArchiveProduct(ctx context.Context, req *pb.ArchiveProductRequest) (*pb.Product, error) {
	a, err := authorize(ctx, "catalog:write")
	if err != nil {
		return nil, err
	}
	p, err := s.svc.ArchiveProduct(ctx, a.TenantID, req.GetProductId())
	if err != nil {
		return nil, toStatus(err)
	}
	return toPB(p), nil
}

func (s *Server) GetProduct(ctx context.Context, req *pb.GetProductRequest) (*pb.Product, error) {
	a, err := authorize(ctx, "catalog:read")
	if err != nil {
		return nil, err
	}
	p, err := s.svc.GetProduct(ctx, a.TenantID, req.GetProductId())
	if err != nil {
		return nil, toStatus(err)
	}
	return toPB(p), nil
}

func (s *Server) LookupByBarcode(ctx context.Context, req *pb.LookupByBarcodeRequest) (*pb.Product, error) {
	a, err := authorize(ctx, "catalog:read")
	if err != nil {
		return nil, err
	}
	p, err := s.svc.LookupByBarcode(ctx, a.TenantID, strings.TrimSpace(req.GetBarcode()))
	if err != nil {
		return nil, toStatus(err)
	}
	return toPB(p), nil
}

// pageToken es opaco para el cliente: base64 del cursor JSON.
func encodeToken(c *store.Cursor) (string, error) {
	if c == nil {
		return "", nil
	}
	b, err := json.Marshal(c)
	if err != nil {
		return "", status.Error(codes.Internal, observability.Wrap(err, "encode page token").Error())
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func decodeToken(t string) (store.Cursor, error) {
	var c store.Cursor
	if t == "" {
		return c, nil
	}
	b, err := base64.RawURLEncoding.DecodeString(t)
	if err != nil {
		return c, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "page_token inválido")
	}
	if err := json.Unmarshal(b, &c); err != nil {
		return c, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "page_token inválido")
	}
	return c, nil
}

func pageSize(p *pb.PageRequest) int {
	n := int(p.GetPageSize())
	if n <= 0 {
		return 50
	}
	if n > 200 {
		return 200
	}
	return n
}

func (s *Server) ListProducts(ctx context.Context, req *pb.ListProductsRequest) (*pb.ListProductsResponse, error) {
	a, err := authorize(ctx, "catalog:read")
	if err != nil {
		return nil, err
	}
	after, err := decodeToken(req.GetPage().GetPageToken())
	if err != nil {
		return nil, err
	}
	items, next, err := s.svc.ListProducts(ctx, a.TenantID, store.ListFilter{
		Query: req.GetQuery(), CategoryID: req.GetCategoryId(), Status: domain.Status(req.GetStatus()),
		PageSize: pageSize(req.GetPage()), After: after,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	token, err := encodeToken(next)
	if err != nil {
		return nil, err
	}
	out := &pb.ListProductsResponse{Page: &pb.PageInfo{NextPageToken: token}}
	for _, p := range items {
		out.Products = append(out.Products, toPB(p))
	}
	return out, nil
}

func (s *Server) UpsertCategory(ctx context.Context, req *pb.UpsertCategoryRequest) (*pb.Category, error) {
	a, err := authorize(ctx, "catalog:write")
	if err != nil {
		return nil, err
	}
	c := req.GetCategory()
	got, err := s.svc.UpsertCategory(ctx, a.TenantID, domain.Category{ID: c.GetCategoryId(), ParentID: c.GetParentId(), Name: c.GetName()})
	if err != nil {
		return nil, toStatus(err)
	}
	return &pb.Category{CategoryId: got.ID, TenantId: got.TenantID, Name: got.Name, ParentId: got.ParentID}, nil
}

func (s *Server) ListCategories(ctx context.Context, _ *pb.ListCategoriesRequest) (*pb.ListCategoriesResponse, error) {
	a, err := authorize(ctx, "catalog:read")
	if err != nil {
		return nil, err
	}
	items, err := s.svc.ListCategories(ctx, a.TenantID)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListCategoriesResponse{}
	for _, c := range items {
		out.Categories = append(out.Categories, &pb.Category{CategoryId: c.ID, TenantId: c.TenantID, Name: c.Name, ParentId: c.ParentID})
	}
	return out, nil
}

func (s *Server) ListTaxRates(ctx context.Context, _ *pb.ListTaxRatesRequest) (*pb.ListTaxRatesResponse, error) {
	a, err := authorize(ctx, "catalog:read")
	if err != nil {
		return nil, err
	}
	rates, err := s.svc.ListTaxRates(ctx, a.RequestID)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListTaxRatesResponse{}
	for _, r := range rates {
		out.Rates = append(out.Rates, &pb.TaxRate{Kind: r.Kind, RateBps: r.RateBps})
	}
	return out, nil
}
