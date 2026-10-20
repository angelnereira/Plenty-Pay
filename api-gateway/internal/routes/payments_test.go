package routes_test

import (
	"net/http/httptest"
	"strings"
	"testing"

	"google.golang.org/protobuf/proto"

	"plentypay/api-gateway/internal/metadata"
	"plentypay/api-gateway/internal/pb"
	"plentypay/api-gateway/internal/routes"
)

func route(t *testing.T, method, path string) routes.Route {
	t.Helper()
	r, ok := routes.Find(method, path)
	if !ok {
		t.Fatalf("falta la ruta %s %s", method, path)
	}
	return r
}

// ADR 0011 / ledger SPEC §4: el gateway solo lee del ledger; nunca expone una escritura.
func TestF11_LedgerRoutesAreReadOnly(t *testing.T) {
	reads := map[string]bool{"GetBalance": true, "GetStatement": true, "ListBalances": true, "ListTransactions": true, "GetTransaction": true}
	for _, r := range routes.Table {
		if r.Backend != routes.BackendLedger {
			continue
		}
		name := r.RPC[strings.LastIndex(r.RPC, "/")+1:]
		if !reads[name] || r.Method != "GET" {
			t.Errorf("%s %s expone %s del ledger: solo lecturas", r.Method, r.Path, name)
		}
		if r.FromCaller["account.party_id"] != "user_id" {
			t.Errorf("%s %s: la cuenta debe ser la de la persona del token", r.Method, r.Path)
		}
	}
}

// R5: la cuenta de la billetera sale del token validado aunque el cliente mande otra.
func TestF11_WalletBalanceUsesTheCallersParty(t *testing.T) {
	r := route(t, "GET", "/v1/wallet/balance")
	req := httptest.NewRequest("GET", "/v1/wallet/balance?currency=PAB", strings.NewReader(`{"account":{"party_id":"ajeno","type":"ACCOUNT_TYPE_MERCHANT_PAYABLE"}}`))
	req = req.WithContext(metadata.NewContext(req.Context(), metadata.Caller{UserID: "u-1", Permissions: []string{"wallet:read"}}))
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatal(err)
	}
	a := msg.(*pb.GetBalanceRequest).GetAccount()
	if a.GetPartyId() != "u-1" || a.GetType() != pb.AccountType_ACCOUNT_TYPE_WALLET || a.GetCurrency() != "PAB" {
		t.Fatalf("cuenta = %v", a)
	}
}

// Campos anidados del query: el desglose de comisiones antes de confirmar (N-CON-01).
func TestF11_QuoteNestedQueryParams(t *testing.T) {
	r := route(t, "GET", "/v1/payments/quote")
	msg, err := r.DecodeRequest(httptest.NewRequest("GET", "/v1/payments/quote?amount=2500", nil))
	if err != nil {
		t.Fatal(err)
	}
	q := msg.(*pb.QuoteFeesRequest)
	if q.GetAmount().GetAmountMinor() != 2500 || q.GetAmount().GetCurrency() != "USD" || q.GetRail() != pb.PaymentRail_PAYMENT_RAIL_WALLET {
		t.Fatalf("quote = %v", q)
	}
}

func TestF11_StatementRangeFromQuery(t *testing.T) {
	r := route(t, "GET", "/v1/wallet/statement")
	req := httptest.NewRequest("GET", "/v1/wallet/statement?from=2026-10-01T00:00:00Z&to=2026-10-20T00:00:00Z&page_size=20", nil)
	req = req.WithContext(metadata.NewContext(req.Context(), metadata.Caller{UserID: "u-2"}))
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatal(err)
	}
	s := msg.(*pb.GetStatementRequest)
	if s.GetRange().GetFrom().GetSeconds() != 1790812800 || s.GetPage().GetPageSize() != 20 || s.GetAccount().GetPartyId() != "u-2" {
		t.Fatalf("statement = %v", s)
	}
	if _, err := r.DecodeRequest(httptest.NewRequest("GET", "/v1/wallet/statement?from=ayer", nil)); err == nil {
		t.Fatal("una fecha que no es RFC 3339 debe rechazarse")
	}
}

// R7 (grpc-conventions §3): confirmar y cobrar llevan la Idempotency-Key en el proto.
func TestF11_PaymentMutationsCarryIdempotencyKey(t *testing.T) {
	for _, c := range []struct {
		method, path string
		get          func(proto.Message) string
	}{
		{"POST", "/v1/payments/intents", func(m proto.Message) string { return m.(*pb.CreatePaymentIntentRequest).GetIdempotencyKey() }},
		{"POST", "/v1/payments/intents/018f0000-0000-7000-8000-000000000001/confirm", func(m proto.Message) string {
			return m.(*pb.ConfirmPaymentIntentRequest).GetIdempotencyKey()
		}},
		{"POST", "/v1/terminals", func(m proto.Message) string { return m.(*pb.CreateTerminalRequest).GetIdempotencyKey() }},
	} {
		r := route(t, c.method, c.path)
		if !r.Idempotency {
			t.Errorf("%s %s sin Idempotency", c.method, c.path)
			continue
		}
		req := httptest.NewRequest(c.method, c.path, strings.NewReader(`{}`))
		req.Header.Set("Idempotency-Key", "k-0123456789abcdef")
		msg, err := r.DecodeRequest(req)
		if err != nil {
			t.Fatal(err)
		}
		if c.get(msg) != "k-0123456789abcdef" {
			t.Errorf("%s %s: la clave no llegó al proto", c.method, c.path)
		}
	}
}

// El literal `quote` no se confunde con un id de pago.
func TestF11_QuoteResolvesBeforePaymentID(t *testing.T) {
	if r := route(t, "GET", "/v1/payments/quote"); !strings.HasSuffix(r.RPC, "/QuoteFees") {
		t.Fatalf("GET /v1/payments/quote → %s", r.RPC)
	}
	if r := route(t, "GET", "/v1/payments/018f0000-0000-7000-8000-000000000001"); !strings.HasSuffix(r.RPC, "/GetPayment") {
		t.Fatalf("GET /v1/payments/{id} → %s", r.RPC)
	}
}

// R10: la ruta de recargas fija la referencia `topup`; el cliente no la cambia.
func TestF11_7_TopupRouteForcesTopupReference(t *testing.T) {
	r := route(t, "POST", "/v1/wallet/topups")
	req := httptest.NewRequest("POST", "/v1/wallet/topups", strings.NewReader(`{"amount":{"amount_minor":"5000","currency":"USD"},"rail":"PAYMENT_RAIL_YAPPY","reference":{"type":"sale","id":"x"},"terminal_code":"AbCdEfGhIjKlMnOp"}`))
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatal(err)
	}
	m := msg.(*pb.CreatePaymentIntentRequest)
	if m.GetReference().GetType() != "topup" || m.GetReference().GetId() != "" || m.GetTerminalCode() != "" {
		t.Fatalf("topup = %v", m)
	}
	if m.GetRail() != pb.PaymentRail_PAYMENT_RAIL_YAPPY || r.Permission != "wallet:topup" {
		t.Fatalf("rail/permiso = %v %s", m.GetRail(), r.Permission)
	}
}
