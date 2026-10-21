#!/usr/bin/env bash
# Pruebas L2 de settlement contra PostgreSQL y un ledger reales y EFÍMEROS (AGENTS.md §3.1).
# Crea la base `plentypay_l2_settlement_*` con los esquemas y roles de postgres-db/init, levanta un
# ledger construido desde este repositorio sobre esa base, migra settlement dos veces y corre las
# pruebas Rust (unitarias + L2). Nunca toca la base `plentypay` ni los contenedores en servicio.
# Ejecutar desde la raíz:  ./settlement/test/test_l2.sh
set -euo pipefail

PG_CONTAINER="plentypay-postgres-db-1"
NETWORK="plentypay_data"
RUN_ID="$(date +%s)_$$"
L2_DB="plentypay_l2_settlement_${RUN_ID}"
RUNNER_IMAGE="plentypay-ledger:l2-runner"
LEDGER_C="pp-l2-settlement-ledger-${RUN_ID}"
dsn() { echo "postgres://$1:$2@postgres-db:5432/${L2_DB}?sslmode=disable"; }
SET_MIG_DSN="$(dsn migrator_settlement 'settlement_svc_dev_secret_32_chars!_mig')"
SET_DSN="$(dsn settlement_svc 'settlement_svc_dev_secret_32_chars!')"
LEDGER_MIG_DSN="$(dsn migrator_ledger 'ledger_svc_dev_secret_32_chars!_mig')"
LEDGER_DSN="$(dsn ledger_svc 'ledger_svc_dev_secret_32_chars!')"

PASS=0
FAIL=0
check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then echo "  [PASS] $desc"; PASS=$((PASS + 1)); else echo "  [FAIL] $desc (esperado '$expected', obtenido '$actual')"; FAIL=$((FAIL + 1)); fi
}
psql_su() { docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -qAt "$@"; }
cleanup() {
  docker rm -f "$LEDGER_C" >/dev/null 2>&1 || true
  psql_su -d postgres -c "DROP DATABASE IF EXISTS \"${L2_DB}\" WITH (FORCE)" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== Pruebas L2 de settlement (base efímera ${L2_DB}) ==="
docker build -q -t "$RUNNER_IMAGE" - >/dev/null <<'DOCKER'
FROM rust:1.97.0-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler libprotobuf-dev && rm -rf /var/lib/apt/lists/*
RUN rustup component add clippy rustfmt
DOCKER
docker build -q -t plentypay-ledger:l2 ledger >/dev/null

psql_su -d postgres -c "CREATE DATABASE \"${L2_DB}\""
psql_su -d "$L2_DB" < postgres-db/init/00-roles-and-schemas.sql >/dev/null

docker run --rm --network "$NETWORK" -e PP_MIGRATE_DSN="$LEDGER_MIG_DSN" plentypay-ledger:l2 migrate >/dev/null
docker run -d --name "$LEDGER_C" --network "$NETWORK" --read-only --cap-drop ALL \
  -e DATABASE_URL="$LEDGER_DSN" plentypay-ledger:l2 >/dev/null
ok=no
for _ in $(seq 1 60); do
  if docker exec "$LEDGER_C" /app healthcheck >/dev/null 2>&1; then ok=ok; break; fi
  sleep 1
done
check "ledger efímero arranca sano" "ok" "$ok"

mkdir -p settlement/target/l2
run() {
  docker run --rm --network "$NETWORK" --user "$(id -u):$(id -g)" \
    -e CARGO_HOME=/cargo -e CARGO_TARGET_DIR=/target \
    -v "$HOME/.cargo/registry:/cargo/registry" \
    -v "$PWD/settlement:/src:ro" -v "$PWD/settlement/target/l2:/target" -w /src "$@"
}

set +e
run -e PP_MIGRATE_DSN="$SET_MIG_DSN" "$RUNNER_IMAGE" sh -c 'cargo build --locked --offline -q && /target/debug/plentypay-settlement migrate && /target/debug/plentypay-settlement migrate'
MIG_RC=$?
set -e
check "Migraciones aplican y se pueden reaplicar" "0" "$MIG_RC"
TABLES="'payout_schedules','batches','batch_items','outbox'"
check "settlement_svc no tiene DELETE (nada de dinero se borra)" "0" "$(psql_su -d "$L2_DB" -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'settlement' AND tablename IN (${TABLES}) AND has_table_privilege('settlement_svc', 'settlement.' || tablename, 'DELETE')")"
check "RLS activo y forzado en las 4 tablas" "4" "$(psql_su -d "$L2_DB" -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'settlement' AND c.relrowsecurity AND c.relforcerowsecurity AND c.relname IN (${TABLES})")"

set +e
run -e PP_SETTLEMENT_TEST_DSN="$SET_DSN" -e PP_TEST_LEDGER_ADDR="http://${LEDGER_C}:50061" \
  "$RUNNER_IMAGE" cargo test --locked --offline -q -- --include-ignored --test-threads=4 2>&1 | tee settlement/target/l2/last-run.txt
TEST_RC=${PIPESTATUS[0]}
set -e
check "cargo test (unitarias + L2 contra ledger y base efímeros)" "0" "$TEST_RC"
if [ "$TEST_RC" != "0" ]; then docker logs --tail 20 "$LEDGER_C" 2>&1; fi

echo
echo "Resultado: ${PASS} pasaron, ${FAIL} fallaron"
[ "$FAIL" -eq 0 ]
