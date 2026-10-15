#!/usr/bin/env bash
# Test de ScyllaDB y Aislamiento de Roles/Keyspaces CQL (F07.1, F07.2, L2)
# Criterios:
# F07.1: ScyllaDB responde a CQL y healthcheck pasa.
# F07.2: Roles y keyspaces por dueño configurados; rol de geo no escribe en analytics.
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

echo "=== Ejecutando pruebas de ScyllaDB y Aislamiento NoSQL (F07.1, F07.2) ==="

CAT_PASS="catalog_svc_dev_secret_32_chars!"
GEO_PASS="geo_svc_dev_secret_32_chars!"
ANA_PASS="analytics_svc_dev_secret_32_chars!"

# 1. F07.1: ScyllaDB CQL responde y keyspaces existen
check "ScyllaDB CQL responde a superuser cassandra" 0 \
  docker compose exec -T nosql-db cqlsh -u cassandra -p cassandra -e "DESCRIBE KEYSPACES;"

keyspaces=$(docker compose exec -T nosql-db cqlsh -u cassandra -p cassandra -e "DESCRIBE KEYSPACES;")
for ks in catalog_attrs geo_tracks analytics_events; do
  if echo "$keyspaces" | grep -q "$ks"; then
    echo "  [PASS] Keyspace '$ks' existe en ScyllaDB"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Keyspace '$ks' no fue encontrado en ScyllaDB"
    FAIL=$((FAIL + 1))
  fi
done

# 2. F07.1: Verificación de TTL en esquemas
check "Tabla geo_tracks.points tiene default_time_to_live = 7776000 (90 días)" 0 \
  bash -c "docker compose exec -T nosql-db cqlsh -u cassandra -p cassandra -e 'DESCRIBE TABLE geo_tracks.points;' | grep -q 'default_time_to_live = 7776000'"

check "Tabla analytics_events.events tiene default_time_to_live = 65700000 (25 meses)" 0 \
  bash -c "docker compose exec -T nosql-db cqlsh -u cassandra -p cassandra -e 'DESCRIBE TABLE analytics_events.events;' | grep -q 'default_time_to_live = 65700000'"

# 3. F07.2: Cada rol escribe y lee en su propio keyspace
check "catalog_svc inserta y lee en catalog_attrs.product_attributes" 0 \
  bash -c "docker compose exec -T nosql-db cqlsh -u catalog_svc -p '$CAT_PASS' -e \"INSERT INTO catalog_attrs.product_attributes (tenant_id, product_id, attr_key, attr_value) VALUES ('tenant_1', 'prod_123', 'color', 'azul');\" && docker compose exec -T nosql-db cqlsh -u catalog_svc -p '$CAT_PASS' -e \"SELECT * FROM catalog_attrs.product_attributes WHERE tenant_id = 'tenant_1' AND product_id = 'prod_123';\""

check "geo_svc inserta y lee en geo_tracks.points" 0 \
  bash -c "docker compose exec -T nosql-db cqlsh -u geo_svc -p '$GEO_PASS' -e \"INSERT INTO geo_tracks.points (tenant_id, device_id, day, recorded_at, lat, lng, speed) VALUES ('tenant_1', 'dev_456', '2026-10-13', toTimestamp(now()), 8.9824, -79.5199, 45.0);\" && docker compose exec -T nosql-db cqlsh -u geo_svc -p '$GEO_PASS' -e \"SELECT * FROM geo_tracks.points WHERE tenant_id = 'tenant_1' AND device_id = 'dev_456' AND day = '2026-10-13';\""

check "analytics_svc inserta y lee en analytics_events.events" 0 \
  bash -c "docker compose exec -T nosql-db cqlsh -u analytics_svc -p '$ANA_PASS' -e \"INSERT INTO analytics_events.events (tenant_id, month, event_id, event_type, payload, occurred_at) VALUES ('tenant_1', '2026-10', now(), 'PAYMENT_COMPLETED', '{\\\"amount\\\":1000}', toTimestamp(now()));\" && docker compose exec -T nosql-db cqlsh -u analytics_svc -p '$ANA_PASS' -e \"SELECT * FROM analytics_events.events WHERE tenant_id = 'tenant_1' AND month = '2026-10';\""

# 4. F07.2: AISLAMIENTO ESTRICTO — Rol de geo NO escribe ni lee en analytics (Criterio F07.2)
check "geo_svc no puede escribir en analytics_events (debe fallar con Unauthorized)" 2 \
  docker compose exec -T nosql-db cqlsh -u geo_svc -p "$GEO_PASS" -e "INSERT INTO analytics_events.events (tenant_id, month, event_id, event_type, payload, occurred_at) VALUES ('tenant_1', '2026-10', now(), 'UNAUTHORIZED_EVENT', '{}', toTimestamp(now()));"

check "geo_svc no puede leer de analytics_events (debe fallar con Unauthorized)" 2 \
  docker compose exec -T nosql-db cqlsh -u geo_svc -p "$GEO_PASS" -e "SELECT * FROM analytics_events.events WHERE tenant_id = 'tenant_1' AND month = '2026-10';"

# 5. AISLAMIENTO ESTRICTO — analytics_svc NO puede escribir en catalog_attrs
check "analytics_svc no puede escribir en catalog_attrs (debe fallar con Unauthorized)" 2 \
  docker compose exec -T nosql-db cqlsh -u analytics_svc -p "$ANA_PASS" -e "INSERT INTO catalog_attrs.product_attributes (tenant_id, product_id, attr_key, attr_value) VALUES ('tenant_1', 'prod_hack', 'price', '0');"

# 6. AISLAMIENTO ESTRICTO — catalog_svc NO puede escribir en geo_tracks
check "catalog_svc no puede escribir en geo_tracks (debe fallar con Unauthorized)" 2 \
  docker compose exec -T nosql-db cqlsh -u catalog_svc -p "$CAT_PASS" -e "INSERT INTO geo_tracks.points (tenant_id, device_id, day, recorded_at, lat, lng, speed) VALUES ('tenant_1', 'dev_fake', '2026-10-13', toTimestamp(now()), 0.0, 0.0, 0.0);"

# 7. Credenciales incorrectas son rechazadas
check "Credenciales incorrectas son rechazadas con fallo de autenticación" 1 \
  docker compose exec -T nosql-db cqlsh -u geo_svc -p "wrong_password_xyz" -e "DESCRIBE KEYSPACES;"

echo ""
echo "Resultado: $PASS pruebas exitosas, $FAIL fallidas."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
