package domain

import (
	"bytes"
	"errors"
	"fmt"
	"time"
)

var (
	ErrPayslipNotApproved = errors.New("PAYSLIP_NOT_APPROVED")
	ErrObjectStoreMissing = errors.New("OBJECT_STORE_NOT_CONFIGURED")
)

// PayslipDocument (F19.7, R7): comprobante PDF por empleado, con la versión de los
// parámetros legales usada (pp.legal_param_version) y sin datos sensibles.
type PayslipDocument struct {
	RunID        string
	EmployeeID   string
	EmployeeName string
	PeriodStart  string
	PeriodEnd    string
	Payslip      Payslip
	IssuedAt     time.Time
}

// RenderPayslipPDF produce el PDF mínimo válido. Es texto plano maquetado dentro de
// un PDF 1.4 con la fuente estándar Helvetica: sin librería externa, sin datos
// cifrados y sin importes en float.
func RenderPayslipPDF(d PayslipDocument) ([]byte, error) {
	if d.EmployeeName == "" || d.EmployeeID == "" || d.RunID == "" {
		return nil, ErrPayslipNotApproved
	}
	if d.Payslip.LegalParams == "" {
		return nil, ErrNoLegalParams
	}

	lines := []string{
		"Comprobante de pago",
		fmt.Sprintf("Corrida: %s", d.RunID),
		fmt.Sprintf("Periodo: %s a %s", d.PeriodStart, d.PeriodEnd),
		fmt.Sprintf("Empleado: %s", d.EmployeeName),
		fmt.Sprintf("Bruto: %d", d.Payslip.GrossMinor),
	}
	for _, ded := range d.Payslip.Deductions {
		lines = append(lines, fmt.Sprintf("  - %s: %d", ded.Code, ded.Minor))
	}
	lines = append(lines,
		fmt.Sprintf("Neto: %d", d.Payslip.NetMinor),
		fmt.Sprintf("Parametros legales: %s", d.Payslip.LegalParams),
		fmt.Sprintf("Emitido: %s", d.IssuedAt.UTC().Format(time.RFC3339)),
	)

	return buildPDF(lines)
}

// buildPDF arma un PDF 1.4 de una página con Helvetica.
func buildPDF(lines []string) ([]byte, error) {
	var content bytes.Buffer
	content.WriteString("BT\n/F1 11 Tf\n72 740 Td\n14 TL\n")
	for i, ln := range lines {
		if i > 0 {
			content.WriteString("T*\n")
		}
		content.WriteString(fmt.Sprintf("(%s) Tj\n", escapePDF(ln)))
	}
	content.WriteString("ET\n")

	var objs []string
	objs = append(objs, "<< /Type /Catalog /Pages 2 0 R >>")
	objs = append(objs, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
	objs = append(objs, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>")
	objs = append(objs, fmt.Sprintf("<< /Length %d >>\nstream\n%sendstream", content.Len(), content.String()))
	objs = append(objs, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

	var buf bytes.Buffer
	buf.WriteString("%PDF-1.4\n")
	offsets := make([]int, len(objs)+1)
	for i, o := range objs {
		offsets[i+1] = buf.Len()
		buf.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", i+1, o))
	}
	xref := buf.Len()
	buf.WriteString(fmt.Sprintf("xref\n0 %d\n0000000000 65535 f \n", len(objs)+1))
	for i := 1; i <= len(objs); i++ {
		buf.WriteString(fmt.Sprintf("%010d 00000 n \n", offsets[i]))
	}
	buf.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objs)+1, xref))
	return buf.Bytes(), nil
}

func escapePDF(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		switch c := s[i]; c {
		case '(', ')', '\\':
			out = append(out, '\\', c)
		default:
			out = append(out, c)
		}
	}
	return string(out)
}
