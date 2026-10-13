package observability

import (
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
)

// durationBuckets son los buckets de los histogramas de duración: 5 ms … 10 s
// (observability-standards.md §2.1). El último es +Inf.
var durationBuckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

// reservedLabels son etiquetas prohibidas por §2.3 (cardinalidad y datos personales).
// Se rechazan en tiempo de ejecución: una métrica con user_id o tenant_id es un defecto.
var reservedLabels = map[string]bool{
	"user_id": true, "tenant_id": true, "payment_id": true, "request_id": true,
	"email": true, "amount": true, "amount_minor": true, "document": true,
	"trace_id": true, "span_id": true, "ip": true, "ip_address": true,
}

// Metrics es el registro de contadores, histogramas y medidores expuesto en `/metrics`
// con el formato de texto de Prometheus (§2).
type Metrics struct {
	service, version, commit string
	mu                       sync.Mutex
	counters                 map[string]float64
	histograms               map[string]*histogram
	gauges                   map[string]float64
}

type histogram struct {
	buckets []float64 // límites superiores; el último elemento es +Inf (implícito)
	counts  []uint64
	sum     float64
	count   uint64
}

// NewMetrics crea el registro del servicio. `commit` es el sha del build (ldflags).
func NewMetrics(service, version, commit string) *Metrics {
	m := &Metrics{
		service: service, version: version, commit: commit,
		counters:   map[string]float64{},
		histograms: map[string]*histogram{},
		gauges:     map[string]float64{},
	}
	m.counters[seriesKey("pp_panics_total", []string{"service", service})] = 0
	return m
}

func seriesKey(name string, labels []string) string {
	pairs := make([]string, 0, len(labels)/2)
	for i := 0; i+1 < len(labels); i += 2 {
		pairs = append(pairs, fmt.Sprintf("%s=%q", labels[i], labels[i+1]))
	}
	return name + "{" + strings.Join(pairs, ",") + "}"
}

// validLabels rechaza etiquetas prohibidas (§2.3). Devuelve false si alguna está en la lista.
func validLabels(labels []string) bool {
	for i := 0; i+1 < len(labels); i += 2 {
		if reservedLabels[labels[i]] {
			return false
		}
	}
	return true
}

func (m *Metrics) withService(labels []string) []string {
	return append([]string{"service", m.service}, labels...)
}

// Inc suma 1 a un contador. `labels` va en pares nombre, valor.
func (m *Metrics) Inc(name string, labels ...string) {
	if m == nil {
		return
	}
	labels = m.withService(labels)
	if !validLabels(labels) {
		return
	}
	m.mu.Lock()
	m.counters[seriesKey(name, labels)]++
	m.mu.Unlock()
}

// Add suma `delta` a un contador (para totales que no son unitarios).
func (m *Metrics) Add(name string, delta float64, labels ...string) {
	if m == nil {
		return
	}
	labels = m.withService(labels)
	if !validLabels(labels) {
		return
	}
	m.mu.Lock()
	m.counters[seriesKey(name, labels)] += delta
	m.mu.Unlock()
}

// Observe registra una duración en segundos en el histograma `name` (§2.1).
func (m *Metrics) Observe(name string, seconds float64, labels ...string) {
	if m == nil {
		return
	}
	labels = m.withService(labels)
	if !validLabels(labels) {
		return
	}
	key := seriesKey(name, labels)
	m.mu.Lock()
	h, ok := m.histograms[key]
	if !ok {
		h = &histogram{buckets: durationBuckets, counts: make([]uint64, len(durationBuckets)+1)}
		m.histograms[key] = h
	}
	for i, le := range h.buckets {
		if seconds <= le {
			h.counts[i]++
			break
		}
	}
	h.counts[len(h.buckets)]++ // +Inf
	h.sum += seconds
	h.count++
	m.mu.Unlock()
}

