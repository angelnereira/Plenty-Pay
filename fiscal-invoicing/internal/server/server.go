package server

import (
	"context"

	pb "plentypay/fiscal-invoicing/internal/pb"
)

type FiscalServer struct {
	pb.UnimplementedFiscalInvoicingServer
}

func NewFiscalServer() *FiscalServer {
	return &FiscalServer{}
}

func (s *FiscalServer) EvaluateDocumentPolicy(ctx context.Context, req *pb.EvaluateDocumentPolicyRequest) (*pb.DocumentPolicyDecision, error) {
	return &pb.DocumentPolicyDecision{DocumentType: pb.DocumentType_DOCUMENT_TYPE_FISCAL_INVOICE}, nil
}

func (s *FiscalServer) IssueInvoice(ctx context.Context, req *pb.IssueInvoiceRequest) (*pb.Invoice, error) {
	if len(req.Lines) == 0 {
		return nil, simpleErr("TOTALS_MISMATCH", "sin líneas")
	}
	var subtotal, tax, total int64
	for _, l := range req.Lines {
		up := int64(0)
		if l.UnitPrice != nil { up = l.UnitPrice.AmountMinor }
		subtotal += up * l.QuantityMilli / 1000
		total += up * l.QuantityMilli / 1000
	}
	tax = total - subtotal
	if total != subtotal+tax {
		return nil, simpleErr("TOTALS_MISMATCH", "totales no cuadran")
	}
	currency := req.Currency
	if currency == "" {
		currency = "USD"
	}
	return &pb.Invoice{
		TenantId: "",
		Status:   pb.InvoiceStatus_INVOICE_STATUS_DRAFT,
		Subtotal: &pb.Money{AmountMinor: subtotal, Currency: currency},
		Tax:      &pb.Money{AmountMinor: tax, Currency: currency},
		Total:    &pb.Money{AmountMinor: total, Currency: currency},
		Lines:    req.Lines,
	}, nil
}

func (s *FiscalServer) IssueCreditNote(ctx context.Context, req *pb.IssueNoteRequest) (*pb.Invoice, error) {
	if req.RelatedInvoiceId == "" {
		return nil, simpleErr("RELATED_NOT_ACCEPTED", "related invoice required")
	}
	return &pb.Invoice{
		TenantId:         "",
		Status:           pb.InvoiceStatus_INVOICE_STATUS_DRAFT,
		RelatedInvoiceId: req.RelatedInvoiceId,
		Subtotal:         &pb.Money{AmountMinor: 0, Currency: "USD"},
		Tax:              &pb.Money{AmountMinor: 0, Currency: "USD"},
		Total:            &pb.Money{AmountMinor: 0, Currency: "USD"},
	}, nil
}

func (s *FiscalServer) IssueDebitNote(ctx context.Context, req *pb.IssueNoteRequest) (*pb.Invoice, error) {
	if req.RelatedInvoiceId == "" {
		return nil, simpleErr("RELATED_NOT_ACCEPTED", "related invoice required")
	}
	return &pb.Invoice{
		TenantId:         "",
		Status:           pb.InvoiceStatus_INVOICE_STATUS_DRAFT,
		RelatedInvoiceId: req.RelatedInvoiceId,
		Subtotal:         &pb.Money{AmountMinor: 0, Currency: "USD"},
		Tax:              &pb.Money{AmountMinor: 0, Currency: "USD"},
		Total:            &pb.Money{AmountMinor: 0, Currency: "USD"},
	}, nil
}

func (s *FiscalServer) GetInvoice(ctx context.Context, req *pb.GetInvoiceRequest) (*pb.Invoice, error) {
	return nil, simpleErr("NOT_FOUND", "not found")
}

func (s *FiscalServer) ListInvoices(ctx context.Context, req *pb.ListInvoicesRequest) (*pb.ListInvoicesResponse, error) {
	return &pb.ListInvoicesResponse{}, nil
}

func (s *FiscalServer) RefreshInvoiceStatus(ctx context.Context, req *pb.GetInvoiceRequest) (*pb.Invoice, error) {
	return nil, simpleErr("NOT_FOUND", "not found")
}

func (s *FiscalServer) GetInvoiceDocument(ctx context.Context, req *pb.GetInvoiceDocumentRequest) (*pb.InvoiceDocument, error) {
	// Devuelve las claves de objeto (XML/PDF) prefirmadas; el PAC simulado las genera.
	return &pb.InvoiceDocument{
		ObjectKey:   "fiscal/simulated/" + req.InvoiceId + ".xml",
		ContentType: "application/xml",
		DownloadUrl: "https://simulated/download/" + req.InvoiceId,
	}, nil
}

func (s *FiscalServer) ConfigureFiscalProfile(ctx context.Context, req *pb.ConfigureFiscalProfileRequest) (*pb.FiscalProfile, error) {
	return nil, simpleErr("UNIMPLEMENTED", "not implemented")
}

func (s *FiscalServer) GetFiscalProfile(ctx context.Context, req *pb.GetFiscalProfileRequest) (*pb.FiscalProfile, error) {
	return nil, simpleErr("NOT_FOUND", "not found")
}

func (s *FiscalServer) GetFolioStatus(ctx context.Context, req *pb.GetFolioStatusRequest) (*pb.FolioStatus, error) {
	return nil, simpleErr("NOT_FOUND", "not found")
}

func (s *FiscalServer) UpsertTaxpayer(ctx context.Context, req *pb.UpsertTaxpayerRequest) (*pb.Taxpayer, error) {
	return nil, simpleErr("UNIMPLEMENTED", "not implemented")
}

func (s *FiscalServer) SearchTaxpayers(ctx context.Context, req *pb.SearchTaxpayersRequest) (*pb.SearchTaxpayersResponse, error) {
	return &pb.SearchTaxpayersResponse{}, nil
}

func simpleErr(reason, msg string) error {
	return &simpleError{reason: reason, msg: msg}
}

type simpleError struct{ reason, msg string }

func (e *simpleError) Error() string { return e.reason + ": " + e.msg }
