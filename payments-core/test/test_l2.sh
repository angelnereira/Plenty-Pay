#!/usr/bin/env bash
# Pruebas L2 de payments-core contra servicios reales y efímeros (F11.3, F11.5; SPEC §12).
#
# AISLAMIENTO: esta máquina es producción. Nunca se toca la base `plentypay` ni los contenedores
# en servicio. Se crea una base efímera `plentypay_l2_payments_*` con los esquemas y roles de
# postgres-db/init; se levantan, con nombres propios, un ledger, un identity y un
# infra-management construidos desde este repositorio y conectados a esa base; las pruebas Rust
# corren en un contenedor de la red `plentypay_data`. Al salir se borran contenedores y base.
#
# Ejecutar desde la raíz del repositorio:  ./payments-core/test/test_l2.sh
set -euo pipefail

PG_CONTAINER="plentypay-postgres-db-1"
NETWORK="plentypay_data"
RUN_ID="$(date +%s)_$$"
L2_DB="plentypay_l2_payments_${RUN_ID}"
RUNNER_IMAGE="plentypay-ledger:l2-runner"
LEDGER_C="pp-l2-ledger-${RUN_ID}"
IDENTITY_C="pp-l2-identity-${RUN_ID}"
INFRA_C="pp-l2-infra-${RUN_ID}"
# Roles creados por postgres-db/init (contraseñas por defecto del clúster local).
dsn() { echo "postgres://$1:$2@postgres-db:5432/${L2_DB}?sslmode=disable"; }
PAY_MIG_DSN="$(dsn migrator_payments 'payments_svc_dev_secret_32_chars!_mig')"
PAY_DSN="$(dsn payments_svc 'payments_svc_dev_secret_32_chars!')"
LEDGER_MIG_DSN="$(dsn migrator_ledger 'ledger_svc_dev_secret_32_chars!_mig')"
LEDGER_DSN="$(dsn ledger_svc 'ledger_svc_dev_secret_32_chars!')"
IDENTITY_MIG_DSN="$(dsn migrator_identity 'identity_svc_dev_secret_32_chars!_mig')"
IDENTITY_DSN="$(dsn identity_svc 'identity_svc_dev_secret_32_chars!')"
# Secretos efímeros solo para arrancar identity aislado (no son los de producción).
SECRETS=(-e "ACCESS_TOKEN_SECRET=l2-$(head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9)-access" -e "REFRESH_TOKEN_SECRET=l2-$(head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9)-refresh")

PASS=0
FAIL=0
check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then echo "  [PASS] $desc"; PASS=$((PASS + 1)); else echo "  [FAIL] $desc (esperado '$expected', obtenido '$actual')"; FAIL=$((FAIL + 1)); fi
}
psql_su() { docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -qAt "$@"; }
cleanup() {
  docker rm -f "$LEDGER_C" "$IDENTITY_C" "$INFRA_C" >/dev/null 2>&1 || true
  psql_su -d postgres -c "DROP DATABASE IF EXISTS \"${L2_DB}\" WITH (FORCE)" >/dev/null 2>&1 || true
}
trap cleanup EXIT
wait_healthy() {
  for _ in $(seq 1 60); do
    if docker exec "$1" /app healthcheck >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  docker logs --tail 20 "$1"
  return 1
}

echo "=== Pruebas L2 de payments-core (base efímera ${L2_DB}) ==="

