package server

import (
	"context"
	"encoding/base64"
	"strconv"

	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/encoding/protojson"

	"plentypay/catalog/internal/domain"
	"plentypay/catalog/internal/pb"
	"plentypay/catalog/internal/store"
	"plentypay/catalog/internal/tenancy"
)

// signedIn: el marketplace lo lee cualquier persona con sesión (SPEC §4 "autenticado").
func signedIn(ctx context.Context) (tenancy.Actor, error) {
	a := tenancy.FromContext(ctx)
	if a.UserID == "" {
		return a, ErrorInfo(codes.Unauthenticated, "UNAUTHENTICATED", "inicia sesión")
	}
	return a, nil
}

func listingPB(l domain.Listing, p domain.Product) *pb.Listing {
	price := l.PriceMinor
	if price == 0 {
		price = p.PriceMinor
	}
	return &pb.Listing{ProductId: l.ProductID, Listed: l.Listed, MarketplacePrice: &pb.Money{AmountMinor: price, Currency: p.Currency},
		DeliveryAvailable: l.Delivery, PickupAvailable: l.Pickup}
}

func storefrontPB(sf domain.Storefront, verified bool) (*pb.Storefront, error) {
	out := &pb.Storefront{TenantId: sf.TenantID, DisplayName: sf.DisplayName, Description: sf.Description,
		LogoObjectKey: sf.LogoObjectKey, Verified: verified, Published: sf.Published}
	if len(sf.AddressJSON) > 2 {
		var addr pb.Address
		if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(sf.AddressJSON, &addr); err != nil {
			return nil, toStatus(err)
		}
		out.Address = &addr
	}
	return out, nil
}

func marketPB(it domain.MarketItem) *pb.MarketplaceProduct {
	return &pb.MarketplaceProduct{
		Product:    toPB(it.Product),
		Storefront: &pb.Storefront{TenantId: it.Product.TenantID, DisplayName: it.Storefront.DisplayName, Description: it.Storefront.Description, LogoObjectKey: it.Storefront.LogoObjectKey, Verified: true, Published: true},
		InStock:    it.InStock,
		Listing:    listingPB(it.Listing, it.Product),
	}
}

func (s *Server) SetListing(ctx context.Context, req *pb.SetListingRequest) (*pb.Listing, error) {
	a, err := authorize(ctx, "catalog:listing:manage")
	if err != nil {
		return nil, err
	}
	in := req.GetListing()
	price := in.GetMarketplacePrice().GetAmountMinor()
	if price < 0 {
		return nil, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "precio inválido")
	}
	l, err := s.market.SetListing(ctx, a.TenantID, a.RequestID, domain.Listing{ProductID: in.GetProductId(), Listed: in.GetListed(),
		PriceMinor: price, Delivery: in.GetDeliveryAvailable(), Pickup: in.GetPickupAvailable()})
	if err != nil {
		return nil, toStatus(err)
	}
	p, err := s.svc.GetProduct(ctx, a.TenantID, l.ProductID)
	if err != nil {
		return nil, toStatus(err)
	}
	return listingPB(l, p), nil
}

func (s *Server) UpdateStorefront(ctx context.Context, req *pb.UpdateStorefrontRequest) (*pb.Storefront, error) {
	a, err := authorize(ctx, "catalog:listing:manage")
	if err != nil {
		return nil, err
	}
	in := req.GetStorefront()
	var addr []byte
	if in.GetAddress() != nil {
		if addr, err = protojson.Marshal(in.GetAddress()); err != nil {
			return nil, toStatus(err)
		}
	}
	sf, err := s.market.UpdateStorefront(ctx, a.TenantID, a.RequestID, domain.Storefront{DisplayName: in.GetDisplayName(),
		Description: in.GetDescription(), LogoObjectKey: in.GetLogoObjectKey(), AddressJSON: addr, Published: in.GetPublished()})
	if err != nil {
		return nil, toStatus(err)
	}
	return storefrontPB(sf, true)
}

// GetStorefront: sin tenant_id, la vitrina del negocio del llamador (para editarla).
func (s *Server) GetStorefront(ctx context.Context, req *pb.GetStorefrontRequest) (*pb.Storefront, error) {
	a, err := signedIn(ctx)
	if err != nil {
		return nil, err
	}
	tenant := req.GetTenantId()
	if tenant == "" {
		tenant = a.TenantID
	}
	if tenant == "" {
		return nil, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "falta el comercio")
	}
	sf, verified, err := s.market.Storefront(ctx, a.RequestID, tenant)
	if err != nil {
		return nil, toStatus(err)
	}
	// Una vitrina oculta solo la ve su propio negocio.
	if !sf.Published && tenant != a.TenantID {
		return nil, ErrorInfo(codes.NotFound, "NOT_FOUND", "no existe")
	}
	return storefrontPB(sf, verified)
}

func (s *Server) SearchMarketplace(ctx context.Context, req *pb.SearchMarketplaceRequest) (*pb.SearchMarketplaceResponse, error) {
	if _, err := signedIn(ctx); err != nil {
		return nil, err
	}
	limit := int(req.GetPage().GetPageSize())
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	offset := 0
	if t := req.GetPage().GetPageToken(); t != "" {
		b, err := base64.RawURLEncoding.DecodeString(t)
		if err == nil {
			offset, err = strconv.Atoi(string(b))
		}
		if err != nil || offset < 0 || offset > 10000 {
			return nil, ErrorInfo(codes.InvalidArgument, "INVALID_REQUEST", "page_token inválido")
		}
	}
	items, more, err := s.market.Search(ctx, store.MarketFilter{Query: req.GetQuery(), TenantID: req.GetMerchantTenantId(),
		MinPrice: req.GetMinPriceMinor(), MaxPrice: req.GetMaxPriceMinor(), Sort: req.GetSort(), Limit: limit, Offset: offset})
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.SearchMarketplaceResponse{Page: &pb.PageInfo{}}
	if more {
		out.Page.NextPageToken = base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset + limit)))
	}
	for _, it := range items {
		out.Results = append(out.Results, marketPB(it))
	}
	return out, nil
}

func (s *Server) GetMarketplaceProduct(ctx context.Context, req *pb.GetMarketplaceProductRequest) (*pb.MarketplaceProduct, error) {
	if _, err := signedIn(ctx); err != nil {
		return nil, err
	}
	it, err := s.market.MarketplaceProduct(ctx, req.GetProductId())
	if err != nil {
		return nil, toStatus(err)
	}
	return marketPB(it), nil
}
