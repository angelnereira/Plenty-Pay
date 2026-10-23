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

	// Marketplace (F15.4–F15.5): lectura para cualquier persona con sesión; catalog aplica R7.
	{
		Method: "GET", Path: "/v1/marketplace/search", RPC: "/plentypay.catalog.v1.Catalog/SearchMarketplace",
		Backend: BackendCatalog, RequireAuth: true,
		QueryParams: map[string]string{"q": "query", "merchant": "merchant_tenant_id", "min_price": "min_price_minor",
			"max_price": "max_price_minor", "sort": "sort", "page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.SearchMarketplaceRequest{} },
		NewResponse: func() proto.Message { return &pb.SearchMarketplaceResponse{} },
	},
	{
		Method: "GET", Path: "/v1/marketplace/products/{product_id}", RPC: "/plentypay.catalog.v1.Catalog/GetMarketplaceProduct",
		Backend: BackendCatalog, RequireAuth: true,
		PathParams:  map[string]string{"product_id": "product_id"},
		NewRequest:  func() proto.Message { return &pb.GetMarketplaceProductRequest{} },
		NewResponse: func() proto.Message { return &pb.MarketplaceProduct{} },
	},
	{
		Method: "GET", Path: "/v1/marketplace/storefronts/{tenant_id}", RPC: "/plentypay.catalog.v1.Catalog/GetStorefront",
		Backend: BackendCatalog, RequireAuth: true,
		PathParams:  map[string]string{"tenant_id": "tenant_id"},
		NewRequest:  func() proto.Message { return &pb.GetStorefrontRequest{} },
		NewResponse: func() proto.Message { return &pb.Storefront{} },
	},
	{
		// La vitrina propia (S-CAT-05): sin tenant_id, catalog usa el del token.
		Method: "GET", Path: "/v1/catalog/storefront", RPC: "/plentypay.catalog.v1.Catalog/GetStorefront",
		Backend: BackendCatalog, RequireAuth: true, Permission: "catalog:read",
		Defaults:    map[string]string{"tenant_id": ""},
		NewRequest:  func() proto.Message { return &pb.GetStorefrontRequest{} },
		NewResponse: func() proto.Message { return &pb.Storefront{} },
	},
	{
		Method: "PUT", Path: "/v1/catalog/storefront", RPC: "/plentypay.catalog.v1.Catalog/UpdateStorefront",
		Backend: BackendCatalog, RequireAuth: true, Idempotency: true, Permission: "catalog:listing:manage",
		NewRequest:  func() proto.Message { return &pb.UpdateStorefrontRequest{} },
		NewResponse: func() proto.Message { return &pb.Storefront{} },
	},
	{
		Method: "PUT", Path: "/v1/catalog/products/{product_id}/listing", RPC: "/plentypay.catalog.v1.Catalog/SetListing",
		Backend: BackendCatalog, RequireAuth: true, Idempotency: true, Permission: "catalog:listing:manage",
		PathParams:  map[string]string{"product_id": "listing.product_id"},
		NewRequest:  func() proto.Message { return &pb.SetListingRequest{} },
		NewResponse: func() proto.Message { return &pb.Listing{} },
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
	// F16.5: proveedores, órdenes de compra y recepción. Las listas aceptan más de un permiso.
	{
		Method: "GET", Path: "/v1/inventory/suppliers", RPC: "/plentypay.inventory.v1.Inventory/ListSuppliers",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:purchase:manage|inventory:read",
		QueryParams: map[string]string{"page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListSuppliersRequest{} },
		NewResponse: func() proto.Message { return &pb.ListSuppliersResponse{} },
	},
	{
		Method: "PUT", Path: "/v1/inventory/suppliers", RPC: "/plentypay.inventory.v1.Inventory/UpsertSupplier",
		Backend: BackendInventory, RequireAuth: true, Idempotency: true, Permission: "inventory:purchase:manage",
		NewRequest:  func() proto.Message { return &pb.UpsertSupplierRequest{} },
		NewResponse: func() proto.Message { return &pb.Supplier{} },
	},
	{
		Method: "GET", Path: "/v1/inventory/purchase-orders", RPC: "/plentypay.inventory.v1.Inventory/ListPurchaseOrders",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:purchase:manage|inventory:receive",
		QueryParams: map[string]string{"status": "status", "page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListPurchaseOrdersRequest{} },
		NewResponse: func() proto.Message { return &pb.ListPurchaseOrdersResponse{} },
	},
	{
		Method: "POST", Path: "/v1/inventory/purchase-orders", RPC: "/plentypay.inventory.v1.Inventory/CreatePurchaseOrder",
		Backend: BackendInventory, RequireAuth: true, Idempotency: true, Permission: "inventory:purchase:manage",
		NewRequest:  func() proto.Message { return &pb.CreatePurchaseOrderRequest{} },
		NewResponse: func() proto.Message { return &pb.PurchaseOrder{} },
	},
	{
		Method: "POST", Path: "/v1/inventory/purchase-orders/{purchase_order_id}/status", RPC: "/plentypay.inventory.v1.Inventory/UpdatePurchaseOrderStatus",
		Backend: BackendInventory, RequireAuth: true, Idempotency: true, Permission: "inventory:purchase:manage",
		PathParams:  map[string]string{"purchase_order_id": "purchase_order_id"},
		NewRequest:  func() proto.Message { return &pb.UpdatePurchaseOrderStatusRequest{} },
		NewResponse: func() proto.Message { return &pb.PurchaseOrder{} },
	},
	{
		Method: "POST", Path: "/v1/inventory/purchase-orders/{purchase_order_id}/receive", RPC: "/plentypay.inventory.v1.Inventory/ReceiveGoods",
		Backend: BackendInventory, RequireAuth: true, Idempotency: true, Permission: "inventory:receive",
		PathParams:  map[string]string{"purchase_order_id": "purchase_order_id"},
		NewRequest:  func() proto.Message { return &pb.ReceiveGoodsRequest{} },
		NewResponse: func() proto.Message { return &pb.PurchaseOrder{} },
	},
	{
		// F16.6: sugerencias de reorden (R6).
		Method: "GET", Path: "/v1/inventory/reorder-suggestions", RPC: "/plentypay.inventory.v1.Inventory/GetReorderSuggestions",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:read",
		QueryParams: map[string]string{"warehouse_id": "warehouse_id"},
		NewRequest:  func() proto.Message { return &pb.GetReorderSuggestionsRequest{} },
		NewResponse: func() proto.Message { return &pb.GetReorderSuggestionsResponse{} },
	},
	{
		Method: "GET", Path: "/v1/inventory/movements", RPC: "/plentypay.inventory.v1.Inventory/ListMovements",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:read",
		QueryParams: map[string]string{"product_id": "product_id", "warehouse_id": "warehouse_id",
			"from": "range.from", "to": "range.to", "page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListMovementsRequest{} },
		NewResponse: func() proto.Message { return &pb.ListMovementsResponse{} },
	},
	{
		// F16.4 (R5): lotes de un producto con vencimiento y existencia.
		Method: "GET", Path: "/v1/inventory/lots", RPC: "/plentypay.inventory.v1.Inventory/ListLots",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:read",
		QueryParams: map[string]string{"product_id": "product_id", "warehouse_id": "warehouse_id",
			"include_empty": "include_empty", "only_expiring": "only_expiring"},
		NewRequest:  func() proto.Message { return &pb.ListLotsRequest{} },
		NewResponse: func() proto.Message { return &pb.ListLotsResponse{} },
	},
	{
		// F16.10: días de anticipación del aviso de vencimiento del comercio.
		Method: "GET", Path: "/v1/inventory/settings", RPC: "/plentypay.inventory.v1.Inventory/GetInventorySettings",
		Backend: BackendInventory, RequireAuth: true, Permission: "inventory:read",
		NewRequest:  func() proto.Message { return &pb.GetInventorySettingsRequest{} },
		NewResponse: func() proto.Message { return &pb.InventorySettings{} },
	},
	{
		Method: "PUT", Path: "/v1/inventory/settings", RPC: "/plentypay.inventory.v1.Inventory/UpdateInventorySettings",
		Backend: BackendInventory, RequireAuth: true, Idempotency: true, Permission: "inventory:adjust",
		NewRequest:  func() proto.Message { return &pb.UpdateInventorySettingsRequest{} },
		NewResponse: func() proto.Message { return &pb.InventorySettings{} },
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
		// F17.4: estacionar es una transición por estado (repetirla devuelve la venta sin cambios).
		Method: "POST", Path: "/v1/pos/sales/{sale_id}/park", RPC: "/plentypay.pos.v1.Pos/ParkSale",
		Backend: BackendPos, RequireAuth: true, Permission: "pos:sell",
		PathParams:  map[string]string{"sale_id": "sale_id"},
		NewRequest:  func() proto.Message { return &pb.ParkSaleRequest{} },
		NewResponse: func() proto.Message { return &pb.Sale{} },
	},
	{
		Method: "POST", Path: "/v1/pos/sales/{sale_id}/resume", RPC: "/plentypay.pos.v1.Pos/ResumeSale",
		Backend: BackendPos, RequireAuth: true, Permission: "pos:sell",
		PathParams:  map[string]string{"sale_id": "sale_id"},
		NewRequest:  func() proto.Message { return &pb.ResumeSaleRequest{} },
		NewResponse: func() proto.Message { return &pb.Sale{} },
	},
	{
		// F17.9 · S-POS-08: devolución con confirmación fuerte (pos.sale.void, ADR 0023).
		Method: "POST", Path: "/v1/pos/sales/{sale_id}/refund", RPC: "/plentypay.pos.v1.Pos/RefundSale",
		Backend: BackendPos, RequireAuth: true, Idempotency: true, StepUp: true, Permission: "pos:refund",
		PathParams:  map[string]string{"sale_id": "sale_id"},
		NewRequest:  func() proto.Message { return &pb.RefundSaleRequest{} },
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
		// F17.11: configuración de caja. La lee quien vende; la cambia quien administra la caja.
		Method: "GET", Path: "/v1/pos/settings", RPC: "/plentypay.pos.v1.Pos/GetPosSettings",
		Backend: BackendPos, RequireAuth: true, Permission: "pos:sell|pos:settings:manage",
		NewRequest:  func() proto.Message { return &pb.GetPosSettingsRequest{} },
		NewResponse: func() proto.Message { return &pb.PosSettings{} },
	},
	{
		Method: "PUT", Path: "/v1/pos/settings", RPC: "/plentypay.pos.v1.Pos/UpdatePosSettings",
		Backend: BackendPos, RequireAuth: true, Idempotency: true, Permission: "pos:settings:manage",
		NewRequest:  func() proto.Message { return &pb.UpdatePosSettingsRequest{} },
		NewResponse: func() proto.Message { return &pb.PosSettings{} },
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

// ordersRoutes: marketplace multi-comercio (F15.6–F15.9, ADR 0017).
var ordersRoutes = []Route{
	{
		Method: "GET", Path: "/v1/cart", RPC: "/plentypay.orders.v1.Orders/GetCart",
		Backend: BackendOrders, RequireAuth: true, Permission: "orders:create:self",
		NewRequest:  func() proto.Message { return &pb.GetCartRequest{} },
		NewResponse: func() proto.Message { return &pb.Cart{} },
	},
	{
		// quantity_milli = 0 quita el producto.
		Method: "PUT", Path: "/v1/cart/items/{product_id}", RPC: "/plentypay.orders.v1.Orders/SetCartItem",
		Backend: BackendOrders, RequireAuth: true, Idempotency: true, Permission: "orders:create:self",
		PathParams:  map[string]string{"product_id": "product_id"},
		NewRequest:  func() proto.Message { return &pb.SetCartItemRequest{} },
		NewResponse: func() proto.Message { return &pb.Cart{} },
	},
	{
		Method: "POST", Path: "/v1/cart/clear", RPC: "/plentypay.orders.v1.Orders/ClearCart",
		Backend: BackendOrders, RequireAuth: true, Idempotency: true, Permission: "orders:create:self",
		NewRequest:  func() proto.Message { return &pb.ClearCartRequest{} },
		NewResponse: func() proto.Message { return &pb.Cart{} },
	},
	{
		Method: "POST", Path: "/v1/orders/quote", RPC: "/plentypay.orders.v1.Orders/QuoteCheckout",
		Backend: BackendOrders, RequireAuth: true, Permission: "orders:create:self",
		NewRequest:  func() proto.Message { return &pb.QuoteCheckoutRequest{} },
		NewResponse: func() proto.Message { return &pb.CheckoutQuote{} },
	},
	{
		// Saga R3: reserva + UN cobro con splits; el comprador lo confirma en /v1/payments/intents/{id}/confirm.
		Method: "POST", Path: "/v1/orders", RPC: "/plentypay.orders.v1.Orders/Checkout",
		Backend: BackendOrders, RequireAuth: true, Idempotency: true, StepUp: true, Permission: "orders:create:self",
		NewRequest:  func() proto.Message { return &pb.OrderCheckoutRequest{} },
		NewResponse: func() proto.Message { return &pb.Order{} },
	},
	{
		Method: "GET", Path: "/v1/orders", RPC: "/plentypay.orders.v1.Orders/ListMyOrders",
		Backend: BackendOrders, RequireAuth: true, Permission: "orders:read:self",
		QueryParams: map[string]string{"status": "status", "page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListMyOrdersRequest{} },
		NewResponse: func() proto.Message { return &pb.ListOrdersResponse{} },
	},
	{
		Method: "GET", Path: "/v1/orders/{order_id}", RPC: "/plentypay.orders.v1.Orders/GetOrder",
		Backend: BackendOrders, RequireAuth: true, Permission: "orders:read:self",
		PathParams:  map[string]string{"order_id": "order_id"},
		NewRequest:  func() proto.Message { return &pb.GetOrderRequest{} },
		NewResponse: func() proto.Message { return &pb.Order{} },
	},
	{
		Method: "POST", Path: "/v1/orders/{order_id}/cancel", RPC: "/plentypay.orders.v1.Orders/CancelOrder",
		Backend: BackendOrders, RequireAuth: true, Idempotency: true, Permission: "orders:create:self",
		PathParams:  map[string]string{"order_id": "order_id"},
		NewRequest:  func() proto.Message { return &pb.CancelOrderRequest{} },
		NewResponse: func() proto.Message { return &pb.Order{} },
	},
	{
		Method: "GET", Path: "/v1/merchant/orders", RPC: "/plentypay.orders.v1.Orders/ListMerchantOrders",
		Backend: BackendOrders, RequireAuth: true, Permission: "orders:read",
		QueryParams: map[string]string{"status": "status", "from": "range.from", "to": "range.to",
			"page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListMerchantOrdersRequest{} },
		NewResponse: func() proto.Message { return &pb.ListSubOrdersResponse{} },
	},
	{
		Method: "POST", Path: "/v1/merchant/sub-orders/{sub_order_id}/accept", RPC: "/plentypay.orders.v1.Orders/AcceptSubOrder",
		Backend: BackendOrders, RequireAuth: true, Idempotency: true, Permission: "orders:manage",
		PathParams:  map[string]string{"sub_order_id": "sub_order_id"},
		NewRequest:  func() proto.Message { return &pb.SubOrderActionRequest{} },
		NewResponse: func() proto.Message { return &pb.SubOrder{} },
	},
	{
		Method: "POST", Path: "/v1/merchant/sub-orders/{sub_order_id}/reject", RPC: "/plentypay.orders.v1.Orders/RejectSubOrder",
		Backend: BackendOrders, RequireAuth: true, Idempotency: true, Permission: "orders:manage",
		PathParams:  map[string]string{"sub_order_id": "sub_order_id"},
		NewRequest:  func() proto.Message { return &pb.RejectSubOrderRequest{} },
		NewResponse: func() proto.Message { return &pb.SubOrder{} },
	},
	{
		Method: "POST", Path: "/v1/merchant/sub-orders/{sub_order_id}/ready", RPC: "/plentypay.orders.v1.Orders/MarkSubOrderReady",
		Backend: BackendOrders, RequireAuth: true, Idempotency: true, Permission: "orders:manage",
		PathParams:  map[string]string{"sub_order_id": "sub_order_id"},
		NewRequest:  func() proto.Message { return &pb.SubOrderActionRequest{} },
		NewResponse: func() proto.Message { return &pb.SubOrder{} },
	},
	{
		Method: "POST", Path: "/v1/merchant/sub-orders/{sub_order_id}/complete", RPC: "/plentypay.orders.v1.Orders/MarkSubOrderCompleted",
		Backend: BackendOrders, RequireAuth: true, Idempotency: true, Permission: "orders:manage",
		PathParams:  map[string]string{"sub_order_id": "sub_order_id"},
		NewRequest:  func() proto.Message { return &pb.SubOrderActionRequest{} },
		NewResponse: func() proto.Message { return &pb.SubOrder{} },
	},
}

func init() {
	Table = append(Table, commerceRoutes...)
	Table = append(Table, ordersRoutes...)
}
