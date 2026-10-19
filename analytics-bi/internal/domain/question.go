package domain

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ErrQuestionNotUnderstood es el `reason` de SPEC §4 AskQuestion.
var ErrQuestionNotUnderstood = errors.New("QUESTION_NOT_UNDERSTOOD")

// Interpretation es lo que el traductor entendió. La respuesta SIEMPRE la muestra:
// el usuario ve métrica, rango y filtros antes de la cifra (R6).
type Interpretation struct {
	Metric      string      `json:"metric"`
	From        time.Time   `json:"from"`
	To          time.Time   `json:"to"`
	Granularity Granularity `json:"granularity"`
	Dimension   Dimension   `json:"dimension"`
	Filters     []Filter    `json:"filters"`
}

// Filter es un filtro interpretado de una dimensión del catálogo.
type Filter struct {
	Dimension Dimension `json:"dimension"`
	Value     string    `json:"value"`
}

// Answer es la respuesta de AskQuestion.
type Answer struct {
	Question       string         `json:"question"`
	Interpretation Interpretation `json:"interpretation"`
	Value          int64          `json:"value"`
	Unit           string         `json:"unit"`
	Rows           []AnswerRow    `json:"rows"`
}

// AnswerRow es una fila del resultado, con su dimensión y su valor.
type AnswerRow struct {
	Dimension string `json:"dimension"`
	Value     int64  `json:"value"`
}

type parsedMetric struct {
	name  string
	alias string
}

// metricAliases mapea la frase en español a la métrica del catálogo. Sin coincidencia
// → `QUESTION_NOT_UNDERSTOOD`: nunca se adivina.
var metricAliases = map[string]string{
	"ventas brutas":              "gross_sales",
	"ventas totales":             "gross_sales",
	"ventas brutas totals":       "gross_sales",
	"cuanto vendi":               "gross_sales",
	"cuanto vendimos":            "gross_sales",
	"vendido":                    "gross_sales",
	"ventas netas":               "net_sales",
	"ventas netas totales":       "net_sales",
	"netas":                      "net_sales",
	"pedidos":                    "orders_count",
	"ordenes":                    "orders_count",
	"cuantos pedidos":            "orders_count",
	"numero de pedidos":          "orders_count",
	"ticket promedio":            "avg_ticket",
	"ticket":                     "avg_ticket",
	"promedio por pedido":        "avg_ticket",
	"productos vendidos":         "items_sold",
	"items vendidos":             "items_sold",
	"unidades vendidas":          "items_sold",
	"tasa de reembolso":          "refund_rate",
	"reembolsos":                 "refund_rate",
	"margen bruto":               "gross_margin",
	"margen":                     "gross_margin",
	"clientes nuevos":            "new_vs_returning_customers",
	"clientes recurrentes":       "new_vs_returning_customers",
	"por medio de pago":          "payment_mix_by_rail",
	"liquidaciones":              "settlement_paid",
	"liquidado":                  "settlement_paid",
	"comisiones":                 "fees_paid",
	"entregas completadas":       "deliveries_completed",
	"entregas":                   "deliveries_completed",
	"tasa de exito":              "delivery_success_rate",
	"exito de entregas":          "delivery_success_rate",
	"tiempo de entrega":          "avg_delivery_time_minutes",
	"tiempo promedio de entrega": "avg_delivery_time_minutes",
}

var monthNames = map[string]time.Month{
	"enero": time.January, "febrero": time.February, "marzo": time.March,
	"abril": time.April, "mayo": time.May, "junio": time.June,
	"julio": time.July, "agosto": time.August, "septiembre": time.September,
	"octubre": time.October, "noviembre": time.November, "diciembre": time.December,
	"jan": time.January, "feb": time.February, "mar": time.March, "apr": time.April,
	"may": time.May, "jun": time.June, "jul": time.July, "aug": time.August,
	"sep": time.September, "oct": time.October, "nov": time.November, "dec": time.December,
}

var (
	// "de 1 a 31 de octubre" / "entre el 1 y el 31 de octubre"
	rangeRe = regexp.MustCompile(`(?i)(?:de|entre)\s+(?:el\s+)?(\d{1,2})(?:\s*(?:a|y|hasta)\s*(?:el\s+)?(\d{1,2}))?\s+de\s+([a-záéíóúñ]+)`)
	// "en octubre" / "durante octubre". Se exige que la palabra siguiente al
	// "en/durante" sea un nombre de mes o "mes de", para que "en la sucursal b1"
	// no se lea como el mes "la".
	monthRe = regexp.MustCompile(`(?i)(?:en|durante)\s+(?:(?:el\s+)?mes\s+(?:de\s+)?)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b`)
	// "de 2026-01-01 a 2026-01-31"
	isoRangeRe = regexp.MustCompile(`(?i)(?:de|from)\s+(\d{4}-\d{2}-\d{2})\s+(?:a|hasta|to)\s+(\d{4}-\d{2}-\d{2})`)
	yearRe     = regexp.MustCompile(`(?i)(?:en|durante)\s+(?:el\s+año\s+|año\s+)?(\d{4})`)
	branchRe   = regexp.MustCompile(`(?i)\b(?:en la sucursal|surcursal)\s+([a-z0-9_\-]+)`)
	channelRe  = regexp.MustCompile(`(?i)\b(?:por el canal|canal)\s+([a-z0-9_\-]+)`)
)

