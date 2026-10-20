#!/usr/bin/env bash
# Pruebas L2 del ledger contra PostgreSQL real (F10.3–F10.5, SPEC §8).
#
# AISLAMIENTO: esta máquina es producción. Nunca se toca la base `plentypay` ni el contenedor
# `ledger`: se crea una base efímera `plentypay_l2_ledger_*` en el mismo clúster, se migra con
# `migrator_ledger`, las pruebas conectan como `ledger_svc` (RLS, sin DELETE) y la base se borra
# al terminar. Las pruebas compilan y corren en un contenedor Rust en la red `plentypay_data`.
#
# Ejecutar desde la raíz del repositorio:  ./ledger/test/test_l2.sh
set -euo pipefail

PG_CONTAINER="plentypay-postgres-db-1"
NETWORK="plentypay_data"
RUNNER_IMAGE="plentypay-ledger:l2-runner"
L2_DB="plentypay_l2_ledger_$(date +%s)_$$"
# Roles creados por postgres-db/init (contraseñas por defecto del clúster local).
MIG_DSN="postgres://migrator_ledger:ledger_svc_dev_secret_32_chars!_mig@postgres-db:5432/${L2_DB}?sslmode=disable"
TEST_DSN="postgres://ledger_svc:ledger_svc_dev_secret_32_chars!@postgres-db:5432/${L2_DB}?sslmode=disable"

PASS=0
FAIL=0
check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then echo "  [PASS] $desc"; PASS=$((PASS + 1)); else echo "  [FAIL] $desc (esperado '$expected', obtenido '$actual')"; FAIL=$((FAIL + 1)); fi
}
psql_su() { docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -qAt "$@"; }
drop_l2_db() { psql_su -d postgres -c "DROP DATABASE IF EXISTS \"${L2_DB}\" WITH (FORCE)" >/dev/null 2>&1 || true; }
trap drop_l2_db EXIT

echo "=== Pruebas L2 del ledger (base efímera ${L2_DB}) ==="

# 1. Imagen de pruebas: la misma cadena de herramientas del Dockerfile (rust-standards.md §10).
docker build -q -t "$RUNNER_IMAGE" - >/dev/null <<'EOF'
FROM rust:1.97.0-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler libprotobuf-dev && rm -rf /var/lib/apt/lists/*
RUN rustup component add clippy rustfmt
EOF

# 2. Base efímera con el esquema y los permisos que da postgres-db/init en producción.
psql_su -d postgres -c "CREATE DATABASE \"${L2_DB}\""
psql_su -d "$L2_DB" <<'SQL'
CREATE SCHEMA ledger;
GRANT USAGE, CREATE ON SCHEMA ledger TO migrator_ledger;
GRANT USAGE ON SCHEMA ledger TO ledger_svc;
SQL

mkdir -p ledger/target/l2
run() {
  docker run --rm --network "$NETWORK" \
    --user "$(id -u):$(id -g)" \
    -e CARGO_HOME=/cargo -e CARGO_TARGET_DIR=/target \
    -v "$HOME/.cargo/registry:/cargo/registry" \
    -v "$PWD/ledger:/src:ro" -v "$PWD/ledger/target/l2:/target" \
    -w /src "$@"
}

# 3. Compila, migra dos veces (idempotencia) y corre las pruebas unitarias + L2.
run -e PP_MIGRATE_DSN="$MIG_DSN" "$RUNNER_IMAGE" sh -c 'cargo build --locked --offline -q && /target/debug/plentypay-ledger migrate && /target/debug/plentypay-ledger migrate'
check "Migraciones aplican y se pueden reaplicar" "0" "$?"

APPLIED=$(psql_su -d "$L2_DB" -c "SELECT count(*) FROM ledger._sqlx_migrations WHERE success")
check "Migraciones registradas" "$(ls ledger/migrations/*.sql | wc -l | tr -d ' ')" "$APPLIED"
check "ledger_svc no tiene DELETE (nada contable se borra)" "f" "$(psql_su -d "$L2_DB" -c "SELECT has_table_privilege('ledger_svc', 'ledger.entries', 'DELETE') OR has_table_privilege('ledger_svc', 'ledger.transactions', 'DELETE')")"
check "RLS activo en las 5 tablas" "5" "$(psql_su -d "$L2_DB" -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'ledger' AND c.relrowsecurity AND c.relname IN ('accounts','transactions','entries','holds','outbox')")"
check "Las tablas no son de ledger_svc (RLS lo alcanza)" "0" "$(psql_su -d "$L2_DB" -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'ledger' AND tableowner = 'ledger_svc'")"

set +e
run -e PP_LEDGER_TEST_DSN="$TEST_DSN" "$RUNNER_IMAGE" cargo test --locked --offline -q -- --include-ignored --test-threads=8 2>&1 | tee ledger/target/l2/last-run.txt
TEST_RC=${PIPESTATUS[0]}
set -e
check "cargo test (unitarias + L2 contra la base efímera)" "0" "$TEST_RC"

echo
echo "Resultado: ${PASS} pasaron, ${FAIL} fallaron"
[ "$FAIL" -eq 0 ]
