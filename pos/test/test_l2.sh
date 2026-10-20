#!/usr/bin/env bash
# Pruebas L2 de catalog contra PostgreSQL real y EFÍMERO (AGENTS.md §3.1): crea una base aparte en el
# clúster, la migra con una imagen etiquetada `:l2`, corre las pruebas y la borra al terminar.
# Nunca toca la base `plentypay` ni el contenedor `catalog` en servicio.
# Uso (desde la raíz): ./catalog/test/test_l2.sh
set -euo pipefail
SVC=pos
PG_CONTAINER="plentypay-postgres-db-1"
NETWORK="plentypay_data"
L2_DB="plentypay_l2_${SVC}_$(date +%s)_$$"
MIG_DSN="postgres://migrator_${SVC}:${SVC}_svc_dev_secret_32_chars!_mig@postgres-db:5432/${L2_DB}?sslmode=disable"
TEST_DSN="postgres://${SVC}_svc:${SVC}_svc_dev_secret_32_chars!@postgres-db:5432/${L2_DB}?sslmode=disable"
BIN_DIR="$PWD/$SVC/test/bin"
psql_su() { docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -qAt "$@"; }
cleanup() { psql_su -d postgres -c "DROP DATABASE IF EXISTS \"${L2_DB}\" WITH (FORCE)" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "=== L2 $SVC: base efímera $L2_DB ==="
psql_su -d postgres -c "CREATE DATABASE \"${L2_DB}\"" >/dev/null
psql_su -d "$L2_DB" < postgres-db/init/00-roles-and-schemas.sql >/dev/null
docker build -q -t "plentypay-$SVC:l2" "$SVC" >/dev/null
docker run --rm --network "$NETWORK" -e PP_MIGRATE_DSN="$MIG_DSN" "plentypay-$SVC:l2" migrate 2>&1 | grep -o '"msg":"migrate[^"]*".*"applied":[a-z]*'
docker run --rm --network "$NETWORK" -e PP_MIGRATE_DSN="$MIG_DSN" "plentypay-$SVC:l2" migrate 2>&1 | grep -q '"applied":false' \
  && echo "  [PASS] la segunda migración no reaplica (idempotente)" || { echo "  [FAIL] migración no idempotente"; exit 1; }
mkdir -p "$BIN_DIR"
(cd "$SVC" && CGO_ENABLED=0 go test -c -tags l2 -o "$BIN_DIR/store.l2.test" ./internal/store/)
OUT=$(docker run --rm --network "$NETWORK" -e PP_TEST_DB_DSN="$TEST_DSN" -v "$BIN_DIR:/t:ro" busybox:stable /t/store.l2.test -test.v 2>&1 || true)
echo "$OUT" | grep -E "^(--- (PASS|FAIL|SKIP)|PASS$|FAIL$)|_test.go:[0-9]+:"
PASSES=$(echo "$OUT" | grep -cE '^--- PASS' || true)
FAILS=$(echo "$OUT" | grep -cE '^--- (FAIL|SKIP)' || true)
echo "Resultado L2 $SVC: $PASSES pasan, $FAILS fallan o se saltan"
[ "$FAILS" = 0 ] && [ "$PASSES" -gt 0 ]
