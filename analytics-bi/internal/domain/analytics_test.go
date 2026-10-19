package domain

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

func day(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func rowsFixture() []SalesRow {
	return []SalesRow{
		{Day: day(2026, 10, 1), BranchID: "b1", Channel: "pos", GrossMinor: 10000, NetMinor: 10000, Orders: 2, ItemsMilli: 3000, CostMinor: 4000, HasCost: true},
		{Day: day(2026, 10, 2), BranchID: "b1", Channel: "pos", GrossMinor: 20000, NetMinor: 20000, Orders: 4, ItemsMilli: 7000, CostMinor: 9000, HasCost: true},
		{Day: day(2026, 10, 3), BranchID: "b2", Channel: "web", GrossMinor: 30000, NetMinor: 30000, Orders: 6, ItemsMilli: 5000, RefundsMinor: 1000, RefundsCount: 1},
	}
}

// F21.3: el catálogo expone las 15 métricas de R2.
func TestF21_3_CatalogCoversR2(t *testing.T) {
	want := []string{
		"gross_sales", "net_sales", "orders_count", "avg_ticket", "items_sold",
		"refund_rate", "top_products", "gross_margin", "new_vs_returning_customers",
		"payment_mix_by_rail", "settlement_paid", "fees_paid", "deliveries_completed",
		"delivery_success_rate", "avg_delivery_time_minutes",
	}
	c := NewCatalog()
	for _, name := range want {
		if _, err := c.Lookup(name); err != nil {
			t.Fatalf("missing metric %s: %v", name, err)
		}
	}
	if len(c.Names()) != len(want) {
		t.Fatalf("unexpected catalog size %d, want %d", len(c.Names()), len(want))
	}
}

// F21.3: una métrica desconocida devuelve `METRIC_NOT_FOUND`.
func TestF21_3_UnknownMetric(t *testing.T) {
	c := NewCatalog()
	if _, err := c.Lookup("no_existe"); !errors.Is(err, ErrMetricNotFound) {
		t.Fatalf("expected ErrMetricNotFound, got %v", err)
	}
	if _, err := Compute("no_existe", rowsFixture()); !errors.Is(err, ErrMetricNotFound) {
		t.Fatalf("expected ErrMetricNotFound, got %v", err)
	}
}

// F21.2 / R2: los agregados coinciden con la referencia (todo en enteros minor).
func TestF21_2_GrossSales(t *testing.T) {
	s, err := Compute("gross_sales", rowsFixture())
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if s.Points[0].Value != 60000 {
		t.Fatalf("expected 60000, got %d", s.Points[0].Value)
	}
	if s.Unit != "currency_minor" {
		t.Fatalf("unexpected unit %s", s.Unit)
	}
}

// R2: `net_sales` descuenta los reembolsos.
func TestF21_2_NetSalesAfterRefunds(t *testing.T) {
	s, err := Compute("net_sales", rowsFixture())
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if s.Points[0].Value != 59000 {
		t.Fatalf("expected 59000, got %d", s.Points[0].Value)
	}
}

// R2: `avg_ticket` redondea half-up en enteros.
func TestF21_2_AvgTicketHalfUp(t *testing.T) {
	s, err := Compute("avg_ticket", rowsFixture())
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	// 60000 / 12 = 5000 exacto.
	if s.Points[0].Value != 5000 {
		t.Fatalf("expected 5000, got %d", s.Points[0].Value)
	}
	odd := []SalesRow{{Orders: 3, GrossMinor: 10000}}
	s2, _ := Compute("avg_ticket", odd)
	// 10000/3 = 3333.33 → 3333 (half-up sobre enteros no sube a 3334).
	if s2.Points[0].Value != 3333 {
		t.Fatalf("expected 3333, got %d", s2.Points[0].Value)
	}
}

// R2: `refund_rate` en basis points.
func TestF21_2_RefundRateBps(t *testing.T) {
	s, err := Compute("refund_rate", rowsFixture())
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	// 1000 / 60000 = 1.6667 % → 167 bps.
	if s.Points[0].Value != 167 {
		t.Fatalf("expected 167 bps, got %d", s.Points[0].Value)
	}
}

// R2: `gross_margin` solo tiene valor si hay costo.
func TestF21_2_GrossMargin(t *testing.T) {
	s, _ := Compute("gross_margin", rowsFixture())
	// Solo b1 tiene costo: 30000 - 13000 = 17000.
	if s.Points[0].Value != 17000 {
		t.Fatalf("expected 17000, got %d", s.Points[0].Value)
	}
	s2, _ := Compute("gross_margin", []SalesRow{{GrossMinor: 100}})
	if len(s2.Points) != 0 {
		t.Fatalf("expected empty series without cost, got %+v", s2.Points)
	}
}

// R2: `delivery_success_rate` en basis points.
func TestF21_2_DeliverySuccessRate(t *testing.T) {
	s, _ := Compute("delivery_success_rate", []SalesRow{{DeliveriesCompleted: 9, DeliveriesFailed: 1}})
	if s.Points[0].Value != 9000 {
		t.Fatalf("expected 9000 bps, got %d", s.Points[0].Value)
	}
}

// R2: `avg_delivery_time_minutes`.
func TestF21_2_AvgDeliveryTime(t *testing.T) {
	s, _ := Compute("avg_delivery_time_minutes", []SalesRow{{DeliveriesCompleted: 4, DeliveryMinutesSum: 200}})
	if s.Points[0].Value != 50 {
		t.Fatalf("expected 50, got %d", s.Points[0].Value)
	}
}

// R2: `payment_mix_by_rail` ordena los rieles de forma estable.
func TestF21_2_PaymentMixByRail(t *testing.T) {
	s, _ := Compute("payment_mix_by_rail", []SalesRow{{RailGrossMinor: map[string]int64{"card": 2000, "wallet": 3000}}})
	if len(s.Points) != 2 {
		t.Fatalf("expected 2 rails, got %d", len(s.Points))
	}
	if s.Points[0].Channel != "card" || s.Points[1].Channel != "wallet" {
		t.Fatalf("unexpected order %+v", s.Points)
	}
}

// Una serie vacía no inventa un cero.
func TestF21_2_EmptySeriesNoFakeZero(t *testing.T) {
	s, err := Compute("avg_ticket", nil)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if len(s.Points) != 0 {
		t.Fatalf("expected no points, got %+v", s.Points)
	}
}

// F21.3: granularidad día/semana/mes.
func TestF21_3_BucketizeWeeklyAndMonthly(t *testing.T) {
	pts := []Point{
		{Day: day(2026, 10, 1), Value: 10},
		{Day: day(2026, 10, 2), Value: 20},
		{Day: day(2026, 10, 20), Value: 70},
	}
	monthly := Bucketize(pts, Monthly)
	if len(monthly) != 1 || monthly[0].Value != 100 {
		t.Fatalf("expected one bucket of 100, got %+v", monthly)
	}
	weekly := Bucketize(pts, Weekly)
	total := int64(0)
	for _, w := range weekly {
		total += w.Value
	}
	if total != 100 {
		t.Fatalf("expected weekly total 100, got %d", total)
	}
}

func TestF21_3_BucketizeDaily(t *testing.T) {
	pts := []Point{{Day: day(2026, 10, 1), Value: 10}, {Day: day(2026, 10, 1), Value: 5}}
	daily := Bucketize(pts, Daily)
	if len(daily) != 1 || daily[0].Value != 15 {
		t.Fatalf("expected single day bucket of 15, got %+v", daily)
	}
}

// F21.3: dimensión no soportada → `METRIC_NOT_FOUND`.
func TestF21_3_UnsupportedDimension(t *testing.T) {
	c := NewCatalog()
	if err := c.SupportsDimension("orders_count", DimCategory); !errors.Is(err, ErrMetricNotFound) {
		t.Fatalf("expected rejection, got %v", err)
	}
	if err := c.SupportsDimension("orders_count", DimBranch); err != nil {
		t.Fatalf("expected branch supported, got %v", err)
	}
}

// F21.6 / R3: z-score robusto; |z| > 3.5 dispara.
func TestF21_6_RobustZFlagsOutlier(t *testing.T) {
	history := make([]DailyValue, 0, 28)
	for i := 0; i < 28; i++ {
		history = append(history, DailyValue{Day: day(2026, 9, 1).AddDate(0, 0, i), Value: 1000 + int64(i%3)*10})
	}
	anomalous, _ := IsAnomaly(history, 9000)
	if !anomalous {
		t.Fatal("expected anomaly for a far outlier")
	}
	normal, _ := IsAnomaly(history, 1010)
	if normal {
		t.Fatal("did not expect anomaly for a normal value")
	}
}

// R3: sin 28 días de historia no hay anomalía.
func TestF21_6_AnomalyNeeds28Days(t *testing.T) {
	history := []DailyValue{{Day: day(2026, 9, 1), Value: 100}, {Day: day(2026, 9, 2), Value: 100}}
	if anomalous, _ := IsAnomaly(history, 99999); anomalous {
		t.Fatal("expected no anomaly with insufficient history")
	}
}

// R3: una serie plana no divide por cero.
func TestF21_6_RobustZFlatSeries(t *testing.T) {
	history := make([]DailyValue, 28)
	for i := range history {
		history[i] = DailyValue{Day: day(2026, 9, 1).AddDate(0, 0, i), Value: 1000}
	}
	if anomalous, _ := IsAnomaly(history, 1000); anomalous {
		t.Fatal("flat series must not trigger")
	}
}

// R3: máximo una alerta por regla y día.
func TestF21_6_OneAlertPerRulePerDay(t *testing.T) {
	rule := AlertRule{ID: "r1", TenantID: "t1", Metric: "gross_sales", Op: "GT", Threshold: 1000, Active: true}
	today := day(2026, 10, 19)
	ev, ok := EvaluateAlert(rule, nil, today, 5000, nil)
	if !ok || ev == nil {
		t.Fatal("expected alert")
	}
	again, ok := EvaluateAlert(rule, nil, today, 6000, []AlertEvent{*ev})
	if ok || again != nil {
		t.Fatal("expected no second alert the same day")
	}
}

func TestF21_6_AlertRule_LT(t *testing.T) {
	rule := AlertRule{ID: "r2", TenantID: "t1", Metric: "refund_rate", Op: "LT", Threshold: 500, Active: true}
	if _, ok := EvaluateAlert(rule, nil, day(2026, 10, 19), 100, nil); !ok {
		t.Fatal("expected LT alert")
	}
	if _, ok := EvaluateAlert(rule, nil, day(2026, 10, 19), 900, nil); ok {
		t.Fatal("did not expect alert above threshold")
	}
}

func TestF21_6_InactiveRuleNeverFires(t *testing.T) {
	rule := AlertRule{ID: "r3", Metric: "gross_sales", Op: "GT", Threshold: 1, Active: false}
	if _, ok := EvaluateAlert(rule, nil, day(2026, 10, 19), 9999, nil); ok {
		t.Fatal("inactive rule must not fire")
	}
}

// F21.7 / R4: con menos de 56 días devuelve media móvil con el aviso.
func TestF21_7_InsufficientHistoryWarns(t *testing.T) {
	series := make([]DailyValue, 20)
	for i := range series {
		series[i] = DailyValue{Day: day(2026, 10, 1).AddDate(0, 0, i), Value: 1000}
	}
	f := HoltWinters(series, 7)
	if f.Method != "moving_average" {
		t.Fatalf("expected moving_average, got %s", f.Method)
	}
	if f.Warning == "" {
		t.Fatal("expected 'historia insuficiente' warning")
	}
	if len(f.Points) != 7 {
		t.Fatalf("expected 7 points, got %d", len(f.Points))
	}
}

// R4: con 56 días usa Holt-Winters aditivo y da un intervalo del 80 %.
func TestF21_7_HoltWintersWithEnoughHistory(t *testing.T) {
	series := make([]DailyValue, 70)
	for i := range series {
		// Serie con tendencia y estacionalidad semanal.
		series[i] = DailyValue{Day: day(2026, 7, 1).AddDate(0, 0, i), Value: int64(1000 + i*5 + (i%7)*100)}
	}
	f := HoltWinters(series, 14)
	if f.Method != "holt_winters" {
		t.Fatalf("expected holt_winters, got %s", f.Method)
	}
	if f.Warning != "" {
		t.Fatalf("expected no warning with enough history, got %q", f.Warning)
	}
	if len(f.Points) != 14 {
		t.Fatalf("expected 14 points, got %d", len(f.Points))
	}
	for i, p := range f.Points {
		if p.Upper80 < p.Lower80 {
			t.Fatalf("point %d: inverted interval %+v", i, p)
		}
		if p.Day.After(series[len(series)-1].Day) == false {
			t.Fatalf("point %d is not in the future: %v", i, p.Day)
		}
	}
}

func TestF21_7_EmptySeries(t *testing.T) {
	f := HoltWinters(nil, 7)
	if len(f.Points) != 0 || f.Warning == "" {
		t.Fatalf("unexpected forecast %+v", f)
	}
}

// F21.5 / R5: RFM con quintiles y segmentos nombrados.
func TestF21_5_RFMQuintiles(t *testing.T) {
	ref := day(2026, 10, 19)
	customers := []CustomerStats{
		{TenantID: "t1", CustomerUserID: "a", LastPurchase: day(2026, 10, 18), Orders: 20, RevenueMinor: 200000},
		{TenantID: "t1", CustomerUserID: "b", LastPurchase: day(2026, 10, 10), Orders: 10, RevenueMinor: 100000},
		{TenantID: "t1", CustomerUserID: "c", LastPurchase: day(2026, 1, 1), Orders: 1, RevenueMinor: 100},
	}
	got := ComputeRFM(customers, ref)
	if len(got) != 3 {
		t.Fatalf("expected 3 rfm, got %d", len(got))
	}
	// El cliente "a" es el mejor en recencia, frecuencia y monto.
	if got[0].RecencyQ < 4 || got[0].FrequencyQ < 4 {
		t.Fatalf("expected high quintiles for the best customer, got %+v", got[0])
	}
	if got[2].RecencyQ > 2 {
		t.Fatalf("expected low recency quintile for the dormant customer, got %+v", got[2])
	}
}

func TestF21_5_Segments(t *testing.T) {
	champion := RFM{RecencyQ: 5, FrequencyQ: 5, MonetaryQ: 5}
	if SegmentFor(champion, false) != "Campeones" {
		t.Fatalf("expected Campeones, got %s", SegmentFor(champion, false))
	}
	dormant := RFM{RecencyQ: 1, FrequencyQ: 1, MonetaryQ: 1}
	if SegmentFor(dormant, false) != "Dormidos" {
		t.Fatalf("expected Dormidos, got %s", SegmentFor(dormant, false))
	}
	atRisk := RFM{RecencyQ: 1, FrequencyQ: 4, MonetaryQ: 4}
	if SegmentFor(atRisk, false) != "En riesgo" {
		t.Fatalf("expected En riesgo, got %s", SegmentFor(atRisk, false))
	}
}

func TestF21_5_ComputeRFM_Empty(t *testing.T) {
	if got := ComputeRFM(nil, day(2026, 10, 19)); got != nil {
		t.Fatalf("expected nil, got %+v", got)
	}
}

// F21.5: ABC 80/15/5 por ingresos.
func TestF21_5_ClassifyABC(t *testing.T) {
	items := []ABCItem{
		{VariantID: "a", RevenueMinor: 8000},
		{VariantID: "b", RevenueMinor: 1500},
		{VariantID: "c", RevenueMinor: 500},
	}
	got := ClassifyABC(items)
	if got[0].Class != "A" || got[0].VariantID != "a" {
		t.Fatalf("expected a in class A, got %+v", got[0])
	}
	if got[1].Class != "B" {
		t.Fatalf("expected b in class B, got %+v", got[1])
	}
	if got[2].Class != "C" {
		t.Fatalf("expected c in class C, got %+v", got[2])
	}
}

func TestF21_5_ClassifyABC_ZeroRevenue(t *testing.T) {
	got := ClassifyABC([]ABCItem{{VariantID: "a"}, {VariantID: "b"}})
	for _, g := range got {
		if g.Class != "D" {
			t.Fatalf("expected class D with no revenue, got %+v", g)
		}
	}
}

func TestF21_5_ClassifyABC_Empty(t *testing.T) {
	if got := ClassifyABC(nil); got != nil {
		t.Fatal("expected nil")
	}
}

// F21.8 / R6: la pregunta se traduce a una métrica del catálogo y muestra su lectura.
func TestF21_8_AskQuestion_GrossSales(t *testing.T) {
	p := &Parser{Catalog: NewCatalog(), Reference: day(2026, 10, 19)}
	a, err := p.AskQuestion("¿cuánto vendí en octubre?", rowsFixture())
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if a.Interpretation.Metric != "gross_sales" {
		t.Fatalf("expected gross_sales, got %s", a.Interpretation.Metric)
	}
	if a.Value != 60000 {
		t.Fatalf("expected 60000, got %d", a.Value)
	}
}

// R6: la interpretación acompaña siempre a la cifra.
func TestF21_8_AskQuestion_ShowsInterpretation(t *testing.T) {
	p := &Parser{Catalog: NewCatalog(), Reference: day(2026, 10, 19)}
	a, _ := p.AskQuestion("¿cuántos pedidos hubo en octubre?", rowsFixture())
	if a.Interpretation.Metric != "orders_count" {
		t.Fatalf("expected orders_count, got %s", a.Interpretation.Metric)
	}
	if a.Interpretation.Granularity != Daily {
		t.Fatalf("expected daily granularity, got %s", a.Interpretation.Granularity)
	}
	if a.Interpretation.To.Sub(a.Interpretation.From) <= 0 {
		t.Fatal("expected a valid range")
	}
}

// R6: una pregunta sin métrica reconocible devuelve `QUESTION_NOT_UNDERSTOOD`.
func TestF21_8_UnparseableQuestion(t *testing.T) {
	p := &Parser{Catalog: NewCatalog(), Reference: day(2026, 10, 19)}
	if _, err := p.AskQuestion("¿qué pasa con el clima?", rowsFixture()); !errors.Is(err, ErrQuestionNotUnderstood) {
		t.Fatalf("expected ErrQuestionNotUnderstood, got %v", err)
	}
}

// R6: nunca SQL libre — un intento de inyectar SQL se rechaza.
func TestF21_8_NoFreeSQL(t *testing.T) {
	if !ContainsSQL("SELECT * FROM analytics.daily_sales") {
		t.Fatal("expected SQL detection")
	}
	if ContainsSQL("¿cuánto vendí en octubre?") {
		t.Fatal("legit question flagged as SQL")
	}
	p := &Parser{Catalog: NewCatalog(), Reference: day(2026, 10, 19)}
	if _, err := p.Parse("drop table ventas; ¿cuánto vendí?"); err == nil {
		t.Fatal("expected rejection")
	}
}

// R6: filtro por sucursal aplicado a la interpretación.
func TestF21_8_BranchFilter(t *testing.T) {
	p := &Parser{Catalog: NewCatalog(), Reference: day(2026, 10, 19)}
	a, err := p.AskQuestion("ventas brutas en la sucursal b1 en octubre", rowsFixture())
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if a.Interpretation.Dimension != DimBranch {
		t.Fatalf("expected branch dimension, got %s", a.Interpretation.Dimension)
	}
	if a.Value != 30000 {
		t.Fatalf("expected 30000 for b1, got %d", a.Value)
	}
}

// Rango con día de inicio y fin explícitos.
func TestF21_8_ExplicitRange(t *testing.T) {
	p := &Parser{Catalog: NewCatalog(), Reference: day(2026, 10, 19)}
	interp, err := p.Parse("de 1 a 2 de octubre cuánto vendimos")
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if interp.Metric != "gross_sales" {
		t.Fatalf("expected gross_sales, got %s", interp.Metric)
	}
	if interp.From.Day() != 1 || interp.To.Day() != 2 {
		t.Fatalf("unexpected range %s..%s", interp.From, interp.To)
	}
}

// Rango ISO explícito.
func TestF21_8_ISONange(t *testing.T) {
	p := &Parser{Catalog: NewCatalog(), Reference: day(2026, 10, 19)}
	interp, err := p.Parse("de 2026-10-01 a 2026-10-02 cuántos pedidos")
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if interp.Metric != "orders_count" {
		t.Fatalf("expected orders_count, got %s", interp.Metric)
	}
	if interp.From.Format("2006-01-02") != "2026-10-01" {
		t.Fatalf("unexpected from %s", interp.From)
	}
}

// F21.9: CSV con cabecera estable y valores enteros.
func TestF21_9_BuildCSV(t *testing.T) {
	rows := RowsFromSeries("gross_sales", Series{Points: []Point{
		{Day: day(2026, 10, 2), Value: 20},
		{Day: day(2026, 10, 1), Value: 10, BranchID: "b1", Channel: "pos"},
	}})
	b, err := BuildCSV(rows)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(b)), "\n")
	if len(lines) != 3 {
		t.Fatalf("expected header + 2 rows, got %d", len(lines))
	}
	if lines[0] != "day,branch_id,channel,metric,value" {
		t.Fatalf("unexpected header %q", lines[0])
	}
	// Ordenado por día.
	if !strings.HasPrefix(lines[1], "2026-10-01") {
		t.Fatalf("expected rows sorted by day, got %q", lines[1])
	}
	if !strings.HasSuffix(lines[1], ",10") {
		t.Fatalf("expected integer value, got %q", lines[1])
	}
}

