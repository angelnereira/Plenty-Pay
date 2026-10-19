package domain

import (
	"errors"
	"fmt"
	"sort"
	"time"
)

var ErrInsufficientHistory = errors.New("INSUFFICIENT_HISTORY")

// DailyValue es un día de la serie diaria sobre la que se calcula.
type DailyValue struct {
	Day   time.Time
	Value int64
}

// RobustZ implements R3: z-score robusto con mediana y MAD de 28 días.
// |z| > 3.5 dispara la alerta; máximo una alerta por métrica y día.
func RobustZ(history []DailyValue, today int64) (float64, bool) {
	if len(history) == 0 {
		return 0, false
	}
	values := make([]int64, 0, len(history))
	for _, h := range history {
		values = append(values, h.Value)
	}
	med := median(values)
	devs := make([]int64, 0, len(values))
	for _, v := range values {
		devs = append(devs, abs(v-med))
	}
	mad := median(devs)
	// El MAD puede ser 0 (serie plana): se cae a la desviación media absoluta.
	scale := mad * 15 // 1.4826 * MAD ≈ robusta a outliers
	if scale == 0 {
		var s int64
		for _, v := range values {
			s += abs(v - med)
		}
		scale = s / int64(len(values))
	}
	if scale == 0 {
		return 0, false
	}
	z := float64(today-med) / float64(scale)
	return z, absInt64(today-med) != 0
}

func median(values []int64) int64 {
	if len(values) == 0 {
		return 0
	}
	s := make([]int64, len(values))
	copy(s, values)
	sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })
	mid := len(s) / 2
	if len(s)%2 == 1 {
		return s[mid]
	}
	return (s[mid-1] + s[mid]) / 2
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

func absInt64(v int64) int64 { return abs(v) }

// AnomalyThreshold y las seasonalidades de R3.
const (
	AnomalyThreshold  = 3.5
	AnomalyWindowDays = 28
)

// IsAnomaly decide si el día de hoy es anómalo (R3).
func IsAnomaly(history []DailyValue, today int64) (bool, float64) {
	if len(history) < AnomalyWindowDays {
		return false, 0
	}
	window := history[len(history)-AnomalyWindowDays:]
	z, ok := RobustZ(window, today)
	if !ok {
		return false, z
	}
	return z > AnomalyThreshold || z < -AnomalyThreshold, z
}

// AlertRule de F21.6: umbral fijo o anomalía.
type AlertRule struct {
	ID        string
	TenantID  string
	Metric    string
	Op        string // GT | LT | ANOMALY
	Threshold int64
	Active    bool
}

// AlertEvent de F21.6: una alerta por regla y día.
type AlertEvent struct {
	ID            string
	TenantID      string
	RuleID        string
	Metric        string
	Day           time.Time
	ObservedValue int64
	ZScore        float64
}

// ExistingDays son las fechas que ya dispararon esa regla (UNIQUE (rule_id, day)).
func ExistingDays(events []AlertEvent, ruleID string) map[string]struct{} {
	out := map[string]struct{}{}
	for _, e := range events {
		if e.RuleID == ruleID {
			out[e.Day.UTC().Format("2006-01-02")] = struct{}{}
		}
	}
	return out
}

// EvaluateAlert evalúa una regla contra el valor del día y devuelve el evento si
// dispara. Nunca duplica la alerta del mismo día (R3, UNIQUE en la tabla).
func EvaluateAlert(rule AlertRule, history []DailyValue, today time.Time, value int64, existing []AlertEvent) (*AlertEvent, bool) {
	if !rule.Active {
		return nil, false
	}
	var triggered bool
	var z float64
	switch rule.Op {
	case "GT":
		triggered = value > rule.Threshold
	case "LT":
		triggered = value < rule.Threshold
	case "ANOMALY":
		triggered, z = IsAnomaly(history, value)
	default:
		return nil, false
	}
	if !triggered {
		return nil, false
	}
	dayKey := today.UTC().Format("2006-01-02")
	if _, ok := ExistingDays(existing, rule.ID)[dayKey]; ok {
		return nil, false
	}
	return &AlertEvent{
		RuleID: rule.ID, TenantID: rule.TenantID, Metric: rule.Metric,
		Day: today, ObservedValue: value, ZScore: z,
	}, true
}

// Forecast es el resultado de R4.
type Forecast struct {
	Points  []ForecastPoint
	Method  string
	Warning string
}

// ForecastPoint son los puntos del pronóstico.
type ForecastPoint struct {
	Day     time.Time
	Value   int64
	Lower80 int64
	Upper80 int64
}

