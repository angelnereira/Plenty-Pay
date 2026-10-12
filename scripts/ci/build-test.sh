#!/usr/bin/env bash
# Etapa 2 de CI: build y pruebas L0 + L1 por contenedor afectado o todos (docs/standards/delivery-pipeline.md §2).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MODE="${1:-all}"
BASE="${2:-origin/main}"
ERR=0

test_go() {
  local dir="$1"
  echo "--- [Go] Probando $dir ---"
  (cd "$dir" && go vet ./... && go test -race ./...) || ERR=$((ERR+1))
}

test_rust() {
  local dir="$1"
  echo "--- [Rust] Probando $dir ---"
  (cd "$dir" && cargo check && cargo test) || ERR=$((ERR+1))
}

test_flutter() {
  echo "--- [Flutter] Probando flutter_app ---"
  (cd flutter_app && flutter analyze && flutter test) || ERR=$((ERR+1))
}

test_ledger() {
  echo "--- [Ledger] Probando invariantes del ledger ---"
  (cd scripts/ledger-tests && npm test) || ERR=$((ERR+1))
}

if [ "$MODE" = "all" ]; then
  echo "=== Modo: todos los contenedores activos ==="
  # Go containers
  for d in */go.mod; do
    [ -f "$d" ] || continue
    test_go "$(dirname "$d")"
  done

  # Rust containers
  for d in */Cargo.toml; do
    [ -f "$d" ] || continue
    test_rust "$(dirname "$d")"
  done

  # Flutter app
  if [ -f "flutter_app/pubspec.yaml" ]; then
    test_flutter
  fi

  # Ledger tests
  if [ -d "scripts/ledger-tests" ]; then
    test_ledger
  fi

elif [ "$MODE" = "affected" ]; then
  echo "=== Modo: contenedores afectados respecto a $BASE ==="
  # Determinar base de comparación válida
  if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
    BASE="HEAD~1"
  fi

  CHANGED=$(git diff --name-only "$BASE" HEAD 2>/dev/null || git status --porcelain | awk '{print $2}')
  echo "Archivos modificados:"
  echo "$CHANGED" | sed 's/^/  /'

  TEST_FLUTTER=0
  TEST_LEDGER=0
  declare -A TESTED_GO=()
  declare -A TESTED_RUST=()

  # Si cambiaron contratos de red, se prueban todos los consumidores declarados
  if echo "$CHANGED" | grep -qE '^network-contracts/'; then
    echo "  Cambiaron contratos de red: marcando todos los consumidores activos..."
    while IFS= read -r line; do
      c=$(echo "$line" | awk '{print $1}')
      [ -n "$c" ] || continue
      case "$c" in \#*) continue;; esac
      if [ -f "$c/go.mod" ]; then TESTED_GO["$c"]=1; fi
      if [ -f "$c/Cargo.toml" ]; then TESTED_RUST["$c"]=1; fi
    done < network-contracts/consumers.txt
  fi

  for file in $CHANGED; do
    top=$(echo "$file" | cut -d/ -f1)
    if [ "$top" = "flutter_app" ]; then
      TEST_FLUTTER=1
    elif [ "$top" = "ledger" ] || [ "$file" = "scripts/ledger-tests" ]; then
      TEST_LEDGER=1
      if [ -f "ledger/Cargo.toml" ]; then TESTED_RUST["ledger"]=1; fi
    elif [ -f "$top/go.mod" ]; then
      TESTED_GO["$top"]=1
    elif [ -f "$top/Cargo.toml" ]; then
      TESTED_RUST["$top"]=1
    fi
  done

  for c in "${!TESTED_GO[@]}"; do
    test_go "$c"
  done

  for c in "${!TESTED_RUST[@]}"; do
    test_rust "$c"
  done

  if [ "$TEST_FLUTTER" -eq 1 ]; then
    test_flutter
  fi

  if [ "$TEST_LEDGER" -eq 1 ]; then
    test_ledger
  fi
else
  echo "Modo desconocido: $MODE (usar 'all' o 'affected')"
  exit 1
fi

if [ "$ERR" -gt 0 ]; then
  echo "ERROR: Fallaron $ERR prueba(s)"
  exit 1
fi

echo "build-test OK"
