#!/usr/bin/env bash
# Pruebas de monitoreo y alertas de NATS/JetStream (F07.7, L4)
# Criterio de aceptación: "Alerta de DLQ inyectada".
# Reglas verificadas: observability-standards.md §5 (lag y DLQ alertados) y §9
# (toda alerta lleva runbook_url); event-bus/SPEC.md §4 R2 (max_deliver -> DLQ).
#
# Ejecutar desde la raíz del repositorio:  ./event-bus/test/test_monitoring_alerts.sh
set -euo pipefail

PASS=0
FAIL=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (esperado: '$expected', obtenido: '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

assert_true() {
  local desc="$1" cond="$2"
  if [ "$cond" = "true" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc"
    FAIL=$((FAIL + 1))
  fi
}

compose() { docker compose "$@"; }
PROM="http://localhost:9090"

echo "=== Pruebas de exporter, métricas y alertas de event-bus (F07.7) ==="

# 1. F07.7: Prometheus tiene el target de nats-exporter activo y 'up'
TARGET_HEALTH=$(docker exec plentypay-prometheus-1 wget -qO- "$PROM/api/v1/targets" 2>/dev/null | jq -r '.data.activeTargets[] | select(.labels.job=="nats") | .health')
assert_eq "Target nats-exporter:7777 está activo y 'up' en Prometheus" "up" "$TARGET_HEALTH"

# 2. F07.7: las 4 reglas de alerta de NATS están cargadas en Prometheus
RULES=$(docker exec plentypay-prometheus-1 wget -qO- "$PROM/api/v1/rules" 2>/dev/null)
for alert in NatsDown NatsDLQMessagesDetected NatsConsumerLagHigh NatsSlowConsumers; do
  LOADED=$(echo "$RULES" | jq -r --arg a "$alert" '[.data.groups[].rules[] | select(.name==$a)] | length')
  assert_eq "Regla de alerta $alert cargada desde observability/alerts/nats.yml" "1" "$LOADED"
done

# 3. §9: toda alerta de NATS declara runbook_url
WITH_RUNBOOK=$(echo "$RULES" | jq -r '[.data.groups[].rules[] | select(.name | startswith("Nats")) | select(.annotations.runbook_url != null and .annotations.runbook_url != "")] | length')
TOTAL_NATS=$(echo "$RULES" | jq -r '[.data.groups[].rules[] | select(.name | startswith("Nats"))] | length')
assert_eq "Todas las alertas Nats declaran runbook_url (§9)" "$TOTAL_NATS" "$WITH_RUNBOOK"

# 4. F07.7: las métricas del exporter se observan en Prometheus
for metric in "gnatsd_varz_slow_consumers" "gnatsd_connz_num_connections" "jetstream_stream_total_messages"; do
  COUNT=$(docker exec plentypay-prometheus-1 wget -qO- "$PROM/api/v1/query?query=$metric" 2>/dev/null | jq -r '.data.result | length')
  if [ "${COUNT:-0}" -gt 0 ]; then
    assert_true "Métrica $metric presente en Prometheus" "true"
  else
    assert_true "Métrica $metric presente en Prometheus" "false"
  fi
done

# 5. Métricas por stream JetStream (labels de la expresión de las alertas)
DLQ_METRIC=$(docker exec plentypay-prometheus-1 wget -qO- "$PROM/api/v1/query?query=jetstream_stream_total_messages%7Bstream_name%3D%22PP_DLQ%22%7D" 2>/dev/null | jq -r '.data.result | length')
assert_eq "La métrica de DLQ lleva la etiqueta stream_name=\"PP_DLQ\" usada por la alerta" "1" "$DLQ_METRIC"

# 6. Criterio del paso: alerta de DLQ inyectada y recibida por Alertmanager
echo "  [*] Inyectando alerta sintética de DLQ en Alertmanager..."
docker exec plentypay-alertmanager-1 amtool alert add alertname=NatsDLQMessagesDetected severity=critical \
  service=event-bus stream=PP_DLQ --alertmanager.url=http://localhost:9093 >/dev/null 2>&1
sleep 2
RECEIVED=$(docker exec plentypay-alertmanager-1 amtool alert query --alertmanager.url=http://localhost:9093 -o json 2>/dev/null | jq -r '[.[] | select(.labels.alertname=="NatsDLQMessagesDetected" and .labels.stream=="PP_DLQ")] | length')
assert_eq "Alertmanager recibe la alerta inyectada de DLQ" "1" "$RECEIVED"

# 7. Limpieza de la alerta inyectada
docker exec plentypay-alertmanager-1 amtool alert delete alertname=NatsDLQMessagesDetected stream=PP_DLQ \
  service=event-bus --alertmanager.url=http://localhost:9093 >/dev/null 2>&1 || true

# 8. Paneles de NATS en el dashboard de plataforma (observability-standards.md §7)
DASHBOARD="observability/dashboards/platform.json"
if [ -f "$DASHBOARD" ]; then
  PANELS=$(jq '[.panels[] | select(.title | test("NATS|JetStream|DLQ"))] | length' "$DASHBOARD")
  if [ "${PANELS:-0}" -ge 5 ]; then
    assert_true "Dashboard pp-platform contiene $PANELS paneles de NATS/JetStream" "true"
  else
    assert_true "Dashboard pp-platform contiene $PANELS paneles de NATS/JetStream" "false"
  fi
fi

echo ""
echo "Resultado F07.7: $PASS pasadas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || exit 1
