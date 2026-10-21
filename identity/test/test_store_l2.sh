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
# AISLAMIENTO (2026-10-20): esta máquina es producción. Las pruebas L2 NUNCA tocan la base
# `plentypay` ni el contenedor `identity` que atiende a las apps: se crea una base efímera en el
# mismo clúster, se migra con una imagen etiquetada aparte y se borra al terminar.
PG_CONTAINER="plentypay-postgres-db-1"
NETWORK="plentypay_data"
BIN_DIR="identity/test/bin"
RUNNER_IMAGE="busybox:stable"
L2_IMAGE="plentypay-identity:l2"
L2_DB="plentypay_l2_$(date +%s)_$$"
MIG_DSN="postgres://migrator_identity:identity_svc_dev_secret_32_chars!_mig@postgres-db:5432/${L2_DB}?sslmode=disable"
# Secretos efímeros solo para arrancar el binario de migración (no son los de producción).
EPHEMERAL_SECRETS="-e ACCESS_TOKEN_SECRET=l2-$(head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9)-access-secret -e REFRESH_TOKEN_SECRET=l2-$(head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9)-refresh-secret"
TEST_DSN="postgres://identity_svc:identity_svc_dev_secret_32_chars!@postgres-db:5432/${L2_DB}?sslmode=disable"
psql_su() { docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -qAt "$@"; }
drop_l2_db() { psql_su -d postgres -c "DROP DATABASE IF EXISTS \"${L2_DB}\" WITH (FORCE)" >/dev/null 2>&1 || true; }
trap drop_l2_db EXIT
# Las pruebas que publican en NATS solo corren con un bus de pruebas explícito: el stream
# PP_IDENTITY de esta máquina lo consumen servicios reales.
NATS_ENV=""
if [ -n "${PP_TEST_NATS_URL:-}" ]; then NATS_ENV="-e PP_TEST_NATS_URL=${PP_TEST_NATS_URL}"; fi

echo "=== Pruebas L2 del store de identity (F08.2) ==="

# 1. La estructura de carpetas cumple go-standards.md seccion 2
for d in migrations internal/config internal/store internal/server internal/service internal/domain internal/observability; do
  if [ -d "identity/$d" ]; then
    assert_eq "Existe identity/$d (go-standards.md 2)" "si" "si"
  else
    assert_eq "Existe identity/$d (go-standards.md 2)" "si" "no"
  fi
done
# Paridad estricta por numero: un NNNN sin .up.sql (o sin .down.sql) es un error
# grave — golang-migrate ejecutaria el archivo que si existe y registraria la
# version, dejando el esquema incompleto en silencio.
MIG_NUMBERS=$(ls identity/migrations/ | grep -oE '^[0-9]{4}' | sort -u)
MIG_ERRORS=0
for n in $MIG_NUMBERS; do
  [ -f "identity/migrations/${n}_"*.up.sql ] || { echo "  [FAIL] migracion $n sin .up.sql"; MIG_ERRORS=$((MIG_ERRORS + 1)); }
  [ -f "identity/migrations/${n}_"*.down.sql ] || { echo "  [FAIL] migracion $n sin .down.sql"; MIG_ERRORS=$((MIG_ERRORS + 1)); }
done
assert_eq "Cada migracion tiene su .up.sql y su .down.sql (data-standards.md 5)" "0" "$MIG_ERRORS"
# Ademas: ningun archivo suelto sin sufijo up/down.
STRAY=$(ls identity/migrations/ | grep -vcE '\.(up|down)\.sql$' || true)
assert_eq "No hay archivos de migracion sin sufijo .up.sql/.down.sql" "0" "$STRAY"

# 2. Base efímera con los esquemas y roles del clúster (postgres-db/init)
echo "  [*] Creando la base aislada ${L2_DB}..."
psql_su -d postgres -c "CREATE DATABASE \"${L2_DB}\"" >/dev/null
psql_su -d "$L2_DB" < postgres-db/init/00-roles-and-schemas.sql >/dev/null

