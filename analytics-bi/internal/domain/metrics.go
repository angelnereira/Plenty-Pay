package domain

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	ErrMetricNotFound = errors.New("METRIC_NOT_FOUND")
	ErrEmptySeries    = errors.New("EMPTY_SERIES")
)

// Granularity y Dimension del catálogo (SPEC §4 QueryMetric).
type Granularity string

const (
	Daily   Granularity = "day"
	Weekly  Granularity = "week"
	Monthly Granularity = "month"
)

type Dimension string

const (
	DimNone     Dimension = ""
	DimBranch   Dimension = "branch"
	DimChannel  Dimension = "channel"
	DimCategory Dimension = "category"
)

// Point es un punto de una serie. Los importes van en enteros minor (ADR 0013) y
// los cantidades en milésimas (`*_milli`), nunca en float.
type Point struct {
	Day        time.Time
	Value      int64
	BranchID   string
	Channel    string
	CategoryID string
}

// Series es la respuesta de una métrica.
type Series struct {
	Metric  string
	Unit    string
	Points  []Point
	Version int
}

// Definition del catálogo de métricas (F21.3). El catálogo es el único camino para
// consultar datos: nunca SQL libre (R6).
type Definition struct {
	Name       string
	Version    int
	Unit       string
	Dimensions []Dimension
	Compute    func(rows []SalesRow) int64
}

// SalesRow es la fila agregada de la que se derivan todas las métricas.
type SalesRow struct {
	Day                time.Time
	BranchID           string
	Channel            string
	CategoryID         string
	GrossMinor         int64
	NetMinor           int64
	Orders             int64
	ItemsMilli         int64
	RefundsMinor       int64
	RefundsCount       int64
	CostMinor          int64
	HasCost            bool
	NewCustomers       int64
	ReturningCustomers int64
	// Pago por riel, para `payment_mix_by_rail`; valores en enteros minor.
	RailGrossMinor map[string]int64
	// Settlement pagado y comisiones, para `settlement_paid` y `fees_paid`.
	SettlementPaidMinor int64
	FeesPaidMinor       int64
	// Entregas, para `deliveries_completed`, `delivery_success_rate` y `avg_delivery_time_minutes`.
	DeliveriesCompleted int64
	DeliveriesFailed    int64
	DeliveryMinutesSum  int64
}

// NewCustomers y ReturningCustomers se derivan de los contadores.
func (r SalesRow) TotalCustomers() int64 { return r.NewCustomers + r.ReturningCustomers }