// normalize quita acentos y pasa a minúsculas para comparar frases.
func normalize(s string) string {
	lower := strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range lower {
		switch r {
		case 'á':
			b.WriteRune('a')
		case 'é':
			b.WriteRune('e')
		case 'í':
			b.WriteRune('i')
		case 'ó':
			b.WriteRune('o')
		case 'ú':
			b.WriteRune('u')
		case 'ñ':
			b.WriteRune('n')
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

// metricAliases normalizado, construido una sola vez.
var normalizedAliases = func() map[string]string {
	out := make(map[string]string, len(metricAliases))
	for phrase, metric := range metricAliases {
		out[normalize(phrase)] = metric
	}
	return out
}()

// Parser traduce español a una consulta del catálogo (R6).
type Parser struct {
	Catalog *Catalog
	// Reference es "hoy" para las preguntas relativas ("este mes", "los últimos 30 días").
	Reference time.Time
}

// Parse interpreta la pregunta. Si no reconoce métrica o rango, devuelve
// `QUESTION_NOT_UNDERSTOOD`: nunca genera una consulta libre.
func (p *Parser) Parse(question string) (Interpretation, error) {
	// R6: un intento de SQL libre se rechaza en la puerta. La única forma de consultar
	// es una métrica del catálogo.
	if ContainsSQL(question) {
		return Interpretation{}, fmt.Errorf("%w: la pregunta no puede contener SQL", ErrQuestionNotUnderstood)
	}
	q := normalize(question)
	metric, ok := p.matchMetric(q)
	if !ok {
		return Interpretation{}, fmt.Errorf("%w: no se reconoce la métrica", ErrQuestionNotUnderstood)
	}
	ref := p.Reference
	if ref.IsZero() {
		ref = time.Now().UTC()
	}
	ref = ref.UTC()

	var from, to time.Time
	if m := isoRangeRe.FindStringSubmatch(question); m != nil {
		var err error
		if from, err = time.Parse("2006-01-02", m[1]); err != nil {
			return Interpretation{}, fmt.Errorf("%w: fecha inválida", ErrQuestionNotUnderstood)
		}
		if to, err = time.Parse("2006-01-02", m[2]); err != nil {
			return Interpretation{}, fmt.Errorf("%w: fecha inválida", ErrQuestionNotUnderstood)
		}
	} else if m := rangeRe.FindStringSubmatch(q); m != nil {
		month, ok := monthNames[m[3]]
		if !ok {
			return Interpretation{}, fmt.Errorf("%w: mes desconocido %q", ErrQuestionNotUnderstood, m[3])
		}
		year := ref.Year()
		day := 1
		if n, err := strconv.Atoi(m[1]); err == nil && n >= 1 && n <= 31 {
			day = n
		}
		lastDay := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
		end := lastDay
		if m[2] != "" {
			if n, err := strconv.Atoi(m[2]); err == nil && n >= 1 && n <= 31 {
				end = n
			}
		}
		from = time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
		to = time.Date(year, month, end, 23, 59, 59, 0, time.UTC)
	} else if m := monthRe.FindStringSubmatch(q); m != nil {
		month, ok := monthNames[m[1]]
		if !ok {
			return Interpretation{}, fmt.Errorf("%w: mes desconocido %q", ErrQuestionNotUnderstood, m[1])
		}
		year := ref.Year()
		from = time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
		to = time.Date(year, month+1, 0, 23, 59, 59, 0, time.UTC)
	} else if m := yearRe.FindStringSubmatch(q); m != nil {
		year, err := strconv.Atoi(m[1])
		if err != nil {
			return Interpretation{}, fmt.Errorf("%w: año inválido", ErrQuestionNotUnderstood)
		}
		from = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
		to = time.Date(year, 12, 31, 23, 59, 59, 0, time.UTC)
	} else if strings.Contains(q, "hoy") || strings.Contains(q, "today") {
		from = time.Date(ref.Year(), ref.Month(), ref.Day(), 0, 0, 0, 0, time.UTC)
		to = from.Add(24 * time.Hour).Add(-time.Second)
	} else if strings.Contains(q, "ayer") {
		y := time.Date(ref.Year(), ref.Month(), ref.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -1)
		from, to = y, y.Add(24*time.Hour).Add(-time.Second)
	} else if strings.Contains(q, "semana") {
		start := time.Date(ref.Year(), ref.Month(), ref.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -7)
		from, to = start, from.AddDate(0, 0, 6)
	} else if strings.Contains(q, "mes") {
		from = time.Date(ref.Year(), ref.Month(), 1, 0, 0, 0, 0, time.UTC)
		to = time.Date(ref.Year(), ref.Month()+1, 0, 23, 59, 59, 0, time.UTC)
	} else if strings.Contains(q, "ano") || strings.Contains(q, "year") {
		from = time.Date(ref.Year()-1, 1, 1, 0, 0, 0, 0, time.UTC)
		to = time.Date(ref.Year(), 12, 31, 23, 59, 59, 0, time.UTC)
	} else {
		// Sin rango explícito no se inventa: por defecto el mes en curso, declarado en
		// la interpretación para que el usuario lo vea y lo corrija.
		from = time.Date(ref.Year(), ref.Month(), 1, 0, 0, 0, 0, time.UTC)
		to = time.Date(ref.Year(), ref.Month()+1, 0, 23, 59, 59, 0, time.UTC)
	}

	if to.Before(from) {
		from, to = to, from
	}

	interpretation := Interpretation{Metric: metric, From: from, To: to, Granularity: Daily}
	if m := branchRe.FindStringSubmatch(q); m != nil {
		interpretation.Filters = append(interpretation.Filters, Filter{Dimension: DimBranch, Value: m[1]})
		interpretation.Dimension = DimBranch
	}
	if m := channelRe.FindStringSubmatch(q); m != nil {
		interpretation.Filters = append(interpretation.Filters, Filter{Dimension: DimChannel, Value: m[1]})
		interpretation.Dimension = DimChannel
	}
	// Una dimensión no soportada por la métrica se rechaza en vez de ignorarse.
	if err := p.Catalog.SupportsDimension(metric, interpretation.Dimension); err != nil {
		return Interpretation{}, fmt.Errorf("%w: %s no tiene esa dimensión", ErrQuestionNotUnderstood, metric)
	}
	return interpretation, nil
}

func (p *Parser) matchMetric(q string) (string, bool) {
	// La frase más larga gana: "ventas brutas" antes que "ventas".
	phrases := make([]string, 0, len(normalizedAliases))
	for phrase := range normalizedAliases {
		phrases = append(phrases, phrase)
	}
	sort.Slice(phrases, func(i, j int) bool {
		if len(phrases[i]) != len(phrases[j]) {
			return len(phrases[i]) > len(phrases[j])
		}
		return phrases[i] < phrases[j]
	})
	for _, phrase := range phrases {
		if strings.Contains(q, phrase) {
			return normalizedAliases[phrase], true
		}
	}
	return "", false
}

// ApplyFilters deja solo las filas que cumplen los filtros interpretados.
func ApplyFilters(rows []SalesRow, filters []Filter) []SalesRow {
	if len(filters) == 0 {
		return rows
	}
	out := make([]SalesRow, 0, len(rows))
	for _, r := range rows {
		keep := true
		for _, f := range filters {
			switch f.Dimension {
			case DimBranch:
				if !strings.EqualFold(r.BranchID, f.Value) {
					keep = false
				}
			case DimChannel:
				if !strings.EqualFold(r.Channel, f.Value) {
					keep = false
				}
			case DimCategory:
				if !strings.EqualFold(r.CategoryID, f.Value) {
					keep = false
				}
			}
			if !keep {
				break
			}
		}
		if keep {
			out = append(out, r)
		}
	}
	return out
}

// AskQuestion responde: interpreta, filtra, calcula con el catálogo y devuelve la
// interpretación junto a la cifra (R6).
func (p *Parser) AskQuestion(question string, rows []SalesRow) (Answer, error) {
	interp, err := p.Parse(question)
	if err != nil {
		return Answer{}, err
	}
	filtered := ApplyFilters(rows, interp.Filters)
	inRange := make([]SalesRow, 0, len(filtered))
	for _, r := range filtered {
		if r.Day.Before(interp.From) || r.Day.After(interp.To) {
			continue
		}
		inRange = append(inRange, r)
	}
	series, err := Compute(interp.Metric, inRange)
	if err != nil {
		return Answer{}, err
	}
	answer := Answer{Question: question, Interpretation: interp, Unit: series.Unit}
	if len(series.Points) > 0 {
		answer.Value = series.Points[0].Value
	}
	for _, pt := range series.Points {
		label := ""
		if pt.BranchID != "" {
			label = pt.BranchID
		} else if pt.Channel != "" {
			label = pt.Channel
		} else if pt.CategoryID != "" {
			label = pt.CategoryID
		}
		answer.Rows = append(answer.Rows, AnswerRow{Dimension: label, Value: pt.Value})
	}
	return answer, nil
}

// ForbiddenSQLPatterns documenta por qué no existe SQL libre: R6 prohíbe cualquier
// entrada que no sea una métrica del catálogo. Esta función es la que se usa en el
// borde para rechazar consultas que lleguen con SQL incrustado.
var ForbiddenSQLPatterns = []string{"select ", "insert ", "update ", "delete ", "drop ", "union ", "--", ";"}

// ContainsSQL detecta un intento de SQL libre en la pregunta del usuario.
func ContainsSQL(question string) bool {
	q := normalize(question)
	for _, p := range ForbiddenSQLPatterns {
		if strings.Contains(q, p) {
			return true
		}
	}
	return false
}
