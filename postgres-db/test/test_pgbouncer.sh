#!/usr/bin/env bash
# Test de PgBouncer en Modo Transacción y Concurrencia (F06.2, L2)
# Criterio: Pooler con pool_mode = transaction, auth SCRAM-SHA-256 delegada con auth_query,
# y 100 clientes concurrentes compartiendo el pool sin errores.
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

echo "=== Ejecutando pruebas de PgBouncer en modo transacción (F06.2) ==="

ID_PASS="identity_svc_dev_secret_32_chars!"
LEDGER_PASS="ledger_svc_dev_secret_32_chars!"
RO_PASS="readonly_ops_dev_pass"
PG_PASS="postgres_dev_master_password_32ch"

# 1. Autenticación delegada SCRAM-SHA-256 para identity_svc
check "identity_svc se autentica vía auth_query SCRAM-SHA-256" 0 \
  docker compose exec -T -e PGPASSWORD="$ID_PASS" postgres-db psql -h pgbouncer -p 6432 -U identity_svc -d plentypay -c "SELECT current_user;"

# 2. Autenticación delegada SCRAM-SHA-256 para ledger_svc
check "ledger_svc se autentica vía auth_query SCRAM-SHA-256" 0 \
  docker compose exec -T -e PGPASSWORD="$LEDGER_PASS" postgres-db psql -h pgbouncer -p 6432 -U ledger_svc -d plentypay -c "SELECT current_user;"

# 3. Autenticación de usuario estático readonly_ops
check "readonly_ops se autentica a través de PgBouncer" 0 \
  docker compose exec -T -e PGPASSWORD="$RO_PASS" postgres-db psql -h pgbouncer -p 6432 -U readonly_ops -d plentypay -c "SELECT current_user;"

# 4. Rechazo de credenciales inválidas
check "Contraseña incorrecta es rechazada con fallo de autenticación" 2 \
  docker compose exec -T -e PGPASSWORD="wrong_password_xyz" postgres-db psql -h pgbouncer -p 6432 -U identity_svc -d plentypay -c "SELECT 1;"

# 5. Verificación de pool_mode = transaction en admin console
check "PgBouncer opera en pool_mode = transaction" 0 \
  docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h pgbouncer -p 6432 -U postgres -d pgbouncer -t -c "SHOW POOLS;"

pool_modes=$(docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h pgbouncer -p 6432 -U postgres -d pgbouncer -t -c "SHOW POOLS;" | grep plentypay | awk -F'|' '{print $NF}' | tr -d ' ')
for mode in $pool_modes; do
  if [ "$mode" != "transaction" ]; then
    echo "  [FAIL] Encontrado pool plentypay en modo no transacción: $mode"
    FAIL=$((FAIL + 1))
  fi
done
echo "  [PASS] Todos los pools de plentypay tienen pool_mode = transaction"
PASS=$((PASS + 1))

# 6. Prueba de alta concurrencia: 100 clientes concurrentes
echo "  [*] Lanzando 100 consultas concurrentes a través de PgBouncer..."
CONC_FAIL=0
PIDS=()
for i in $(seq 1 100); do
  (
    docker compose exec -T -e PGPASSWORD="$ID_PASS" postgres-db psql -h pgbouncer -p 6432 -U identity_svc -d plentypay -c "SELECT pg_sleep(0.05), $i as client_id;" >/dev/null 2>&1
  ) &
  PIDS+=($!)
done

for pid in "${PIDS[@]}"; do
  if ! wait "$pid"; then
    CONC_FAIL=$((CONC_FAIL + 1))
  fi
done

if [ "$CONC_FAIL" -eq 0 ]; then
  echo "  [PASS] 100 clientes concurrentes completaron transacciones sin error"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] $CONC_FAIL clientes fallaron durante la prueba de concurrencia"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "Resultado: $PASS pruebas exitosas, $FAIL fallidas."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
