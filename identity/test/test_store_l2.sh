#!/usr/bin/env bash
# Pruebas L2 del store de identity contra PostgreSQL real (F08.2).
# Criterio de aceptacion del paso: "Pruebas L2 de store; RLS activo".
#
# Flujo: aplica migraciones -> corre las pruebas Go compiladas -> verifica
# idempotencia de la migracion -> revisa la estructura del estandar Go.
#
# Ejecutar desde la raiz del repositorio:  ./identity/test/test_store_l2.sh
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
CONTAINER="plentypay-identity-1"
NETWORK="plentypay_data"
BIN_DIR="identity/test/bin"
RUNNER_IMAGE="busybox:stable"
# Rol identity_svc por PgBouncer (escenario real del contenedor).
TEST_DSN="postgres://identity_svc:identity_svc_dev_secret_32_chars!@pgbouncer:6432/plentypay?sslmode=disable"
SVC_DSN="postgres://identity_svc:identity_svc_dev_secret_32_chars!@pgbouncer:6432/plentypay?sslmode=disable"

echo "=== Pruebas L2 del store de identity (F08.2) ==="

# 1. La estructura de carpetas cumple go-standards.md seccion 2
for d in migrations internal/config internal/store internal/server internal/service internal/domain internal/observability; do
  if [ -d "identity/$d" ]; then
    assert_eq "Existe identity/$d (go-standards.md 2)" "si" "si"
  else
    assert_eq "Existe identity/$d (go-standards.md 2)" "si" "no"
  fi
done
UPMIG=$(ls identity/migrations/*.up.sql 2>/dev/null | wc -l | tr -d ' ')
DOWNMIG=$(ls identity/migrations/*.down.sql 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Cada migracion tiene su .down.sql (data-standards.md 5)" "$UPMIG" "$DOWNMIG"

# 2. Reconstruir la imagen de identity (cambia main.go/store)
echo "  [*] Reconstruyendo identity..."
compose up -d --build identity >/dev/null 2>&1

# 3. Aplicar migraciones con el subcomando migrate (Job migrate-identity)
echo "  [*] Aplicando migraciones (identity migrate)..."
MIG_OUT=$(compose exec -T -e PP_DB_DSN="$SVC_DSN" identity /app migrate 2>&1 || true)
MIG_VERSION=$(echo "$MIG_OUT" | grep -oE '"version":[0-9]+' | head -1 | cut -d: -f2)
assert_eq "La migracion 0001 queda aplicada" "1" "$MIG_VERSION"

# 4. Idempotencia: la segunda ejecucion no aplica nada
MIG_OUT2=$(compose exec -T -e PP_DB_DSN="$SVC_DSN" identity /app migrate 2>&1 || true)
APPLIED2=$(echo "$MIG_OUT2" | grep -oE '"applied":(true|false)' | head -1 | cut -d: -f2)
assert_eq "La segunda ejecucion de migrate no reaplica (idempotente)" "false" "$APPLIED2"

# 5. Las tablas y las politicas RLS existen (RLS ACTIVO, ADR 0014)
TABLES=$(compose exec -T -e PGPASSWORD="identity_svc_dev_secret_32_chars!" postgres-db \
  psql -h postgres-db -U identity_svc -d plentypay -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='identity' AND tablename IN ('users','consents')" 2>/dev/null | tr -d '[:space:]')
assert_eq "Las tablas users y consents existen en el esquema identity" "2" "$TABLES"

RLS_ON=$(compose exec -T -e PGPASSWORD="identity_svc_dev_secret_32_chars!" postgres-db \
  psql -h postgres-db -U identity_svc -d plentypay -tAc \
  "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='identity' AND c.relname IN ('users','consents') AND c.relrowsecurity" 2>/dev/null | tr -d '[:space:]')
assert_eq "RLS esta activo en users y consents (ADR 0014)" "2" "$RLS_ON"

# 6. Compilar las pruebas L2 y ejecutarlas dentro de la red de datos
echo "  [*] Compilando y ejecutando las pruebas Go L2 del store..."
mkdir -p "$BIN_DIR"
(cd identity && go test -c -tags l2 -o "$BIN_DIR/store.l2.test" ./internal/store/)
TEST_OUT=$(docker run --rm --network "$NETWORK" -e PP_TEST_DB_DSN="$TEST_DSN" \
  -v "$PWD/$BIN_DIR:/t:ro" "$RUNNER_IMAGE" /t/store.l2.test -test.v 2>&1 || true)
echo "$TEST_OUT" | grep -E "^(=== RUN|--- (PASS|FAIL|SKIP)|PASS|FAIL|ok)" | head -30
RESULT=$(echo "$TEST_OUT" | grep -cE "^--- PASS" || true)
FAILS=$(echo "$TEST_OUT" | grep -cE "^--- FAIL" || true)
SKIPS=$(echo "$TEST_OUT" | grep -cE "^--- SKIP" || true)
if [ "$FAILS" = "0" ] && [ "${RESULT:-0}" -ge 6 ]; then
  assert_true "Las pruebas Go L2 del store pasan ($RESULT pasan, $SKIPS saltadas)" "true"
else
  assert_true "Las pruebas Go L2 del store pasan ($RESULT pasan, $FAILS fallan)" "false"
fi

echo ""
echo "Resultado F08.2: $PASS pasadas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || exit 1