// HoltWinters aditivo con estacionalidad semanal (R4). Requiere 56 días de
// historia; con menos devuelve media móvil con el aviso "historia insuficiente".
func HoltWinters(series []DailyValue, horizon int) Forecast {
	const minHistory = 56
	if len(series) < minHistory {
		if len(series) == 0 {
			return Forecast{Method: "moving_average", Warning: "historia insuficiente"}
		}
		return movingAverage(series, horizon)
	}
	// Componentes: nivel, tendencia, 7 posiciones de estacionalidad.
	level := series[0].Value
	trend := series[1].Value - series[0].Value
	const seasonLen = 7
	season := make([]int64, seasonLen)
	// La estacionalidad inicial es el promedio de cada día de la semana.
	counts := make([]int64, seasonLen)
	for i, v := range series {
		s := i % seasonLen
		season[s] += v.Value
		counts[s]++
	}
	for i := range season {
		if counts[i] > 0 {
			season[i] = halfUp(season[i], counts[i])
		}
	}
	// Un paso por observación.
	for i := 1; i < len(series); i++ {
		idx := i % seasonLen
		prevLevel := level
		level = level + trend + (season[idx] - (level - trend))
		trend = halfUp(level-prevLevel, 1)
		season[idx] = series[i].Value - level
	}
	// Desviación de los residuos para el intervalo del 80 %.
	var residualSum int64
	for i, v := range series {
		pred := level + trend*int64(i-len(series)+1) + season[i%seasonLen]
		residualSum += abs(v.Value - pred)
	}
	sigma := halfUp(residualSum, int64(len(series)))
	const z80 = 12823 // 1.2816 en basis points → intervalo del 80 %
	out := make([]ForecastPoint, 0, horizon)
	last := series[len(series)-1].Day
	for h := 1; h <= horizon; h++ {
		day := last.AddDate(0, 0, h)
		point := level + trend*int64(h) + season[day.Weekday()]
		margin := halfUp(abs(sigma)*z80, 10000)
		out = append(out, ForecastPoint{Day: day, Value: point, Lower80: point - margin, Upper80: point + margin})
	}
	return Forecast{Points: out, Method: "holt_winters"}
}

func movingAverage(series []DailyValue, horizon int) Forecast {
	window := 7
	if len(series) < window {
		window = len(series)
	}
	var total int64
	for _, v := range series[len(series)-window:] {
		total += v.Value
	}
	avg := halfUp(total, int64(window))
	out := make([]ForecastPoint, 0, horizon)
	last := series[len(series)-1].Day
	for h := 1; h <= horizon; h++ {
		day := last.AddDate(0, 0, h)
		out = append(out, ForecastPoint{Day: day, Value: avg, Lower80: avg, Upper80: avg})
	}
	return Forecast{Points: out, Method: "moving_average", Warning: "historia insuficiente"}
}

// CustomerStats es la fila de RFM (F21.5).
type CustomerStats struct {
	TenantID       string
	CustomerUserID string
	FirstPurchase  time.Time
	LastPurchase   time.Time
	Orders         int64
	RevenueMinor   int64
}

// RFM asigna quintiles 1..5 (R5).
type RFM struct {
	RecencyDays int
	Frequency   int64
	Monetary    int64
	RecencyQ    int
	FrequencyQ  int
	MonetaryQ   int
}

// ComputeRFM calcula recencia (días desde la última compra), frecuencia y monto,
// y asigna el quintil de cada eje: 5 es el mejor.
func ComputeRFM(customers []CustomerStats, reference time.Time) []RFM {
	if len(customers) == 0 {
		return nil
	}
	recencies := make([]int64, 0, len(customers))
	freqs := make([]int64, 0, len(customers))
	moneys := make([]int64, 0, len(customers))
	base := make([]RFM, len(customers))
	for i, c := range customers {
		r := int64(reference.UTC().Sub(c.LastPurchase.UTC()).Hours() / 24)
		if r < 0 {
			r = 0
		}
		base[i] = RFM{RecencyDays: int(r), Frequency: c.Orders, Monetary: c.RevenueMinor}
		recencies = append(recencies, r)
		freqs = append(freqs, c.Orders)
		moneys = append(moneys, c.RevenueMinor)
	}
	rQ := quintiles(recencies)
	fQ := quintiles(freqs)
	mQ := quintiles(moneys)
	// La recencia se invierte: pocos días desde la última compra es mejor, así que el
	// valor más bajo recibe el quintil más alto (R5).
	inverted := make(map[int64]int, len(rQ))
	for value, q := range rQ {
		inverted[value] = 6 - q
	}
	for i := range base {
		base[i].RecencyQ = inverted[recencies[i]]
		base[i].FrequencyQ = fQ[freqs[i]]
		base[i].MonetaryQ = mQ[moneys[i]]
	}
	return base
}

