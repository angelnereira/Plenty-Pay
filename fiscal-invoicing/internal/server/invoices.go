package server

import (
	"context"
	"crypto/sha256"
	"strconv"
	"strings"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/pb"
	"plentypay/fiscal-invoicing/internal/service"
	"plentypay/fiscal-invoicing/internal/store"
)

// requestHash es el SHA-256 del request canónico sin la clave (grpc-conventions.md §3).
func requestHash(m proto.Message) ([]byte, error) {
	c := proto.Clone(m)
	if r, ok := c.(*pb.IssueInvoiceRequest); ok {
		r.IdempotencyKey = ""
	}
	if r, ok := c.(*pb.IssueNoteRequest); ok {
		r.IdempotencyKey = ""
	}
	b, err := proto.MarshalOptions{Deterministic: true}.Marshal(c)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(b)
	return sum[:], nil
}

func linesFromPB(ls []*pb.InvoiceLine) []domain.Line {
	out := make([]domain.Line, len(ls))
	for i, l := range ls {
		out[i] = domain.Line{Description: strings.TrimSpace(l.GetDescription()), CPBSCode: l.GetCpbsCode(),
			UnitMeasureCode: l.GetUnitMeasureCode(), QuantityMilli: l.GetQuantityMilli(),
			UnitPriceMinor: l.GetUnitPrice().GetAmountMinor(), DiscountMinor: l.GetDiscount().GetAmountMinor(),
			TaxRateBps: int64(l.GetTaxRateBps())}
	}
	return out
}

func money(v int64, cur string) *pb.Money { return &pb.Money{AmountMinor: v, Currency: cur} }

func invoiceToPB(inv domain.Invoice) *pb.Invoice {
	out := &pb.Invoice{
		InvoiceId: inv.ID, TenantId: inv.TenantID, DocumentType: pb.DocumentType(inv.DocType), Status: pb.InvoiceStatus(inv.Status),
		FolioNumber: inv.PointOfSaleCode + "-" + strconv.FormatInt(inv.Number, 10), Cufe: inv.CUFE, QrUrl: inv.QR,
		Subtotal: money(inv.Totals.SubtotalMinor, inv.Currency), Tax: money(inv.Totals.TaxMinor, inv.Currency),
		Total: money(inv.Totals.TotalMinor, inv.Currency), RelatedInvoiceId: inv.RelatedInvoiceID,
		RejectionReason: inv.RejectionReason,
	}
	if inv.Customer != nil {
		out.Customer = taxpayerToPB(*inv.Customer)
	}
	for _, l := range inv.Lines {
		out.Lines = append(out.Lines, &pb.InvoiceLine{Description: l.Description, CpbsCode: l.CPBSCode,
			UnitMeasureCode: l.UnitMeasureCode, QuantityMilli: l.QuantityMilli, UnitPrice: money(l.UnitPriceMinor, inv.Currency),
			Discount: money(l.DiscountMinor, inv.Currency), TaxRateBps: int32(l.TaxRateBps)})
	}
	if inv.IssuedAt != nil {
		out.IssuedAt = timestamppb.New(*inv.IssuedAt)
	}
	return out
}

// IssueInvoice emite una factura: calcula (R1), numera (R2) y la deja en cola para el PAC (R3).
func (s *Server) IssueInvoice(ctx context.Context, req *pb.IssueInvoiceRequest) (*pb.Invoice, error) {
	hash, err := requestHash(req)
	if err != nil {
		return nil, toStatus(err)
	}
	var customer *domain.Taxpayer
	if c := req.GetCustomer(); c != nil && c.GetTaxId() != "" {
		customer = &domain.Taxpayer{TaxIDType: c.GetTaxIdType(), TaxID: c.GetTaxId(), CheckDigit: c.GetCheckDigit(),
			LegalName: c.GetLegalName(), Email: c.GetEmail()}
	}
	inv, err := s.svc.IssueInvoice(ctx, service.IssueInput{
		IdempotencyKey: strings.TrimSpace(req.GetIdempotencyKey()), RequestHash: hash, Customer: customer,
		Lines: linesFromPB(req.GetLines()), SourceType: req.GetSource().GetType(), SourceID: req.GetSource().GetId(),
		Currency: req.GetCurrency(), PaymentMethods: req.GetPaymentMethods(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return invoiceToPB(inv), nil
}

// GetInvoice devuelve un documento del negocio.
func (s *Server) GetInvoice(ctx context.Context, req *pb.GetInvoiceRequest) (*pb.Invoice, error) {
	inv, err := s.svc.GetInvoice(ctx, req.GetInvoiceId())
	if err != nil {
		return nil, toStatus(err)
	}
	return invoiceToPB(inv), nil
}

// RefreshInvoiceStatus devuelve el estado guardado: el worker es quien consulta al PAC (R3).
func (s *Server) RefreshInvoiceStatus(ctx context.Context, req *pb.GetInvoiceRequest) (*pb.Invoice, error) {
	return s.GetInvoice(ctx, req)
}

// ListInvoices pagina los documentos del negocio.
func (s *Server) ListInvoices(ctx context.Context, req *pb.ListInvoicesRequest) (*pb.ListInvoicesResponse, error) {
	list, next, err := s.svc.ListInvoices(ctx, store.ListFilter{Status: int(req.GetStatus()), DocType: int(req.GetDocumentType()),
		Limit: int(req.GetPage().GetPageSize()), Cursor: req.GetPage().GetPageToken()})
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.ListInvoicesResponse{Page: &pb.PageInfo{NextPageToken: next}}
	for _, inv := range list {
		out.Invoices = append(out.Invoices, invoiceToPB(inv))
	}
	return out, nil
}
