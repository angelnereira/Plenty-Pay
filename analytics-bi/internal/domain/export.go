package domain

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ErrExportNotReady y ErrExportKindUnknown.
var (
	ErrExportNotReady    = errors.New("EXPORT_NOT_READY")
	ErrExportKindUnknown = errors.New("EXPORT_KIND_UNKNOWN")
)

// Export es el trabajo asíncrono de F21.9: el enlace vive 24 h.
type Export struct {
	ID        string
	TenantID  string
	Kind      string // CSV | XLSX
	Status    string // PENDING | READY | FAILED
	ObjectKey string
	ExpiresAt *time.Time
}

// LinkFor devuelve el enlace si no expiró.
func LinkFor(e Export, now time.Time) (string, error) {
	if e.Status != "READY" || e.ObjectKey == "" {
		return "", ErrExportNotReady
	}
	if e.ExpiresAt != nil && now.After(*e.ExpiresAt) {
		// El enlace vencido no se sirve: se devuelve NOT_FOUND al cliente, no el objeto.
		return "", ErrExportNotReady
	}
	return e.ObjectKey, nil
}

// CSVHeader son las columnas de los exportes: nombres de negocio, sin identificadores
// internos ni datos personales (R8, N-DAT-04).
var CSVHeader = []string{"day", "branch_id", "channel", "metric", "value"}

// BuildCSV genera el CSV de una serie. Los valores van como enteros: la hoja de
// cálculo los suma sin arrastrar error de punto flotante.
func BuildCSV(rows []ExportRow) ([]byte, error) {
	var buf strings.Builder
	w := csv.NewWriter(&buf)
	if err := w.Write(CSVHeader); err != nil {
		return nil, fmt.Errorf("csv encabezado: %w", err)
	}
	for _, r := range rows {
		if err := w.Write([]string{
			r.Day.UTC().Format("2006-01-02"),
			r.BranchID,
			r.Channel,
			r.Metric,
			strconv.FormatInt(r.Value, 10),
		}); err != nil {
			return nil, fmt.Errorf("csv fila: %w", err)
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return nil, fmt.Errorf("csv cierre: %w", err)
	}
	return []byte(buf.String()), nil
}

// ExportRow es una fila de exporte.
type ExportRow struct {
	Day      time.Time
	BranchID string
	Channel  string
	Metric   string
	Value    int64
}

// RowsFromSeries convierte una serie en filas de exporte, ordenadas por día.
func RowsFromSeries(metric string, series Series) []ExportRow {
	out := make([]ExportRow, 0, len(series.Points))
	for _, p := range series.Points {
		out = append(out, ExportRow{
			Day: p.Day, BranchID: p.BranchID, Channel: p.Channel, Metric: metric, Value: p.Value,
		})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Day.Before(out[j].Day) })
	return out
}

// BuildXLSX genera un libro mínimo legible sin dependencias externas: un archivo
// SpreadsheetML de una hoja. Excel, Numbers y LibreOffice lo abren.
func BuildXLSX(rows []ExportRow) ([]byte, error) {
	type cell struct {
		ref string
		val string
	}
	var table [][]cell
	header := make([]cell, 0, len(CSVHeader))
	for i, h := range CSVHeader {
		header = append(header, cell{ref: columnName(i) + "1", val: h})
	}
	table = append(table, header)
	for i, r := range rows {
		row := i + 2
		table = append(table, []cell{
			{columnName(0) + strconv.Itoa(row), r.Day.UTC().Format("2006-01-02")},
			{columnName(1) + strconv.Itoa(row), r.BranchID},
			{columnName(2) + strconv.Itoa(row), r.Channel},
			{columnName(3) + strconv.Itoa(row), r.Metric},
			{columnName(4) + strconv.Itoa(row), strconv.FormatInt(r.Value, 10)},
		})
	}
	if len(table) > 65536 {
		return nil, fmt.Errorf("%w: la hoja supera el límite de 65536 filas", ErrExportKindUnknown)
	}

	var b strings.Builder
	b.WriteString(xmlHeader)
	b.WriteString(`<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`)
	b.WriteString(`<Worksheet ss:Name="Export"><Table>`)
	for _, row := range table {
		b.WriteString("<Row>")
		for _, c := range row {
			b.WriteString(fmt.Sprintf(`<Cell ss:StyleID="s1"><Data ss:Type="String">%s</Data></Cell>`, escapeXML(c.val)))
			_ = c.ref
		}
		b.WriteString("</Row>")
	}
	b.WriteString(`</Table></Worksheet></Workbook>`)
	return []byte(b.String()), nil
}

const xmlHeader = `<?xml version="1.0"?>` + "\n" + `<?mso-application progid="Excel.Sheet"?>` + "\n"

func columnName(i int) string {
	name := ""
	for i >= 0 {
		name = string(rune('A'+(i%26))) + name
		i = i/26 - 1
	}
	return name
}

func escapeXML(s string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&apos;")
	return replacer.Replace(s)
}

// Build renderiza el exporte en el formato pedido.
func Build(kind string, rows []ExportRow) ([]byte, error) {
	switch strings.ToUpper(kind) {
	case "CSV":
		return BuildCSV(rows)
	case "XLSX":
		return BuildXLSX(rows)
	default:
		return nil, fmt.Errorf("%w: %s", ErrExportKindUnknown, kind)
	}
}

// WidgetsJSON serializa el dashboard para la columna `widgets`.
func WidgetsJSON(widgets []Widget) ([]byte, error) {
	b, err := json.Marshal(widgets)
	if err != nil {
		return nil, fmt.Errorf("serializar widgets: %w", err)
	}
	return b, nil
}

// ParseWidgets lee los widgets de un dashboard.
func ParseWidgets(raw []byte) ([]Widget, error) {
	var out []Widget
	if len(raw) == 0 {
		return out, nil
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("leer widgets: %w", err)
	}
	return out, nil
}