# 3. Migraciones con una imagen etiquetada aparte (no se reconstruye ni reinicia el servicio)
echo "  [*] Construyendo ${L2_IMAGE} y aplicando migraciones en la base aislada..."
docker build -q -t "$L2_IMAGE" identity >/dev/null
MIG_OUT=$(docker run --rm --network "$NETWORK" $EPHEMERAL_SECRETS -e PP_MIGRATE_DSN="$MIG_DSN" "$L2_IMAGE" migrate 2>&1 || true)
MIG_VERSION=$(echo "$MIG_OUT" | grep -oE '"version":[0-9]+' | head -1 | cut -d: -f2 || true)
[ -n "$MIG_VERSION" ] || echo "$MIG_OUT" | tail -3
assert_eq "La ultima migracion aplicada es la 0011 (confirmación fuerte, ADR 0020)" "11" "$MIG_VERSION"

# 4. Idempotencia: la segunda ejecucion no aplica nada
MIG_OUT2=$(docker run --rm --network "$NETWORK" $EPHEMERAL_SECRETS -e PP_MIGRATE_DSN="$MIG_DSN" "$L2_IMAGE" migrate 2>&1 || true)
APPLIED2=$(echo "$MIG_OUT2" | grep -oE '"applied":(true|false)' | head -1 | cut -d: -f2 || true)
assert_eq "La segunda ejecucion de migrate no reaplica (idempotente)" "false" "$APPLIED2"

# 5. Las tablas y las politicas RLS existen (RLS ACTIVO, ADR 0014)
TABLES=$(psql_su -d "$L2_DB" -c \
  "SELECT count(*) FROM pg_tables WHERE schemaname='identity' AND tablename IN ('users','consents','sessions','refresh_tokens','outbox','login_attempts','tenants','tenant_kyb_documents','roles','role_permissions','user_roles','invitations','password_resets','verticals','tenant_capabilities','branches','memberships','membership_branches','idempotency_keys','passkeys','webauthn_challenges','step_up_tokens','step_up_pins')" 2>/dev/null | tr -d '[:space:]')
assert_eq "Las tablas del esquema identity existen (23)" "23" "$TABLES"

RLS_ON=$(psql_su -d "$L2_DB" -c \
  "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='identity' AND c.relname IN ('users','consents','sessions','refresh_tokens','outbox','login_attempts','tenants','tenant_kyb_documents','roles','role_permissions','user_roles','invitations','password_resets','verticals','tenant_capabilities','branches','memberships','membership_branches','idempotency_keys','passkeys','webauthn_challenges','step_up_tokens','step_up_pins') AND c.relrowsecurity" 2>/dev/null | tr -d '[:space:]')
assert_eq "RLS esta activo en las 23 tablas (ADR 0014)" "23" "$RLS_ON"

# 6. Compilar las pruebas L2 y ejecutarlas dentro de la red de datos
echo "  [*] Compilando y ejecutando las pruebas Go L2 del store..."
mkdir -p "$BIN_DIR"
# Ruta absoluta: el binario se compila dentro de identity/ y debe quedar donde el runner lo monta
# (con una ruta relativa caia en identity/identity/test/bin y corria un binario viejo).
rm -f "$PWD/$BIN_DIR/store.l2.test"
(cd identity && go test -c -tags l2 -o "$OLDPWD/$BIN_DIR/store.l2.test" ./internal/store/)
TEST_OUT=$(docker run --rm --network "$NETWORK" -e PP_TEST_DB_DSN="$TEST_DSN" $NATS_ENV \
  -v "$PWD/$BIN_DIR:/t:ro" "$RUNNER_IMAGE" /t/store.l2.test -test.v 2>&1 || true)
echo "$TEST_OUT" | grep -E "^(--- (PASS|FAIL|SKIP)|PASS|FAIL|ok)|_test.go:[0-9]+:" | head -80
RESULT=$(echo "$TEST_OUT" | grep -cE "^--- PASS" || true)
FAILS=$(echo "$TEST_OUT" | grep -cE "^--- FAIL" || true)
SKIPS=$(echo "$TEST_OUT" | grep -cE "^--- SKIP" || true)
if [ "$FAILS" = "0" ] && [ "${RESULT:-0}" -ge 22 ]; then
  assert_true "Las pruebas Go L2 del store pasan ($RESULT pasan, $SKIPS saltadas)" "true"
else
  assert_true "Las pruebas Go L2 del store pasan ($RESULT pasan, $FAILS fallan)" "false"
fi

echo ""
echo "Resultado L2 (F08.2-F08.7, F08.6 ampliado): $PASS pasadas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || exit 1