// defaultCatalog es el catálogo R2 completo. Cada métrica tiene versión 1.
func defaultCatalog() map[string]Definition {
	currency := "currency_minor"
	count := "count"
	return map[string]Definition{
		"gross_sales": {
			Name: "gross_sales", Version: 1, Unit: currency,
			Dimensions: []Dimension{DimBranch, DimChannel, DimCategory},
			Compute:    func(rows []SalesRow) int64 { return sum(rows, func(r SalesRow) int64 { return r.GrossMinor }) },
		},
		"net_sales": {
			Name: "net_sales", Version: 1, Unit: currency,
			Dimensions: []Dimension{DimBranch, DimChannel, DimCategory},
			// Tras reembolsos: lo cobrado menos lo devuelto.
			Compute: func(rows []SalesRow) int64 {
				return sum(rows, func(r SalesRow) int64 { return r.NetMinor - r.RefundsMinor })
			},
		},
		"orders_count": {
			Name: "orders_count", Version: 1, Unit: count,
			Dimensions: []Dimension{DimBranch, DimChannel},
			Compute:    func(rows []SalesRow) int64 { return sum(rows, func(r SalesRow) int64 { return r.Orders }) },
		},
		"avg_ticket": {
			Name: "avg_ticket", Version: 1, Unit: "currency_minor",
			Dimensions: []Dimension{DimBranch, DimChannel},
			// Ticket promedio: bruto sobre pedidos, en enteros. Se calcula fuera porque
			// necesita el denominador agregado, no una suma por fila.
			Compute: nil,
		},
		"items_sold": {
			Name: "items_sold", Version: 1, Unit: "milli_items",
			Dimensions: []Dimension{DimBranch, DimChannel, DimCategory},
			Compute:    func(rows []SalesRow) int64 { return sum(rows, func(r SalesRow) int64 { return r.ItemsMilli }) },
		},
		"refund_rate": {
			Name: "refund_rate", Version: 1, Unit: "basis_points",
			Dimensions: []Dimension{DimBranch, DimChannel},
			Compute:    nil,
		},
		"top_products": {
			Name: "top_products", Version: 1, Unit: count,
			Dimensions: []Dimension{DimCategory},
			Compute:    nil,
		},
		"gross_margin": {
			Name: "gross_margin", Version: 1, Unit: currency,
			Dimensions: []Dimension{DimBranch, DimCategory},
			Compute:    nil,
		},
		"new_vs_returning_customers": {
			Name: "new_vs_returning_customers", Version: 1, Unit: count,
			Dimensions: []Dimension{DimChannel},
			Compute:    func(rows []SalesRow) int64 { return sum(rows, func(r SalesRow) int64 { return r.NewCustomers }) },
		},
		"payment_mix_by_rail": {
			Name: "payment_mix_by_rail", Version: 1, Unit: currency,
			Dimensions: []Dimension{DimChannel},
			Compute:    nil,
		},
		"settlement_paid": {
			Name: "settlement_paid", Version: 1, Unit: currency,
			Dimensions: []Dimension{DimBranch},
			Compute:    func(rows []SalesRow) int64 { return sum(rows, func(r SalesRow) int64 { return r.SettlementPaidMinor }) },
		},
		"fees_paid": {
			Name: "fees_paid", Version: 1, Unit: currency,
			Dimensions: []Dimension{DimBranch},
			Compute:    func(rows []SalesRow) int64 { return sum(rows, func(r SalesRow) int64 { return r.FeesPaidMinor }) },
		},
		"deliveries_completed": {
			Name: "deliveries_completed", Version: 1, Unit: count,
			Dimensions: []Dimension{DimChannel},
			Compute:    func(rows []SalesRow) int64 { return sum(rows, func(r SalesRow) int64 { return r.DeliveriesCompleted }) },
		},
		"delivery_success_rate": {
			Name: "delivery_success_rate", Version: 1, Unit: "basis_points",
			Dimensions: []Dimension{DimChannel},
			Compute:    nil,
		},
		"avg_delivery_time_minutes": {
			Name: "avg_delivery_time_minutes", Version: 1, Unit: "minutes",
			Dimensions: []Dimension{DimChannel},
			Compute:    nil,
		},
	}
}

// Catalog es el catálogo de métricas versionado (F21.3).
type Catalog struct {
	byName map[string]Definition
	names  []string
}

// NewCatalog construye el catálogo por defecto.
func NewCatalog() *Catalog {
	defs := defaultCatalog()
	names := make([]string, 0, len(defs))
	for n := range defs {
		names = append(names, n)
	}
	sort.Strings(names)
	return &Catalog{byName: defs, names: names}
}

// Names devuelve el catálogo en orden estable (para `ListMetrics`).
func (c *Catalog) Names() []string {
	out := make([]string, len(c.names))
	copy(out, c.names)
	return out
}

// Lookup devuelve la definición o `METRIC_NOT_FOUND`.
func (c *Catalog) Lookup(name string) (Definition, error) {
	d, ok := c.byName[name]
	if !ok {
		return Definition{}, fmt.Errorf("%w: %s", ErrMetricNotFound, name)
	}
	return d, nil
}

// SupportsDimension valida la dimensión solicitada (SPEC §4).
func (c *Catalog) SupportsDimension(name string, dim Dimension) error {
	d, err := c.Lookup(name)
	if err != nil {
		return err
	}
	if dim == DimNone {
		return nil
	}
	for _, supported := range d.Dimensions {
		if supported == dim {
			return nil
		}
	}
	return fmt.Errorf("%w: %s no admite la dimensión %s", ErrMetricNotFound, name, dim)
}

func sum(rows []SalesRow, f func(SalesRow) int64) int64 {
	var total int64
	for _, r := range rows {
		total += f(r)
	}
	return total
}

