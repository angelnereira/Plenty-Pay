#!/usr/bin/env bash
# Test de Monitoreo PostgreSQL y Alertas (F06.3, L4)
# Criterio: postgres_exporter exportando métricas, Prometheus scrapeando con éxito,
# reglas de alerta de réplica/disco/conexiones cargadas y panel en dashboard Plataforma.
set -euo pipefail

PASS=0
FAIL=0

check() {
  local desc="$1"
  local expected_exit="$2"
  shift 2
  set +e
  output="$("$@" 2>&1)"
  exit_code=$?
  set -e

  if [ "$exit_code" -eq "$expected_exit" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (código esperado: $expected_exit, obtenido: $exit_code)"
    echo "         Salida: $output"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Ejecutando pruebas de Monitoreo y Alertas de PostgreSQL (F06.3) ==="

# 1. postgres-exporter responde con métricas básicas
check "postgres-exporter expone métricas y pg_up == 1" 0 \
  bash -c "docker compose exec -T prometheus wget -qO- http://postgres-exporter:9187/metrics | grep -E '^pg_up 1'"

# 2. Métricas de conexiones, réplica y disco presentes
check "postgres-exporter expone pg_stat_database_numbackends" 0 \
  bash -c "docker compose exec -T prometheus wget -qO- http://postgres-exporter:9187/metrics | grep -E '^pg_stat_database_numbackends'"

check "postgres-exporter expone pg_database_size_bytes" 0 \
  bash -c "docker compose exec -T prometheus wget -qO- http://postgres-exporter:9187/metrics | grep -E '^pg_database_size_bytes'"

check "postgres-exporter expone pg_settings_max_connections" 0 \
  bash -c "docker compose exec -T prometheus wget -qO- http://postgres-exporter:9187/metrics | grep -E '^pg_settings_max_connections'"

check "postgres-exporter expone pg_replication_lag_seconds" 0 \
  bash -c "docker compose exec -T prometheus wget -qO- http://postgres-exporter:9187/metrics | grep -E '^pg_replication_lag_seconds'"

# 3. Prometheus scrapea postgres-exporter con salud 'up'
target_health=$(docker compose exec -T prometheus wget -qO- http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | select(.labels.job=="postgres") | .health')
if [ "$target_health" = "up" ]; then
  echo "  [PASS] Prometheus target 'postgres' está UP y scrapeando"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Prometheus target 'postgres' tiene salud: $target_health"
  FAIL=$((FAIL + 1))
fi

# 4. Reglas de alertas cargadas en Prometheus
rules_count=$(docker compose exec -T prometheus wget -qO- http://localhost:9090/api/v1/rules | jq '[.data.groups[] | select(.name | contains("postgres")) | .rules[]] | length')
if [ "$rules_count" -ge 6 ]; then
  echo "  [PASS] Reglas de alerta de PostgreSQL cargadas en Prometheus ($rules_count reglas)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Se esperaban al menos 6 reglas de alerta de PostgreSQL, encontradas: $rules_count"
  FAIL=$((FAIL + 1))
fi

# 5. Dashboard de Grafana 'pp-platform' provisionado con paneles de PostgreSQL
panel_count=$(docker compose exec -T prometheus wget -qO- --header="Authorization: Basic YWRtaW46YWRtaW4=" http://grafana:3000/api/dashboards/uid/pp-platform | jq '[.dashboard.panels[] | select(.id >= 6)] | length')
if [ "$panel_count" -ge 6 ]; then
  echo "  [PASS] Dashboard Plataforma contiene $panel_count paneles de PostgreSQL provisionados"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Paneles de PostgreSQL en dashboard insuficiente: $panel_count"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "Resultado: $PASS pruebas exitosas, $FAIL fallidas."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
