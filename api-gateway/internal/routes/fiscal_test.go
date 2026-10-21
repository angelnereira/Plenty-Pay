package routes_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"plentypay/api-gateway/internal/pb"
	"plentypay/api-gateway/internal/routes"
)

// SPEC §4.3: cada ruta fiscal llega al RPC de fiscal-invoicing con su permiso.
func TestF13_FiscalRoutes(t *testing.T) {
	cases := map[string][2]string{
		"GET /v1/fiscal/profile":                   {"GetFiscalProfile", "fiscal:read"},
		"PUT /v1/fiscal/profile":                   {"ConfigureFiscalProfile", "fiscal:profile:manage"},
		"GET /v1/fiscal/folios":                    {"GetFolioStatus", "fiscal:read"},
		"GET /v1/fiscal/invoices":                  {"ListInvoices", "fiscal:read"},
		"POST /v1/fiscal/invoices":                 {"IssueInvoice", "fiscal:issue"},
		"GET /v1/fiscal/invoices/i1":               {"GetInvoice", "fiscal:read"},
		"POST /v1/fiscal/invoices/i1/credit-notes": {"IssueCreditNote", "fiscal:note:issue"},
		"POST /v1/fiscal/invoices/i1/debit-notes":  {"IssueDebitNote", "fiscal:note:issue"},
		"GET /v1/fiscal/taxpayers":                 {"SearchTaxpayers", "fiscal:issue"},
		"PUT /v1/fiscal/taxpayers":                 {"UpsertTaxpayer", "fiscal:issue"},
	}
	for req, want := range cases {
		method, path, _ := strings.Cut(req, " ")
		r, ok := routes.Find(method, path)
		if !ok || !strings.HasSuffix(r.RPC, "/"+want[0]) || r.Backend != routes.BackendFiscal || r.Permission != want[1] {
			t.Errorf("%s → %v %s %s %s", req, ok, r.RPC, r.Backend, r.Permission)
		}
	}
	if r, _ := routes.Find("PUT", "/v1/fiscal/profile"); !r.StepUp || !r.Idempotency {
		t.Fatal("configurar el perfil es 🔒 e idempotente")
	}
}

// La factura de la ruta llega como related_invoice_id de la nota.
func TestF13_NoteRouteFillsRelatedInvoice(t *testing.T) {
	r, _ := routes.Find("POST", "/v1/fiscal/invoices/0199f0c8-0000-7000-8000-000000000001/credit-notes")
	req := httptest.NewRequest(http.MethodPost, "/v1/fiscal/invoices/0199f0c8-0000-7000-8000-000000000001/credit-notes",
		strings.NewReader(`{"reason":"Devolución","lines":[{"description":"x","quantity_milli":"1000"}]}`))
	msg, err := r.DecodeRequest(req)
	if err != nil {
		t.Fatal(err)
	}
	if n := msg.(*pb.IssueNoteRequest); n.GetRelatedInvoiceId() != "0199f0c8-0000-7000-8000-000000000001" || n.GetReason() != "Devolución" {
		t.Fatalf("%+v", n)
	}
}
