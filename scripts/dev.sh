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
  echo "== go test =="
  find services -name go.mod -execdir go test ./... \;
  echo "== cargo test =="
  find services -name Cargo.toml -execdir cargo test \;
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
