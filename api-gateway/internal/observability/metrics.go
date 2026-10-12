package observability

import (
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
)

// Metrics es un registro mínimo de contadores expuesto en `/metrics` con el formato de texto de
// Prometheus. Cubre los contadores de errores y de peticiones; los histogramas y el resto de
// métricas obligatorias llegan con el cliente completo cuando exista el colector (F04.1).
type Metrics struct {
	service, version string
	mu               sync.Mutex
	counters         map[string]float64
}

func NewMetrics(service, version string) *Metrics {
	m := &Metrics{service: service, version: version, counters: map[string]float64{}}
	m.counters[seriesKey("pp_panics_total", []string{"service", service})] = 0
	return m
}

func seriesKey(name string, labels []string) string {
	pairs := []string{}
	for i := 0; i+1 < len(labels); i += 2 {
		pairs = append(pairs, fmt.Sprintf("%s=%q", labels[i], labels[i+1]))
	}
	return name + "{" + strings.Join(pairs, ",") + "}"
}

// Inc suma 1 a un contador. `labels` va en pares nombre, valor. Nunca ids ni datos de usuario (§2.3).
func (m *Metrics) Inc(name string, labels ...string) {
	if m == nil {
		return
	}
	labels = append([]string{"service", m.service}, labels...)
	m.mu.Lock()
	m.counters[seriesKey(name, labels)]++
	m.mu.Unlock()
}

// Value devuelve el valor de una serie (para pruebas).
func (m *Metrics) Value(name string, labels ...string) float64 {
	labels = append([]string{"service", m.service}, labels...)
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.counters[seriesKey(name, labels)]
}

func (m *Metrics) WritePrometheus(w io.Writer) {
	m.mu.Lock()
	keys := make([]string, 0, len(m.counters))
	for k := range m.counters {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	fmt.Fprintf(w, "pp_build_info{service=%q,version=%q} 1\n", m.service, m.version)
	for _, k := range keys {
		fmt.Fprintf(w, "%s %g\n", k, m.counters[k])
	}
	m.mu.Unlock()
}