// F21.9: XLSX es un XML válido con las mismas columnas.
func TestF21_9_BuildXLSX(t *testing.T) {
	rows := RowsFromSeries("gross_sales", Series{Points: []Point{{Day: day(2026, 10, 1), Value: 10, BranchID: "b1"}}})
	b, err := BuildXLSX(rows)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	s := string(b)
	if !strings.HasPrefix(s, "<?xml version=\"1.0\"?>") {
		t.Fatalf("unexpected header %q", s[:20])
	}
	if !strings.Contains(s, "gross_sales") || !strings.Contains(s, "2026-10-01") {
		t.Fatal("missing data in the sheet")
	}
	if !strings.Contains(s, "<Workbook") || !strings.Contains(s, "</Workbook>") {
		t.Fatal("malformed workbook")
	}
}

func TestF21_9_BuildUnknownKind(t *testing.T) {
	if _, err := Build("PDF", nil); !errors.Is(err, ErrExportKindUnknown) {
		t.Fatalf("expected ErrExportKindUnknown, got %v", err)
	}
}

// F21.9: el enlace vive 24 h.
func TestF21_9_ExportLinkExpires(t *testing.T) {
	now := day(2026, 10, 19)
	exp := now.Add(24 * time.Hour)
	e := Export{ID: "e1", Kind: "CSV", Status: "READY", ObjectKey: "exports/e1.csv", ExpiresAt: &exp}
	if link, err := LinkFor(e, now); err != nil || link == "" {
		t.Fatalf("expected link, got %q err=%v", link, err)
	}
	if _, err := LinkFor(e, now.Add(25*time.Hour)); !errors.Is(err, ErrExportNotReady) {
		t.Fatalf("expected expired link, got %v", err)
	}
	pending := Export{ID: "e2", Kind: "CSV", Status: "PENDING"}
	if _, err := LinkFor(pending, now); !errors.Is(err, ErrExportNotReady) {
		t.Fatalf("expected not ready, got %v", err)
	}
}