// quintiles devuelve un mapa valor→quintil. Quintil 1 = más bajo. Para recencia,
// menos días es mejor, así que el orden se invierte al asignar el segmento.
func quintiles(values []int64) map[int64]int {
	sorted := make([]int64, len(values))
	copy(sorted, values)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	unique := make([]int64, 0, len(sorted))
	for i, v := range sorted {
		if i == 0 || sorted[i-1] != v {
			unique = append(unique, v)
		}
	}
	out := map[int64]int{}
	for _, v := range unique {
		// Rango 0..len-1 mapeado a quintiles 1..5.
		idx := 0
		for _, u := range unique {
			if u < v {
				idx++
			}
		}
		q := (idx*5)/len(unique) + 1
		if q > 5 {
			q = 5
		}
		out[v] = q
	}
	return out
}

// Segment es un segmento con nombre (R5).
type Segment struct {
	Name  string
	Count int
}

// SegmentFor aplica la tabla de segmentos de R5 sobre los quintiles.
func SegmentFor(rfm RFM, firstPurchaseIsRecent bool) string {
	switch {
	case rfm.FrequencyQ >= 4 && rfm.RecencyQ >= 4 && rfm.MonetaryQ >= 4:
		return "Campeones"
	case rfm.RecencyQ >= 4 && rfm.FrequencyQ <= 2:
		return "Nuevos"
	case rfm.RecencyQ >= 3 && rfm.FrequencyQ >= 3:
		return "Fieles"
	case rfm.RecencyQ <= 2 && rfm.FrequencyQ >= 3:
		return "En riesgo"
	case rfm.RecencyQ <= 2 && rfm.FrequencyQ <= 2:
		return "Dormidos"
	case rfm.MonetaryQ >= 4:
		return "Potenciales"
	case firstPurchaseIsRecent:
		return "Nuevos"
	default:
		return "Regulares"
	}
}

// ABCItem es una fila de la clasificación ABC.
type ABCItem struct {
	VariantID     string
	RevenueMinor  int64
	CumulativeBps int64
	Class         string
}

// ClassifyABC reparte por ingresos con 80/15/5 (SPEC §4 GetProductAbc).
func ClassifyABC(items []ABCItem) []ABCItem {
	if len(items) == 0 {
		return nil
	}
	total := int64(0)
	for _, it := range items {
		total += it.RevenueMinor
	}
	if total <= 0 {
		out := make([]ABCItem, len(items))
		copy(out, items)
		for i := range out {
			out[i].Class = "D"
		}
		return out
	}
	sorted := make([]ABCItem, len(items))
	copy(sorted, items)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].RevenueMinor > sorted[j].RevenueMinor })
	var cumulative int64
	for i := range sorted {
		cumulative += sorted[i].RevenueMinor
		sorted[i].CumulativeBps = halfUp(cumulative*10000, total)
		switch {
		case sorted[i].CumulativeBps <= 8000:
			sorted[i].Class = "A"
		case sorted[i].CumulativeBps <= 9500:
			sorted[i].Class = "B"
		default:
			sorted[i].Class = "C"
		}
	}
	return sorted
}

// Dashboard (F21.4): los widgets son consultas del catálogo, nunca SQL libre (R6).
type Widget struct {
	Metric      string `json:"metric"`
	Granularity string `json:"granularity"`
	Dimension   string `json:"dimension"`
	Title       string `json:"title"`
}

// Dashboard es un conjunto de widgets de un tenant.
type Dashboard struct {
	ID        string
	TenantID  string
	Name      string
	Widgets   []Widget
	IsDefault bool
	Version   int
}

// ValidateDashboard comprueba que cada widget apunte a una métrica del catálogo y a
// una dimensión soportada: nunca una consulta libre.
func ValidateDashboard(c *Catalog, d Dashboard) error {
	if d.Name == "" {
		return fmt.Errorf("%w: dashboard sin nombre", ErrMetricNotFound)
	}
	for i, w := range d.Widgets {
		if _, err := c.Lookup(w.Metric); err != nil {
			return fmt.Errorf("widget %d: %w", i, err)
		}
		if err := c.SupportsDimension(w.Metric, Dimension(w.Dimension)); err != nil {
			return fmt.Errorf("widget %d: %w", i, err)
		}
		switch Granularity(w.Granularity) {
		case Daily, Weekly, Monthly:
		default:
			return fmt.Errorf("widget %d: granularidad %q no soportada", i, w.Granularity)
		}
	}
	return nil
}
