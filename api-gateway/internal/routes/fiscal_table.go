package routes

import (
	"google.golang.org/protobuf/proto"

	"plentypay/api-gateway/internal/pb"
)

// fiscalRoutes son las rutas de facturación electrónica (SPEC §4.3, fiscal-invoicing/SPEC.md §4).
// El tenant y el actor viajan en los metadatos; fiscal-invoicing vuelve a verificar permisos.
var fiscalRoutes = []Route{
	{
		Method: "GET", Path: "/v1/fiscal/profile", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/GetFiscalProfile",
		Backend: BackendFiscal, RequireAuth: true, Permission: "fiscal:read",
		NewRequest:  func() proto.Message { return &pb.GetFiscalProfileRequest{} },
		NewResponse: func() proto.Message { return &pb.FiscalProfile{} },
	},
	{
		// 🔒 security.credentials.update (security-standards.md §4.1).
		Method: "PUT", Path: "/v1/fiscal/profile", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/ConfigureFiscalProfile",
		Backend: BackendFiscal, RequireAuth: true, StepUp: true, Idempotency: true, Permission: "fiscal:profile:manage",
		NewRequest:  func() proto.Message { return &pb.ConfigureFiscalProfileRequest{} },
		NewResponse: func() proto.Message { return &pb.FiscalProfile{} },
	},
	{
		// Selector de PAC del perfil fiscal (R10, ADR 0022).
		Method: "GET", Path: "/v1/fiscal/pac-providers", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/ListPacProviders",
		Backend: BackendFiscal, RequireAuth: true, Permission: "fiscal:profile:manage",
		NewRequest:  func() proto.Message { return &pb.ListPacProvidersRequest{} },
		NewResponse: func() proto.Message { return &pb.ListPacProvidersResponse{} },
	},
	{
		Method: "GET", Path: "/v1/fiscal/folios", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/GetFolioStatus",
		Backend: BackendFiscal, RequireAuth: true, Permission: "fiscal:read",
		NewRequest:  func() proto.Message { return &pb.GetFolioStatusRequest{} },
		NewResponse: func() proto.Message { return &pb.FolioStatus{} },
	},
	{
		Method: "GET", Path: "/v1/fiscal/invoices", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/ListInvoices",
		Backend: BackendFiscal, RequireAuth: true, Permission: "fiscal:read",
		QueryParams: map[string]string{"status": "status", "document_type": "document_type",
			"page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.ListInvoicesRequest{} },
		NewResponse: func() proto.Message { return &pb.ListInvoicesResponse{} },
	},
	{
		Method: "POST", Path: "/v1/fiscal/invoices", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/IssueInvoice",
		Backend: BackendFiscal, RequireAuth: true, Idempotency: true, Permission: "fiscal:issue",
		NewRequest:  func() proto.Message { return &pb.IssueInvoiceRequest{} },
		NewResponse: func() proto.Message { return &pb.Invoice{} },
	},
	{
		Method: "GET", Path: "/v1/fiscal/invoices/{invoice_id}", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/GetInvoice",
		Backend: BackendFiscal, RequireAuth: true, Permission: "fiscal:read",
		PathParams:  map[string]string{"invoice_id": "invoice_id"},
		NewRequest:  func() proto.Message { return &pb.GetInvoiceRequest{} },
		NewResponse: func() proto.Message { return &pb.Invoice{} },
	},
	{
		Method: "POST", Path: "/v1/fiscal/invoices/{invoice_id}/credit-notes", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/IssueCreditNote",
		Backend: BackendFiscal, RequireAuth: true, Idempotency: true, Permission: "fiscal:note:issue",
		PathParams:  map[string]string{"invoice_id": "related_invoice_id"},
		NewRequest:  func() proto.Message { return &pb.IssueNoteRequest{} },
		NewResponse: func() proto.Message { return &pb.Invoice{} },
	},
	{
		Method: "POST", Path: "/v1/fiscal/invoices/{invoice_id}/debit-notes", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/IssueDebitNote",
		Backend: BackendFiscal, RequireAuth: true, Idempotency: true, Permission: "fiscal:note:issue",
		PathParams:  map[string]string{"invoice_id": "related_invoice_id"},
		NewRequest:  func() proto.Message { return &pb.IssueNoteRequest{} },
		NewResponse: func() proto.Message { return &pb.Invoice{} },
	},
	{
		Method: "GET", Path: "/v1/fiscal/taxpayers", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/SearchTaxpayers",
		Backend: BackendFiscal, RequireAuth: true, Permission: "fiscal:issue",
		QueryParams: map[string]string{"q": "query", "page_size": "page.page_size", "page_token": "page.page_token"},
		NewRequest:  func() proto.Message { return &pb.SearchTaxpayersRequest{} },
		NewResponse: func() proto.Message { return &pb.SearchTaxpayersResponse{} },
	},
	{
		Method: "PUT", Path: "/v1/fiscal/taxpayers", RPC: "/plentypay.fiscal.v1.FiscalInvoicing/UpsertTaxpayer",
		Backend: BackendFiscal, RequireAuth: true, Idempotency: true, Permission: "fiscal:issue",
		NewRequest:  func() proto.Message { return &pb.UpsertTaxpayerRequest{} },
		NewResponse: func() proto.Message { return &pb.Taxpayer{} },
	},
}

func init() { Table = append(Table, fiscalRoutes...) }