// F21.4: un dashboard solo puede apuntar a métricas del catálogo (R6).
func TestF21_4_ValidateDashboard_RejectsUnknownMetric(t *testing.T) {
	c := NewCatalog()
	d := Dashboard{Name: "Inicio", Widgets: []Widget{{Metric: "SELECT 1", Granularity: "day"}}}
	if err := ValidateDashboard(c, d); !errors.Is(err, ErrMetricNotFound) {
		t.Fatalf("expected ErrMetricNotFound, got %v", err)
	}
}

func TestF21_4_ValidateDashboard_OK(t *testing.T) {
	c := NewCatalog()
	d := Dashboard{Name: "Inicio", Widgets: []Widget{
		{Metric: "gross_sales", Granularity: "day"},
		{Metric: "orders_count", Granularity: "week", Dimension: "branch"},
	}}
	if err := ValidateDashboard(c, d); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestF21_4_ValidateDashboard_RejectsBadGranularity(t *testing.T) {
	c := NewCatalog()
	d := Dashboard{Name: "Inicio", Widgets: []Widget{{Metric: "gross_sales", Granularity: "hour"}}}
	if err := ValidateDashboard(c, d); err == nil {
		t.Fatal("expected rejection of unsupported granularity")
	}
}

func TestF21_4_WidgetsRoundTrip(t *testing.T) {
	widgets := []Widget{{Metric: "gross_sales", Granularity: "month", Title: "Ventas del mes"}}
	b, err := WidgetsJSON(widgets)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	back, err := ParseWidgets(b)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if len(back) != 1 || back[0].Metric != "gross_sales" {
		t.Fatalf("unexpected round trip %+v", back)
	}
}

func TestF21_4_ParseWidgetsInvalidJSON(t *testing.T) {
	if _, err := ParseWidgets([]byte("{not json")); err == nil {
		t.Fatal("expected error")
	}
}

// La interpretación serializa sin perder la métrica (se muestra en la respuesta).
func TestF21_8_InterpretationJSON(t *testing.T) {
	p := &Parser{Catalog: NewCatalog(), Reference: day(2026, 10, 19)}
	interp, _ := p.Parse("cuánto vendimos en octubre")
	b, err := json.Marshal(interp)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if !strings.Contains(string(b), `"metric":"gross_sales"`) {
		t.Fatalf("unexpected json %s", b)
	}
}