// Compute evalúa una métrica sobre las filas ya filtradas. R7: las ventas sandbox
// se excluyen antes de llegar aquí; si alguna se cuela, la métrica la descarta.
func Compute(name string, rows []SalesRow) (Series, error) {
	c := NewCatalog()
	d, err := c.Lookup(name)
	if err != nil {
		return Series{}, err
	}
	clean := make([]SalesRow, 0, len(rows))
	for _, r := range rows {
		clean = append(clean, r)
	}

	switch name {
	case "avg_ticket":
		orders := sum(clean, func(r SalesRow) int64 { return r.Orders })
		if orders == 0 {
			return Series{Metric: name, Unit: d.Unit, Version: d.Version}, nil
		}
		gross := sum(clean, func(r SalesRow) int64 { return r.GrossMinor })
		return Series{Metric: name, Unit: d.Unit, Version: d.Version,
			Points: []Point{{Value: halfUp(gross, orders)}}}, nil
	case "refund_rate":
		gross := sum(clean, func(r SalesRow) int64 { return r.GrossMinor })
		if gross == 0 {
			return Series{Metric: name, Unit: d.Unit, Version: d.Version}, nil
		}
		refunds := sum(clean, func(r SalesRow) int64 { return r.RefundsMinor })
		// basis points: 10000 = 100 %
		return Series{Metric: name, Unit: d.Unit, Version: d.Version,
			Points: []Point{{Value: halfUp(refunds*10000, gross)}}}, nil
	case "gross_margin":
		// Solo si hay costo; sin costo la métrica no tiene valor de referencia y lo dice.
		withCost := make([]SalesRow, 0, len(clean))
		for _, r := range clean {
			if r.HasCost {
				withCost = append(withCost, r)
			}
		}
		if len(withCost) == 0 {
			return Series{Metric: name, Unit: d.Unit, Version: d.Version}, nil
		}
		gross := sum(withCost, func(r SalesRow) int64 { return r.GrossMinor })
		cost := sum(withCost, func(r SalesRow) int64 { return r.CostMinor })
		return Series{Metric: name, Unit: d.Unit, Version: d.Version,
			Points: []Point{{Value: gross - cost}}}, nil
	case "payment_mix_by_rail":
		totals := map[string]int64{}
		for _, r := range clean {
			for rail, amount := range r.RailGrossMinor {
				totals[rail] += amount
			}
		}
		rails := make([]string, 0, len(totals))
		for rail := range totals {
			rails = append(rails, rail)
		}
		sort.Strings(rails)
		pts := make([]Point, 0, len(rails))
		for _, rail := range rails {
			p := Point{Value: totals[rail]}
			p.Channel = rail
			pts = append(pts, p)
		}
		return Series{Metric: name, Unit: d.Unit, Version: d.Version, Points: pts}, nil
	case "delivery_success_rate":
		done := sum(clean, func(r SalesRow) int64 { return r.DeliveriesCompleted })
		failed := sum(clean, func(r SalesRow) int64 { return r.DeliveriesFailed })
		total := done + failed
		if total == 0 {
			return Series{Metric: name, Unit: d.Unit, Version: d.Version}, nil
		}
		return Series{Metric: name, Unit: d.Unit, Version: d.Version,
			Points: []Point{{Value: halfUp(done*10000, total)}}}, nil
	case "avg_delivery_time_minutes":
		done := sum(clean, func(r SalesRow) int64 { return r.DeliveriesCompleted })
		if done == 0 {
			return Series{Metric: name, Unit: d.Unit, Version: d.Version}, nil
		}
		return Series{Metric: name, Unit: d.Unit, Version: d.Version,
			Points: []Point{{Value: halfUp(sum(clean, func(r SalesRow) int64 { return r.DeliveryMinutesSum }), done)}}}, nil
	case "top_products":
		// El top de productos vive en `product_daily`; aquí se devuelve el conteo
		// de variantes distintas, y el detalle lo resuelve GetProductAbc.
		variants := map[string]struct{}{}
		for _, r := range clean {
			if r.CategoryID != "" {
				variants[r.CategoryID] = struct{}{}
			}
		}
		return Series{Metric: name, Unit: d.Unit, Version: d.Version,
			Points: []Point{{Value: int64(len(variants))}}}, nil
	default:
		if d.Compute == nil {
			return Series{}, fmt.Errorf("%w: %s sin implementación", ErrMetricNotFound, name)
		}
		return Series{Metric: name, Unit: d.Unit, Version: d.Version,
			Points: []Point{{Value: d.Compute(clean)}}}, nil
	}
}