# 1. Imágenes efímeras construidas desde este repositorio (no se tocan las de servicio).
docker build -q -t "$RUNNER_IMAGE" - >/dev/null <<'EOF'
FROM rust:1.97.0-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler libprotobuf-dev && rm -rf /var/lib/apt/lists/*
RUN rustup component add clippy rustfmt
EOF
docker build -q -t plentypay-ledger:l2 ledger >/dev/null
docker build -q -t plentypay-identity:l2 identity >/dev/null
docker build -q -t plentypay-infra-management:l2 infra-management >/dev/null

# 2. Base efímera con los esquemas, roles y permisos de producción.
psql_su -d postgres -c "CREATE DATABASE \"${L2_DB}\""
psql_su -d "$L2_DB" < postgres-db/init/00-roles-and-schemas.sql >/dev/null

# 3. Dependencias reales: migran contra la base efímera y arrancan con nombres propios.
docker run --rm --network "$NETWORK" -e PP_MIGRATE_DSN="$LEDGER_MIG_DSN" plentypay-ledger:l2 migrate >/dev/null
docker run --rm --network "$NETWORK" "${SECRETS[@]}" -e PP_MIGRATE_DSN="$IDENTITY_MIG_DSN" plentypay-identity:l2 migrate >/dev/null
docker run -d --name "$LEDGER_C" --network "$NETWORK" --read-only --cap-drop ALL \
  -e DATABASE_URL="$LEDGER_DSN" plentypay-ledger:l2 >/dev/null
docker run -d --name "$IDENTITY_C" --network "$NETWORK" --read-only --cap-drop ALL \
  "${SECRETS[@]}" -e PP_DB_DSN="$IDENTITY_DSN" plentypay-identity:l2 >/dev/null
docker run -d --name "$INFRA_C" --network "$NETWORK" --read-only --cap-drop ALL \
  -e PORT=50074 -e ADMIN_PORT=9100 plentypay-infra-management:l2 >/dev/null
for c in "$LEDGER_C" "$IDENTITY_C" "$INFRA_C"; do
  if wait_healthy "$c"; then check "$c arranca sano" "ok" "ok"; else check "$c arranca sano" "ok" "no"; fi
done

mkdir -p payments-core/target/l2
run() {
  docker run --rm --network "$NETWORK" \
    --user "$(id -u):$(id -g)" \
    -e CARGO_HOME=/cargo -e CARGO_TARGET_DIR=/target \
    -v "$HOME/.cargo/registry:/cargo/registry" \
    -v "$PWD/payments-core:/src:ro" -v "$PWD/payments-core/target/l2:/target" \
    -w /src "$@"
}

# 4. Compila y migra dos veces (idempotencia).
set +e
run -e PP_MIGRATE_DSN="$PAY_MIG_DSN" "$RUNNER_IMAGE" sh -c 'cargo build --locked --offline -q && /target/debug/plentypay-payments-core migrate && /target/debug/plentypay-payments-core migrate'
MIG_RC=$?
set -e
check "Migraciones aplican y se pueden reaplicar" "0" "$MIG_RC"
check "Migraciones registradas" "$(ls payments-core/migrations/*.sql | wc -l | tr -d ' ')" "$(psql_su -d "$L2_DB" -c "SELECT count(*) FROM payments._sqlx_migrations WHERE success")"
TABLES="'terminals','intents','payments','attempts','refunds','fee_policies','webhook_events','tenant_status','outbox','processed_events'"
check "payments_svc no tiene DELETE (nada de dinero se borra)" "0" "$(psql_su -d "$L2_DB" -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'payments' AND tablename IN (${TABLES}) AND has_table_privilege('payments_svc', 'payments.' || tablename, 'DELETE')")"
check "RLS activo en las 10 tablas" "10" "$(psql_su -d "$L2_DB" -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'payments' AND c.relrowsecurity AND c.relname IN (${TABLES})")"
check "Las tablas no son de payments_svc (RLS lo alcanza)" "0" "$(psql_su -d "$L2_DB" -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'payments' AND tableowner = 'payments_svc'")"

# 5. Unitarias + L2 contra los servicios efímeros.
set +e
run -e PP_PAYMENTS_TEST_DSN="$PAY_DSN" \
  -e PP_TEST_LEDGER_ADDR="http://${LEDGER_C}:50061" \
  -e PP_TEST_IDENTITY_ADDR="http://${IDENTITY_C}:50060" \
  -e PP_TEST_INFRA_ADDR="http://${INFRA_C}:50074" \
  "$RUNNER_IMAGE" cargo test --locked --offline -q -- --include-ignored --test-threads=8 2>&1 | tee payments-core/target/l2/last-run.txt
TEST_RC=${PIPESTATUS[0]}
set -e
check "cargo test (unitarias + L2 contra servicios efímeros)" "0" "$TEST_RC"
if [ "$TEST_RC" != "0" ]; then
  for c in "$LEDGER_C" "$IDENTITY_C" "$INFRA_C"; do echo "--- $c"; docker logs --tail 15 "$c" 2>&1; done
fi

echo
echo "Resultado: ${PASS} pasaron, ${FAIL} fallaron"
[ "$FAIL" -eq 0 ]
