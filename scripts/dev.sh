# scripts/dev.sh — verificación completa del backend (mandato §26).
# Uso: ./scripts/dev.sh [fmt|lint|test|contracts|compose|all]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/.local/bin:$PATH"
TARGET="${1:-all}"

run_fmt() {
  echo "== gofmt =="
  find services contracts/gen -name '*.go' ! -path '*/gen/go/*' -print0 2>/dev/null | xargs -0 -r gofmt -w
  find services/identity -name '*.go' -print0 | xargs -0 -r gofmt -w
  echo "== cargo fmt =="
  find services -name Cargo.toml -execdir cargo fmt --all \;
}

run_lint() {
  echo "== go vet =="
  find services -name go.mod -execdir go vet ./... \;
  echo "== cargo clippy =="
  find services -name Cargo.toml -execdir cargo clippy --all-targets -- -D warnings \;
  echo "== buf lint =="
  (cd contracts && buf lint)
}

run_test() {
  echo "== go test (unit) =="
  find services -name go.mod -execdir go test ./... \;

  echo "== cargo test =="
  find services -name Cargo.toml -execdir cargo test \;

  # Integración con PostgreSQL real (identidad): levantar Postgres del
  # compose si Docker está disponible (con sudo si el socket lo exige).
  if command -v docker >/dev/null 2>&1; then
    DOCKER="docker"
    docker info >/dev/null 2>&1 || DOCKER="sudo docker"
    echo "== postgres (compose) [$DOCKER] =="
    (cd deployment/compose && test -f .env || cp .env.example .env
     $DOCKER compose up -d postgres >/dev/null)
    for i in $(seq 1 20); do
      $DOCKER compose -f deployment/compose/docker-compose.yml exec -T postgres \
        pg_isready -U "$(grep POSTGRES_USER deployment/compose/.env | cut -d= -f2)" >/dev/null 2>&1 && break
      sleep 1
    done
    PGUSER="$(grep POSTGRES_USER deployment/compose/.env | cut -d= -f2)"
    PGPASS="$(grep POSTGRES_PASSWORD deployment/compose/.env | cut -d= -f2)"
    PGDB="$(grep POSTGRES_DB deployment/compose/.env | cut -d= -f2)"
    export IDENTITY_TEST_DATABASE_URL="postgres://${PGUSER}:${PGPASS}@127.0.0.1:5432/${PGDB}?sslmode=disable"
    echo "== go test (integración, PostgreSQL real) =="
    (cd services/identity && go test -tags integration ./...)
  fi
}

run_contracts() {
  echo "== buf lint + generate =="
  (cd contracts && buf lint && buf generate)
  (cd contracts/gen && go build ./... && echo "stubs OK")
}

run_compose() {
  echo "== docker compose config =="
  (cd deployment/compose && test -f .env || cp .env.example .env
   docker compose config --quiet && echo "compose OK")
}

case "$TARGET" in
  fmt) run_fmt ;;
  lint) run_lint ;;
  test) run_test ;;
  contracts) run_contracts ;;
  compose) run_compose ;;
  all) run_fmt; run_lint; run_test; run_contracts; run_compose ;;
  *) echo "uso: dev.sh [fmt|lint|test|contracts|compose|all]"; exit 1 ;;
esac
echo "DEV.SH OK ($TARGET)"