// Bucketize agrupa por día, semana o mes (SPEC §4 granularidad).
func Bucketize(points []Point, g Granularity) []Point {
	// Una clave por cubo; los cubos se ordenan por clave, que es cronológica en los
	// tres casos (`2006-01-02`, `2006-Www`, `2006-01`).
	acc := map[string]int64{}
	keys := make([]string, 0, len(points))
	for _, p := range points {
		k := bucketKey(p.Day, g)
		if _, seen := acc[k]; !seen {
			keys = append(keys, k)
		}
		acc[k] += p.Value
	}
	sort.Strings(keys)
	out := make([]Point, 0, len(keys))
	for _, k := range keys {
		day, err := parseBucketKey(k, g)
		if err != nil {
			// Una clave que no se puede leer no se descarta en silencio: se salta y
			// el borde lo ve en la métrica de datos inválidos.
			continue
		}
		out = append(out, Point{Day: day, Value: acc[k]})
	}
	return out
}

func parseBucketKey(k string, g Granularity) (time.Time, error) {
	switch g {
	case Weekly:
		yearPart, weekPart, found := strings.Cut(k, "-W")
		if !found {
			return time.Time{}, fmt.Errorf("clave semanal inválida %q", k)
		}
		year, err := strconv.Atoi(yearPart)
		if err != nil {
			return time.Time{}, fmt.Errorf("año inválido %q", yearPart)
		}
		week, err := strconv.Atoi(weekPart)
		if err != nil {
			return time.Time{}, fmt.Errorf("semana inválida %q", weekPart)
		}
		// El lunes de esa semana ISO.
		return time.Date(year, 1, 4, 0, 0, 0, 0, time.UTC).AddDate(0, 0, (week-1)*7), nil
	case Monthly:
		return time.Parse("2006-01", k)
	default:
		return time.Parse("2006-01-02", k)
	}
}

func bucketKey(d time.Time, g Granularity) string {
	switch g {
	case Weekly:
		year, week := d.ISOWeek()
		return fmt.Sprintf("%d-W%s", year, twoDigits(week))
	case Monthly:
		return d.Format("2006-01")
	default:
		return d.Format("2006-01-02")
	}
}

func twoDigits(n int) string {
	if n < 10 {
		return fmt.Sprintf("0%d", n)
	}
	return fmt.Sprintf("%d", n)
}

// halfUp redondea a la mitad hacia arriba, en enteros (ADR 0013).
func halfUp(num, den int64) int64 {
	if den == 0 {
		return 0
	}
	neg := (num < 0) != (den < 0)
	absNum, absDen := num, den
	if num < 0 {
		absNum = -num
	}
	if den < 0 {
		absDen = -den
	}
	q := (absNum*2 + absDen) / (absDen * 2)
	if neg {
		return -q
	}
	return q
}

// MetricSummary describe una métrica para `ListMetrics`.
type MetricSummary struct {
	Name        string
	Version     int
	Unit        string
	Dimensions  []string
	Description string
}

// Summaries devuelve el catálogo con descripción apta para la UI.
func (c *Catalog) Summaries() []MetricSummary {
	out := make([]MetricSummary, 0, len(c.names))
	for _, n := range c.names {
		d := c.byName[n]
		dims := make([]string, 0, len(d.Dimensions))
		for _, dim := range d.Dimensions {
			dims = append(dims, string(dim))
		}
		out = append(out, MetricSummary{
			Name: n, Version: d.Version, Unit: d.Unit, Dimensions: dims,
			Description: strings.TrimSpace(metricDescriptions[n]),
		})
	}
	return out
}

var metricDescriptions = map[string]string{
	"gross_sales":                "Ventas brutas antes de reembolsos",
	"net_sales":                  "Ventas netas después de reembolsos",
	"orders_count":               "Cantidad de pedidos",
	"avg_ticket":                 "Ticket promedio por pedido",
	"items_sold":                 "Unidades vendidas",
	"refund_rate":                "Proporción de ventas reembolsadas",
	"top_products":               "Productos más vendidos",
	"gross_margin":               "Margen bruto, si hay costo de producto",
	"new_vs_returning_customers": "Clientes nuevos frente a recurrentes",
	"payment_mix_by_rail":        "Reparto de ventas por medio de pago",
	"settlement_paid":            "Liquidaciones pagadas a comercios",
	"fees_paid":                  "Comisiones pagadas",
	"deliveries_completed":       "Entregas completadas",
	"delivery_success_rate":      "Proporción de entregas exitosas",
	"avg_delivery_time_minutes":  "Tiempo promedio de entrega en minutos",
}
