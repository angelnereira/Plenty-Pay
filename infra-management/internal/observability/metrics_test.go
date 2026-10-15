package observability

import (
	"strings"
	"testing"
)

// §2.1: los histogramas de duración se exponen con sus buckets, `_sum` y `_count`.
func TestObs_HistogramExposition(t *testing.T) {
	m := NewMetrics("identity", "1.0.0", "sha")
	m.Observe("pp_rpc_server_duration_seconds", 0.02, "rpc", "/plentypay.identity.v1.Identity/Login")
	m.Observe("pp_rpc_server_duration_seconds", 0.4, "rpc", "/plentypay.identity.v1.Identity/Login")
	m.Observe("pp_rpc_server_duration_seconds", 3, "rpc", "/plentypay.identity.v1.Identity/Login")

	if got := m.HistogramCount("pp_rpc_server_duration_seconds", "rpc", "/plentypay.identity.v1.Identity/Login"); got != 3 {
		t.Fatalf("count = %d, esperaba 3", got)
	}
	if got := m.HistogramBucket("pp_rpc_server_duration_seconds", 0.025, "rpc", "/plentypay.identity.v1.Identity/Login"); got != 1 {
		t.Errorf("bucket 25ms = %d, esperaba 1", got)
	}
	if got := m.HistogramBucket("pp_rpc_server_duration_seconds", 0.5, "rpc", "/plentypay.identity.v1.Identity/Login"); got != 2 {
		t.Errorf("bucket 500ms = %d, esperaba 2", got)
	}

	var out strings.Builder
	m.WritePrometheus(&out)
	for _, want := range []string{
		`pp_rpc_server_duration_seconds_bucket{service="identity",rpc="/plentypay.identity.v1.Identity/Login",le="0.025"} 1`,
		`pp_rpc_server_duration_seconds_bucket{service="identity",rpc="/plentypay.identity.v1.Identity/Login",le="+Inf"} 3`,
		`pp_rpc_server_duration_seconds_sum{service="identity",rpc="/plentypay.identity.v1.Identity/Login"} 3.42`,
		`pp_rpc_server_duration_seconds_count{service="identity",rpc="/plentypay.identity.v1.Identity/Login"} 3`,
	} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("falta la serie %s en:\n%s", want, out.String())
		}
	}
}

// §2.3: una etiqueta prohibida (user_id, tenant_id, montos) se descarta en silencio:
// mejor perder la serie que publicar datos personales o alta cardinalidad.
func TestObs_ReservedLabelsAreDropped(t *testing.T) {
	m := NewMetrics("identity", "1.0.0", "sha")
	m.Inc("pp_logins_total", "result", "success")
	m.Inc("pp_logins_total", "user_id", "u1", "result", "success")
	m.Set("pp_outbox_pending", 3)
	m.Set("pp_outbox_pending", 3, "tenant_id", "t1")
	m.Observe("pp_rpc_server_duration_seconds", 0.01, "rpc", "/x")
	m.Observe("pp_rpc_server_duration_seconds", 0.01, "rpc", "/x", "request_id", "r1")

	var out strings.Builder
	m.WritePrometheus(&out)
	if strings.Contains(out.String(), `user_id=`) || strings.Contains(out.String(), `tenant_id=`) || strings.Contains(out.String(), `request_id=`) {
		t.Fatalf("se publicó una etiqueta prohibida:\n%s", out.String())
	}
	if got := m.Value("pp_logins_total", "result", "success"); got != 1 {
		t.Errorf("la serie válida debe conservarse: %v", got)
	}
	if got := m.Value("pp_outbox_pending"); got != 3 {
		t.Errorf("el medidor debe conservarse: %v", got)
	}
}

// §2.1: los medidores permiten publicar lag y pendientes.
func TestObs_GaugeSetAndExposition(t *testing.T) {
	m := NewMetrics("identity", "1.0.0", "sha")
	m.Set("pp_outbox_pending", 7)
	m.Set("pp_outbox_oldest_age_seconds", 12.5)
	var out strings.Builder
	m.WritePrometheus(&out)
	for _, want := range []string{
		`pp_outbox_pending{service="identity"} 7`,
		`pp_outbox_oldest_age_seconds{service="identity"} 12.5`,
	} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("falta la serie %s", want)
		}
	}
}
