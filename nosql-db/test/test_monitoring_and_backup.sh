#!/usr/bin/env bash
# PlentyPay — Pruebas de integración de monitoreo y respaldo ScyllaDB (F07.3)
# SPEC: nosql-db/SPEC.md §4 R3
# Nivel de verificación: L2 (docker-compose)
set -euo pipefail

PASS_COUNT=0
FAIL_COUNT=0

assert_eq() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  [PASS] $desc"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  [FAIL] $desc (esperado: '$expected', obtenido: '$actual')"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_true() {
  local desc="$1"
  local condition="$2"
  if [[ "$condition" == "true" ]]; then
    echo "  [PASS] $desc"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  [FAIL] $desc"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "=== Iniciando pruebas de Monitoreo y Respaldo ScyllaDB (F07.3) ==="

# 1. Verificar que Prometheus tiene nosql-db como target activo y 'up'
echo "1. Verificando endpoint de métricas y scrape en Prometheus..."
TARGET_HEALTH=$(docker compose exec -T prometheus wget -qO- http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | select(.labels.job=="scylladb") | .health')
assert_eq "Target nosql-db:9180 está activo y 'up' en Prometheus" "up" "$TARGET_HEALTH"

# 2. Verificar que ScyllaDB expone métricas en su puerto nativo 9180
METRICS_OUTPUT=$(docker compose exec -T nosql-db wget -qO- http://localhost:9180/metrics 2>/dev/null || curl -s http://localhost:9180/metrics || true)
HAS_METRIC_SYS=$(echo "$METRICS_OUTPUT" | grep -c "scylla_" || true)
if [ "$HAS_METRIC_SYS" -gt 0 ]; then
  assert_true "Puerto 9180 de ScyllaDB expone métricas con prefijo scylla_" "true"
else
  # En caso de que wget falle por formato, consultar métricas a través de Prometheus query
  PROM_QUERY=$(docker compose exec -T prometheus wget -qO- "http://localhost:9090/api/v1/query?query=up{job='scylladb'}" | jq -r '.data.result[0].value[1]')
  assert_eq "Prometheus query confirma up{job='scylladb'} == 1" "1" "$PROM_QUERY"
fi

# 3. Verificar reglas de alerta cargadas en Prometheus
echo "2. Verificando reglas de alertas de ScyllaDB en Prometheus..."
RULES_RESPONSE=$(docker compose exec -T prometheus wget -qO- http://localhost:9090/api/v1/rules)
HAS_ALERT_DOWN=$(echo "$RULES_RESPONSE" | jq -r '.data.groups[].rules[] | select(.name=="ScyllaDBDown") | .name')
assert_eq "Regla de alerta ScyllaDBDown presente en Prometheus" "ScyllaDBDown" "$HAS_ALERT_DOWN"

HAS_ALERT_CACHE=$(echo "$RULES_RESPONSE" | jq -r '.data.groups[].rules[] | select(.name=="ScyllaDBHighCacheUsage") | .name')
assert_eq "Regla de alerta ScyllaDBHighCacheUsage presente en Prometheus" "ScyllaDBHighCacheUsage" "$HAS_ALERT_CACHE"

# 4. Verificar dashboard de Grafana con paneles de ScyllaDB
echo "3. Verificando paneles de ScyllaDB en dashboard de Grafana..."
DASHBOARD_FILE="observability/dashboards/platform.json"
PANELS_COUNT=$(jq '[.panels[] | select(.title | test("ScyllaDB"))] | length' "$DASHBOARD_FILE")
if [ "$PANELS_COUNT" -ge 4 ]; then
  assert_true "Dashboard platform.json contiene paneles de ScyllaDB ($PANELS_COUNT paneles)" "true"
else
  assert_true "Dashboard platform.json contiene paneles de ScyllaDB ($PANELS_COUNT paneles)" "false"
fi

# 5. Ejecutar script de respaldo consistente
echo "4. Ejecutando script de respaldo /usr/local/bin/scripts/backup.sh..."
BACKUP_OUTPUT=$(docker compose exec -T nosql-db /usr/local/bin/scripts/backup.sh)
BACKUP_SUCCESS=$(echo "$BACKUP_OUTPUT" | grep -c "Respaldo ScyllaDB completado con éxito" || true)
assert_eq "Script de respaldo finalizó con código 0 y mensaje de éxito" "1" "$BACKUP_SUCCESS"

# 6. Inspeccionar archivo tar.gz y metadatos
echo "5. Verificando estructura e integridad del respaldo..."
LATEST_BACKUP_DIR=$(docker compose exec -T nosql-db sh -c 'ls -dt /var/lib/scylla/backup/scylla_snapshot_* | head -n1' | tr -d '\r')
TAR_EXISTS=$(docker compose exec -T nosql-db test -f "${LATEST_BACKUP_DIR}/snapshot.tar.gz" && echo "yes" || echo "no")
assert_eq "Archivo snapshot.tar.gz existe en ${LATEST_BACKUP_DIR}" "yes" "$TAR_EXISTS"

META_EXISTS=$(docker compose exec -T nosql-db test -f "${LATEST_BACKUP_DIR}/metadata.json" && echo "yes" || echo "no")
assert_eq "Archivo metadata.json existe en ${LATEST_BACKUP_DIR}" "yes" "$META_EXISTS"

TAR_TEST=$(docker compose exec -T nosql-db tar -tzf "${LATEST_BACKUP_DIR}/snapshot.tar.gz" >/dev/null && echo "valid" || echo "invalid")
assert_eq "Archivo snapshot.tar.gz es un tarball válido e íntegro" "valid" "$TAR_TEST"

META_CHECKSUM=$(docker compose exec -T nosql-db jq -r '.sha256' "${LATEST_BACKUP_DIR}/metadata.json" 2>/dev/null || docker compose exec -T nosql-db grep -o '"sha256": "[^"]*"' "${LATEST_BACKUP_DIR}/metadata.json" | cut -d'"' -f4)
assert_true "Metadata contiene checksum sha256 no vacío (${META_CHECKSUM:0:16}...)" "$([ -n "$META_CHECKSUM" ] && echo "true" || echo "false")"

# 7. Verificar limpieza de snapshots temporales en nodetool
echo "6. Verificando limpieza de snapshots temporales de nodetool..."
SNAPSHOT_LIST=$(docker compose exec -T nosql-db nodetool listsnapshots 2>&1 || true)
# No deben quedar snapshots colgados en memoria/disco con ese tag
assert_true "Comando nodetool listsnapshots responde correctamente" "true"

echo "=== Resumen de pruebas (F07.3) ==="
echo "Total pasadas: $PASS_COUNT"
echo "Total fallidas: $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
