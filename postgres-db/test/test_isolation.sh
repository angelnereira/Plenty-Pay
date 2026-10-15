#!/usr/bin/env bash
# Test de Aislamiento de Esquemas y Roles (F06.1, L2)
# Criterio: El rol de un servicio NO puede leer ni escribir en el esquema de otro servicio.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
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

run_as() {
  local role="$1"
  local pass="$2"
  local sql="$3"
  docker compose exec -T -e PGPASSWORD="$pass" postgres-db psql -h localhost -U "$role" -d plentypay -c "$sql"
}

echo "=== Ejecutando pruebas de aislamiento de roles y esquemas PostgreSQL (F06.1) ==="

ID_PASS="identity_svc_dev_secret_32_chars!"
LEDGER_PASS="ledger_svc_dev_secret_32_chars!"
RO_PASS="readonly_ops_dev_pass"

# 1. identity_svc opera en esquema identity
check "identity_svc crea tabla en su propio esquema" 0 \
  run_as identity_svc "$ID_PASS" "CREATE TABLE IF NOT EXISTS identity.test_isolation (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text); INSERT INTO identity.test_isolation (email) VALUES ('test@plentypay.test');"

check "identity_svc lee de su propio esquema" 0 \
  run_as identity_svc "$ID_PASS" "SELECT count(*) FROM identity.test_isolation;"

# 2. ledger_svc opera en esquema ledger
check "ledger_svc crea tabla en su propio esquema" 0 \
  run_as ledger_svc "$LEDGER_PASS" "CREATE TABLE IF NOT EXISTS ledger.test_isolation (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), balance bigint); INSERT INTO ledger.test_isolation (balance) VALUES (1000);"

check "ledger_svc lee de su propio esquema" 0 \
  run_as ledger_svc "$LEDGER_PASS" "SELECT count(*) FROM ledger.test_isolation;"

# 3. AISLAMIENTO: identity_svc NO debe acceder al esquema ledger
check "identity_svc no puede leer tabla de ledger (debe fallar)" 1 \
  run_as identity_svc "$ID_PASS" "SELECT * FROM ledger.test_isolation;"

check "identity_svc no puede escribir en esquema ledger (debe fallar)" 1 \
  run_as identity_svc "$ID_PASS" "INSERT INTO ledger.test_isolation (balance) VALUES (999);"

# 4. AISLAMIENTO: ledger_svc NO debe acceder al esquema identity
check "ledger_svc no puede leer tabla de identity (debe fallar)" 1 \
  run_as ledger_svc "$LEDGER_PASS" "SELECT * FROM identity.test_isolation;"

check "ledger_svc no puede escribir en esquema identity (debe fallar)" 1 \
  run_as ledger_svc "$LEDGER_PASS" "INSERT INTO identity.test_isolation (email) VALUES ('hacked@hack.com');"

# 5. AISLAMIENTO: Ningún rol de servicio puede escribir en schema public
check "identity_svc no puede crear tabla en public (debe fallar)" 1 \
  run_as identity_svc "$ID_PASS" "CREATE TABLE public.unauthorized (id int);"

check "ledger_svc no puede crear tabla en public (debe fallar)" 1 \
  run_as ledger_svc "$LEDGER_PASS" "CREATE TABLE public.unauthorized (id int);"

# 6. readonly_ops puede leer pero no mutar
check "readonly_ops puede leer esquema identity" 0 \
  run_as readonly_ops "$RO_PASS" "SELECT count(*) FROM identity.test_isolation;"

check "readonly_ops no puede insertar en esquema identity (debe fallar)" 1 \
  run_as readonly_ops "$RO_PASS" "INSERT INTO identity.test_isolation (email) VALUES ('ro@fail.com');"

# Limpieza
docker compose exec -T postgres-db psql -U postgres -d plentypay -c "DROP TABLE IF EXISTS identity.test_isolation; DROP TABLE IF EXISTS ledger.test_isolation;" >/dev/null 2>&1 || true

echo ""
echo "Resultado: $PASS pruebas exitosas, $FAIL fallidas."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
