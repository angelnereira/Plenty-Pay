package domain

import (
	"bytes"
	"testing"
	"time"
)

// R7 / F19.7: comprobante PDF por empleado con la versión de parámetros legales.
func TestR7_RenderPayslipPDF_ValidPDF(t *testing.T) {
	doc := PayslipDocument{
		RunID:        "r1",
		EmployeeID:   "e1",
		EmployeeName: "Ana Pérez",
		PeriodStart:  "2026-10-01",
		PeriodEnd:    "2026-10-15",
		Payslip: Payslip{
			EmployeeID:  "e1",
			GrossMinor:  100000,
			Deductions:  []Deduction{{Code: "CSS", Minor: 9750}},
			NetMinor:    90250,
			LegalParams: "legal.pa@2026-10-01",
		},
		IssuedAt: time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC),
	}
	b, err := RenderPayslipPDF(doc)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if !bytes.HasPrefix(b, []byte("%PDF-1.4")) {
		t.Fatal("missing PDF header")
	}
	if !bytes.Contains(b, []byte("%%EOF")) {
		t.Fatal("missing EOF marker")
	}
	if !bytes.Contains(b, []byte("legal.pa@2026-10-01")) {
		t.Fatal("missing legal params version")
	}
	if !bytes.Contains(b, []byte("Neto: 90250")) {
		t.Fatal("missing net amount")
	}
}

func TestR7_RenderPayslipPDF_RequiresLegalParams(t *testing.T) {
	_, err := RenderPayslipPDF(PayslipDocument{RunID: "r1", EmployeeID: "e1", EmployeeName: "Ana"})
	if err != ErrNoLegalParams {
		t.Fatalf("expected ErrNoLegalParams, got %v", err)
	}
}

func TestR7_RenderPayslipPDF_EscapesParens(t *testing.T) {
	doc := PayslipDocument{RunID: "r1", EmployeeID: "e1", EmployeeName: "Ana (Pérez)", Payslip: Payslip{EmployeeID: "e1", GrossMinor: 1, NetMinor: 1, LegalParams: "v1"}}
	b, err := RenderPayslipPDF(doc)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if !bytes.Contains(b, []byte(`\(Pérez\)`)) {
		t.Fatal("expected escaped parentheses")
	}
}