// Set fija el valor de un medidor (§2.1: lag, pendientes, conexiones abiertas).
func (m *Metrics) Set(name string, value float64, labels ...string) {
	if m == nil {
		return
	}
	labels = m.withService(labels)
	if !validLabels(labels) {
		return
	}
	m.mu.Lock()
	m.gauges[seriesKey(name, labels)] = value
	m.mu.Unlock()
}

// Value devuelve el valor de un contador o medidor (para pruebas).
func (m *Metrics) Value(name string, labels ...string) float64 {
	if m == nil {
		return 0
	}
	labels = m.withService(labels)
	m.mu.Lock()
	defer m.mu.Unlock()
	if v, ok := m.counters[seriesKey(name, labels)]; ok {
		return v
	}
	return m.gauges[seriesKey(name, labels)]
}

// HistogramCount devuelve el número de observaciones de un histograma (para pruebas).
func (m *Metrics) HistogramCount(name string, labels ...string) uint64 {
	if m == nil {
		return 0
	}
	labels = m.withService(labels)
	m.mu.Lock()
	defer m.mu.Unlock()
	if h, ok := m.histograms[seriesKey(name, labels)]; ok {
		return h.count
	}
	return 0
}

// HistogramBucket devuelve el acumulado hasta el bucket de límite `le` (pruebas); es el valor
// que expone Prometheus en `<metrica>_bucket{le="..."}`.
func (m *Metrics) HistogramBucket(name string, le float64, labels ...string) uint64 {
	if m == nil {
		return 0
	}
	labels = m.withService(labels)
	m.mu.Lock()
	defer m.mu.Unlock()
	h, ok := m.histograms[seriesKey(name, labels)]
	if !ok {
		return 0
	}
	cumulative := uint64(0)
	for i, b := range h.buckets {
		cumulative += h.counts[i]
		if b == le {
			return cumulative
		}
	}
	return 0
}

// WritePrometheus escribe todas las series en formato de texto de Prometheus.
func (m *Metrics) WritePrometheus(w io.Writer) {
	m.mu.Lock()
	defer m.mu.Unlock()

	fmt.Fprintf(w, "pp_build_info{service=%q,version=%q,commit=%q} 1\n", m.service, m.version, m.commit)

	counters := make([]string, 0, len(m.counters))
	for k := range m.counters {
		counters = append(counters, k)
	}
	sort.Strings(counters)
	for _, k := range counters {
		fmt.Fprintf(w, "%s %g\n", k, m.counters[k])
	}

	gauges := make([]string, 0, len(m.gauges))
	for k := range m.gauges {
		gauges = append(gauges, k)
	}
	sort.Strings(gauges)
	for _, k := range gauges {
		fmt.Fprintf(w, "%s %g\n", k, m.gauges[k])
	}

	hists := make([]string, 0, len(m.histograms))
	for k := range m.histograms {
		hists = append(hists, k)
	}
	sort.Strings(hists)
	for _, k := range hists {
		h := m.histograms[k]
		// La clave es `nombre{etiquetas}`; hay que separarlas para añadir `le` y los sufijos.
		open := strings.IndexByte(k, '{')
		name := k[:open]
		labels := k[open+1 : len(k)-1]
		sep := ""
		if labels != "" {
			sep = ","
		}
		cumulative := uint64(0)
		for i, le := range h.buckets {
			cumulative += h.counts[i]
			fmt.Fprintf(w, "%s_bucket{%s%sle=%q} %d\n", name, labels, sep, fmt.Sprintf("%g", le), cumulative)
		}
		fmt.Fprintf(w, "%s_bucket{%s%sle=\"+Inf\"} %d\n", name, labels, sep, h.counts[len(h.buckets)])
		fmt.Fprintf(w, "%s_sum{%s} %g\n", name, labels, h.sum)
		fmt.Fprintf(w, "%s_count{%s} %d\n", name, labels, h.count)
	}
}
