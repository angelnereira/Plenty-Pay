#!/usr/bin/env bash
# Hace cumplir ADR 0010: comprobaciones de higiene y gobernanza del repositorio.
# Etapa 1 de CI (docs/standards/delivery-pipeline.md §2).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== 1. Verificación de aislamiento (ADR 0002/0016) ==="
./scripts/check-isolation.sh

echo "=== 2. Verificación de documentación y consistencia (ADR 0010) ==="
./scripts/check-docs.sh

echo "=== 3. Verificación de sincronización de contratos proto (ADR 0004) ==="
./scripts/sync-protos.sh --check

echo "=== 4. Detección de secretos (gitleaks) ==="
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect -c .gitleaks.toml -v
else
  echo "  AVISO: gitleaks no está instalado en el PATH; omitiendo verificación local"
fi

echo "repo-checks OK"
