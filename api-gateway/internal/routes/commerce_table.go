package routes

import (
	"google.golang.org/protobuf/proto"

	"plentypay/api-gateway/internal/pb"
)

// commerceRoutes: catálogo (F15), inventario (F16) y caja (F17). El tenant y el actor viajan en
// los metadatos (ADR 0011); cada servicio vuelve a verificar el permiso (segunda barrera).
var commerceRoutes = []Route{
	// ── catalog ───────────────────────────────────────────────────────────────────────────
	{
		Method: "GET", Path: "/v1/catalog/products", RPC: "/plentypay.catalog.v1.Catalog/ListProducts",
		Backend: BackendCatalog, RequireAuth: true, Permission: "catalog:read",
		QueryParams: map[string]string{"q": "query", "category_id": "category_id", "status": "status",
			"page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListProductsRequest{} },
		NewResponse: func() proto.Message { return &pb.ListProductsResponse{} },
	},
	{
		Method: "POST", Path: "/v1/catalog/products", RPC: "/plentypay.catalog.v1.Catalog/CreateProduct",
		Backend: BackendCatalog, RequireAuth: true, Idempotency: true, Permission: "catalog:write",
		NewRequest:  func() proto.Message { return &pb.CreateProductRequest{} },
		NewResponse: func() proto.Message { return &pb.Product{} },
	},
	{
		Method: "GET", Path: "/v1/catalog/products/{product_id}", RPC: "/plentypay.catalog.v1.Catalog/GetProduct",
		Backend: BackendCatalog, RequireAuth: true, Permission: "catalog:read",
		PathParams:  map[string]string{"product_id": "product_id"},
		NewRequest:  func() proto.Message { return &pb.GetProductRequest{} },
		NewResponse: func() proto.Message { return &pb.Product{} },
	},
	{
		Method: "PATCH", Path: "/v1/catalog/products/{product_id}", RPC: "/plentypay.catalog.v1.Catalog/UpdateProduct",
		Backend: BackendCatalog, RequireAuth: true, Idempotency: true, Permission: "catalog:write",
		PathParams:  map[string]string{"product_id": "product.product_id"},
		NewRequest:  func() proto.Message { return &pb.UpdateProductRequest{} },
		NewResponse: func() proto.Message { return &pb.Product{} },
	},
	{
		Method: "POST", Path: "/v1/catalog/products/{product_id}/archive", RPC: "/plentypay.catalog.v1.Catalog/ArchiveProduct",
		Backend: BackendCatalog, RequireAuth: true, Idempotency: true, Permission: "catalog:write",
		PathParams:  map[string]string{"product_id": "product_id"},
		NewRequest:  func() proto.Message { return &pb.ArchiveProductRequest{} },
		NewResponse: func() proto.Message { return &pb.Product{} },
	},
	{
		Method: "GET", Path: "/v1/catalog/barcodes/{barcode}", RPC: "/plentypay.catalog.v1.Catalog/LookupByBarcode",
		Backend: BackendCatalog, RequireAuth: true, Permission: "catalog:read",
		PathParams:  map[string]string{"barcode": "barcode"},
		NewRequest:  func() proto.Message { return &pb.LookupByBarcodeRequest{} },
		NewResponse: func() proto.Message { return &pb.Product{} },
	},
	{
		Method: "GET", Path: "/v1/catalog/categories", RPC: "/plentypay.catalog.v1.Catalog/ListCategories",
		Backend: BackendCatalog, RequireAuth: true, Permission: "catalog:read",
		NewRequest:  func() proto.Message { return &pb.ListCategoriesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListCategoriesResponse{} },
	},
	{
		// UpsertCategory no tiene clave: crear sin id dos veces crea dos (la UI deshabilita el botón;
		// el nombre es único por nivel y la segunda responde ALREADY_EXISTS).
		Method: "POST", Path: "/v1/catalog/categories", RPC: "/plentypay.catalog.v1.Catalog/UpsertCategory",
		Backend: BackendCatalog, RequireAuth: true, Permission: "catalog:write",
		NewRequest:  func() proto.Message { return &pb.UpsertCategoryRequest{} },
		NewResponse: func() proto.Message { return &pb.Category{} },
	},

	{
		Method: "GET", Path: "/v1/catalog/tax-rates", RPC: "/plentypay.catalog.v1.Catalog/ListTaxRates",
		Backend: BackendCatalog, RequireAuth: true, Permission: "catalog:read",
		NewRequest:  func() proto.Message { return &pb.ListTaxRatesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListTaxRatesResponse{} },
	},

	// ── inventory ─────────────────────────────────────────────────────────────────────────
	{
		Method: "GET", Path: "/v1/inventory/warehouses", RPC: "/plentypay.inventory.v1.Inventory/ListWarehouses",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:read",
		NewRequest:  func() proto.Message { return &pb.ListWarehousesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListWarehousesResponse{} },
	},
	{
		Method: "POST", Path: "/v1/inventory/warehouses", RPC: "/plentypay.inventory.v1.Inventory/UpsertWarehouse",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:adjust",
		NewRequest:  func() proto.Message { return &pb.UpsertWarehouseRequest{} },
		NewResponse: func() proto.Message { return &pb.Warehouse{} },
	},
	{
		Method: "GET", Path: "/v1/inventory/stock", RPC: "/plentypay.inventory.v1.Inventory/ListStock",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:read",
		QueryParams: map[string]string{"warehouse_id": "warehouse_id", "only_low": "only_low",
			"page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListStockRequest{} },
		NewResponse: func() proto.Message { return &pb.ListStockResponse{} },
	},
	{
		Method: "GET", Path: "/v1/inventory/stock/{product_id}", RPC: "/plentypay.inventory.v1.Inventory/GetStock",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:read",
		PathParams:  map[string]string{"product_id": "product_id"},
		QueryParams: map[string]string{"warehouse_id": "warehouse_id"},
		NewRequest:  func() proto.Message { return &pb.GetStockRequest{} },
		NewResponse: func() proto.Message { return &pb.StockLevel{} },
	},
	{
		// Las personas registran RECEIPT, ADJUSTMENT y WRITE_OFF; SALE y RETURN solo pos/orders
		// (inventory lo verifica con x-pp-actor-service, que el gateway fija siempre en "api-gateway").
		Method: "POST", Path: "/v1/inventory/adjustments", RPC: "/plentypay.inventory.v1.Inventory/AdjustStock",
		Backend: BackendInventory, RequireAuth: true, Idempotency: true, Permission: "inventory:adjust",
		NewRequest:  func() proto.Message { return &pb.AdjustStockRequest{} },
		NewResponse: func() proto.Message { return &pb.StockMovement{} },
	},
	{
		Method: "POST", Path: "/v1/inventory/transfers", RPC: "/plentypay.inventory.v1.Inventory/TransferStock",
		Backend: BackendInventory, RequireAuth: true, Idempotency: true, Permission: "inventory:adjust",
		NewRequest:  func() proto.Message { return &pb.TransferStockRequest{} },
		NewResponse: func() proto.Message { return &pb.TransferStockResponse{} },
	},
	{
		Method: "GET", Path: "/v1/inventory/movements", RPC: "/plentypay.inventory.v1.Inventory/ListMovements",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:read",
		QueryParams: map[string]string{"product_id": "product_id", "warehouse_id": "warehouse_id",
			"from": "range.from", "to": "range.to", "page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListMovementsRequest{} },
		NewResponse: func() proto.Message { return &pb.ListMovementsResponse{} },
	},

	// ── pos ───────────────────────────────────────────────────────────────────────────────
	{
		Method: "POST", Path: "/v1/pos/sessions", RPC: "/plentypay.pos.v1.Pos/OpenCashSession",
		Backend: BackendPos, RequireAuth: true, Idempotency: true, Permission: "pos:sell",
		NewRequest:  func() proto.Message { return &pb.OpenCashSessionRequest{} },
		NewResponse: func() proto.Message { return &pb.CashSession{} },
	},
	{
		// Sin id: la sesión abierta del cajero del token.
		Method: "GET", Path: "/v1/pos/sessions/current", RPC: "/plentypay.pos.v1.Pos/GetCashSession",
		Backend: BackendPos, RequireAuth: true, Permission: "pos:sell",
		Defaults:    map[string]string{"session_id": ""},
		NewRequest:  func() proto.Message { return &pb.GetCashSessionRequest{} },
		NewResponse: func() proto.Message { return &pb.CashSession{} },
	},
	{
		Method: "GET", Path: "/v1/pos/sessions/{session_id}", RPC: "/plentypay.pos.v1.Pos/GetCashSession",
		Backend: BackendPos, RequireAuth: true, Permission: "pos:sell",
		PathParams:  map[string]string{"session_id": "session_id"},
		NewRequest:  func() proto.Message { return &pb.GetCashSessionRequest{} },
		NewResponse: func() proto.Message { return &pb.CashSession{} },
	},
	{
		Method: "POST", Path: "/v1/pos/sessions/{session_id}/close", RPC: "/plentypay.pos.v1.Pos/CloseCashSession",
		Backend: BackendPos, RequireAuth: true, Idempotency: true, Permission: "pos:sell",
		PathParams:  map[string]string{"session_id": "session_id"},
		NewRequest:  func() proto.Message { return &pb.CloseCashSessionRequest{} },
		NewResponse: func() proto.Message { return &pb.CashSession{} },
	},
	{
		Method: "POST", Path: "/v1/pos/sessions/{session_id}/movements", RPC: "/plentypay.pos.v1.Pos/RecordCashMovement",
		Backend: BackendPos, RequireAuth: true, Idempotency: true, Permission: "pos:session:manage",
		PathParams:  map[string]string{"session_id": "session_id"},
		NewRequest:  func() proto.Message { return &pb.RecordCashMovementRequest{} },
		NewResponse: func() proto.Message { return &pb.CashSession{} },
	},
	{
		Method: "POST", Path: "/v1/pos/sales", RPC: "/plentypay.pos.v1.Pos/CreateSale",
		Backend: BackendPos, RequireAuth: true, Idempotency: true, Permission: "pos:sell",
		NewRequest:  func() proto.Message { return &pb.CreateSaleRequest{} },
		NewResponse: func() proto.Message { return &pb.Sale{} },
	},
	{
		Method: "PUT", Path: "/v1/pos/sales/{sale_id}", RPC: "/plentypay.pos.v1.Pos/UpdateSale",
		Backend: BackendPos, RequireAuth: true, Idempotency: true, Permission: "pos:sell",
		PathParams:  map[string]string{"sale_id": "sale_id"},
		NewRequest:  func() proto.Message { return &pb.UpdateSaleRequest{} },
		NewResponse: func() proto.Message { return &pb.Sale{} },
	},
	{
		Method: "POST", Path: "/v1/pos/sales/{sale_id}/checkout", RPC: "/plentypay.pos.v1.Pos/Checkout",
		Backend: BackendPos, RequireAuth: true, Idempotency: true, Permission: "pos:sell",
		PathParams:  map[string]string{"sale_id": "sale_id"},
		NewRequest:  func() proto.Message { return &pb.PosCheckoutRequest{} },
		NewResponse: func() proto.Message { return &pb.Sale{} },
	},
	{
		Method: "POST", Path: "/v1/pos/sales/{sale_id}/void", RPC: "/plentypay.pos.v1.Pos/VoidSale",
		Backend: BackendPos, RequireAuth: true, Idempotency: true, Permission: "pos:void",
		PathParams:  map[string]string{"sale_id": "sale_id"},
		NewRequest:  func() proto.Message { return &pb.VoidSaleRequest{} },
		NewResponse: func() proto.Message { return &pb.Sale{} },
	},
	{
		Method: "GET", Path: "/v1/pos/sales/{sale_id}", RPC: "/plentypay.pos.v1.Pos/GetSale",
		Backend: BackendPos, RequireAuth: true, Permission: "pos:sell",
		PathParams:  map[string]string{"sale_id": "sale_id"},
		NewRequest:  func() proto.Message { return &pb.GetSaleRequest{} },
		NewResponse: func() proto.Message { return &pb.Sale{} },
	},
	{
		Method: "GET", Path: "/v1/pos/sales", RPC: "/plentypay.pos.v1.Pos/ListSales",
		Backend: BackendPos, RequireAuth: true, Permission: "pos:sell",
		QueryParams: map[string]string{"session_id": "session_id", "status": "status", "from": "range.from",
			"to": "range.to", "page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListSalesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListSalesResponse{} },
	},
}

func init() { Table = append(Table, commerceRoutes...) }
