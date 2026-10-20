package routes_test

import (
	"net/http/httptest"
	"strings"
	"testing"

	"google.golang.org/protobuf/proto"

	"plentypay/api-gateway/internal/pb"
	"plentypay/api-gateway/internal/routes"
)

const pid = "018f0000-0000-7000-8000-0000000000aa"

// AGENTS §2.8: toda mutación de comercio reintentable lleva la clave al proto.
func TestF15_F17_CommerceMutationsCarryIdempotencyKey(t *testing.T) {
	for _, c := range []struct {
		method, path string
		get          func(proto.Message) string
	}{
		{"POST", "/v1/catalog/products", func(m proto.Message) string { return m.(*pb.CreateProductRequest).GetIdempotencyKey() }},
		{"PATCH", "/v1/catalog/products/" + pid, func(m proto.Message) string { return m.(*pb.UpdateProductRequest).GetIdempotencyKey() }},
		{"POST", "/v1/catalog/products/" + pid + "/archive", func(m proto.Message) string { return m.(*pb.ArchiveProductRequest).GetIdempotencyKey() }},
		{"POST", "/v1/inventory/adjustments", func(m proto.Message) string { return m.(*pb.AdjustStockRequest).GetIdempotencyKey() }},
		{"POST", "/v1/inventory/transfers", func(m proto.Message) string { return m.(*pb.TransferStockRequest).GetIdempotencyKey() }},
		{"POST", "/v1/pos/sessions", func(m proto.Message) string { return m.(*pb.OpenCashSessionRequest).GetIdempotencyKey() }},
		{"POST", "/v1/pos/sessions/" + pid + "/close", func(m proto.Message) string { return m.(*pb.CloseCashSessionRequest).GetIdempotencyKey() }},
		{"POST", "/v1/pos/sales", func(m proto.Message) string { return m.(*pb.CreateSaleRequest).GetIdempotencyKey() }},
		{"PUT", "/v1/pos/sales/" + pid, func(m proto.Message) string { return m.(*pb.UpdateSaleRequest).GetIdempotencyKey() }},
		{"POST", "/v1/pos/sales/" + pid + "/checkout", func(m proto.Message) string { return m.(*pb.PosCheckoutRequest).GetIdempotencyKey() }},
		{"POST", "/v1/pos/sales/" + pid + "/void", func(m proto.Message) string { return m.(*pb.VoidSaleRequest).GetIdempotencyKey() }},
		{"POST", "/v1/orders", func(m proto.Message) string { return m.(*pb.OrderCheckoutRequest).GetIdempotencyKey() }},
		{"POST", "/v1/merchant/sub-orders/" + pid + "/reject", func(m proto.Message) string { return m.(*pb.RejectSubOrderRequest).GetIdempotencyKey() }},
		{"PUT", "/v1/cart/items/" + pid, func(m proto.Message) string { return m.(*pb.SetCartItemRequest).GetIdempotencyKey() }},
		{"POST", "/v1/payments/" + pid + "/refunds", func(m proto.Message) string { return m.(*pb.RefundPaymentRequest).GetIdempotencyKey() }},
	} {
		r := route(t, c.method, c.path)
		if !r.Idempotency || r.Permission == "" {
			t.Errorf("%s %s: Idempotency=%v Permission=%q", c.method, c.path, r.Idempotency, r.Permission)
			continue
		}
		req := httptest.NewRequest(c.method, c.path, strings.NewReader(`{}`))
		req.Header.Set("Idempotency-Key", "k-0123456789abcdef")
		msg, err := r.DecodeRequest(req)
		if err != nil {
			t.Fatalf("%s %s: %v", c.method, c.path, err)
		}
		if c.get(msg) != "k-0123456789abcdef" {
			t.Errorf("%s %s: la clave no llegó al proto", c.method, c.path)
		}
	}
}

// El id de la ruta manda sobre el del cuerpo (F09.3): no se edita otro producto por el cuerpo.
func TestF15_UpdateProductIDComesFromPath(t *testing.T) {
	r := route(t, "PATCH", "/v1/catalog/products/"+pid)
	req := httptest.NewRequest("PATCH", "/v1/catalog/products/"+pid,
		strings.NewReader(`{"product":{"product_id":"otro","name":"Café"},"update_mask":["name"]}`))
	req.Header.Set("Idempotency-Key", "k-0123456789abcdef")
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatal(err)
	}
	u := msg.(*pb.UpdateProductRequest)
	if u.GetProduct().GetProductId() != pid || u.GetProduct().GetName() != "Café" || len(u.GetUpdateMask()) != 1 {
		t.Fatalf("update = %v", u)
	}
}

// La sesión «actual» no se confunde con un id y no admite que el cliente elija otra.
func TestF17_CurrentSessionResolvesBeforeID(t *testing.T) {
	r := route(t, "GET", "/v1/pos/sessions/current")
	msg, err := r.DecodeRequest(httptest.NewRequest("GET", "/v1/pos/sessions/current?session_id=ajena", nil))
	if err != nil {
		t.Fatal(err)
	}
	if msg.(*pb.GetCashSessionRequest).GetSessionId() != "" {
		t.Fatal("current debe pedir la sesión del cajero del token")
	}
	if r := route(t, "GET", "/v1/pos/sessions/"+pid); r.PathParams["session_id"] != "session_id" {
		t.Fatal("GET /v1/pos/sessions/{id}")
	}
}

// Los tenders y las líneas viajan en el cuerpo con sus enums (protojson).
func TestF17_CheckoutDecodesTenders(t *testing.T) {
	r := route(t, "POST", "/v1/pos/sales/"+pid+"/checkout")
	req := httptest.NewRequest("POST", "/v1/pos/sales/"+pid+"/checkout", strings.NewReader(
		`{"tenders":[{"rail":"PAYMENT_RAIL_CASH","amount":{"amount_minor":"1000","currency":"USD"},"cash_tendered":{"amount_minor":"2000","currency":"USD"}},{"rail":"PAYMENT_RAIL_WALLET","amount":{"amount_minor":"2000","currency":"USD"}}]}`))
	req.Header.Set("Idempotency-Key", "k-0123456789abcdef")
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatal(err)
	}
	c := msg.(*pb.PosCheckoutRequest)
	if c.GetSaleId() != pid || len(c.GetTenders()) != 2 || c.GetTenders()[0].GetRail() != pb.PaymentRail_PAYMENT_RAIL_CASH ||
		c.GetTenders()[0].GetCashTendered().GetAmountMinor() != 2000 {
		t.Fatalf("checkout = %v", c)
	}
}

// Ninguna ruta de comercio queda sin autenticación.
func TestF15_F17_CommerceRoutesRequireAuth(t *testing.T) {
	for _, r := range routes.Table {
		switch r.Backend {
		case routes.BackendCatalog, routes.BackendInventory, routes.BackendPos, routes.BackendOrders:
			// El marketplace lo lee cualquier persona con sesión (catalog SPEC §4 "autenticado").
			if strings.HasPrefix(r.Path, "/v1/marketplace/") {
				if !r.RequireAuth {
					t.Errorf("%s %s sin sesión", r.Method, r.Path)
				}
				continue
			}
			if !r.RequireAuth || r.Permission == "" {
				t.Errorf("%s %s: RequireAuth=%v Permission=%q", r.Method, r.Path, r.RequireAuth, r.Permission)
			}
		}
	}
}
