package server

import (
	"context"
	"testing"

	pb "plentypay/fiscal-invoicing/internal/pb"
)

func TestIssueInvoice_ValidTotals(t *testing.T) {
	s := NewFiscalServer()
	inv, err := s.IssueInvoice(context.Background(), &pb.IssueInvoiceRequest{
		Currency: "USD",
		Lines: []*pb.InvoiceLine{
			{QuantityMilli: 1000, UnitPrice: &pb.Money{AmountMinor: 10000, Currency: "USD"}, TaxRateBps: 700},
		},
	})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if inv.Total == nil || inv.Total.AmountMinor == 0 {
		t.Fatal("expected total")
	}
}

func TestIssueInvoice_EmptyLines(t *testing.T) {
	s := NewFiscalServer()
	_, err := s.IssueInvoice(context.Background(), &pb.IssueInvoiceRequest{Currency: "USD"})
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestGetInvoiceDocument(t *testing.T) {
	s := NewFiscalServer()
	d, err := s.GetInvoiceDocument(context.Background(), &pb.GetInvoiceDocumentRequest{InvoiceId: "inv-1"})
	if err != nil || d.ObjectKey == "" {
		t.Fatalf("got %v, %v", d, err)
	}
}

func TestEvaluateDocumentPolicy(t *testing.T) {
	s := NewFiscalServer()
	d, err := s.EvaluateDocumentPolicy(context.Background(), &pb.EvaluateDocumentPolicyRequest{})
	if err != nil || d.DocumentType == 0 {
		t.Fatalf("got %v, %v", d, err)
	}
}
