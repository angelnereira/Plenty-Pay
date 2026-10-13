#!/usr/bin/env bash
# Test de Respaldo Base y Archivador de WAL (F06.4, L2)
# Criterio: Respaldo diario generado, comprimido, con streaming de WAL y verificación SHA-256.
set -euo pipefail

PASS=0
FAIL=0

check() {
  local desc="$1"
  local expected_exit="$2"
  shift 2
  set +e
  output="$("$@" 2>&1)"
  exit_code=$?
  set -e

  if [ "$exit_code" -eq "$expected_exit" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (código esperado: $expected_exit, obtenido: $exit_code)"
    echo "         Salida: $output"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Ejecutando pruebas de Respaldo Base y WAL (F06.4) ==="

# 1. Ejecutar el script de respaldo
check "Ejecución del script de respaldo base exitosa" 0 \
  docker compose exec -T postgres-db /usr/local/bin/scripts/backup.sh

# 2. Verificar existencia de respaldos
latest_backup=$(docker compose exec -T postgres-db sh -c "ls -td /var/lib/postgresql/backup/base_backup_* | head -n 1" | tr -d '\r')
if [ -n "$latest_backup" ]; then
  echo "  [PASS] Directorio de respaldo encontrado: $latest_backup"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] No se encontró directorio de respaldo en /var/lib/postgresql/backup"
  FAIL=$((FAIL + 1))
  exit 1
fi

# 3. Verificar archivos base.tar.gz, backup_manifest y metadata.json
check "Archivo base.tar.gz presente y no vacío" 0 \
  docker compose exec -T postgres-db test -s "${latest_backup}/base.tar.gz"

check "Archivo backup_manifest presente" 0 \
  docker compose exec -T postgres-db test -s "${latest_backup}/backup_manifest"

check "Archivo metadata.json presente y legible" 0 \
  docker compose exec -T postgres-db test -s "${latest_backup}/metadata.json"

# 4. Verificar integridad SHA-256
stored_sha=$(docker compose exec -T postgres-db cat "${latest_backup}/metadata.json" | jq -r .sha256 | tr -d '\r')
actual_sha=$(docker compose exec -T postgres-db sha256sum "${latest_backup}/base.tar.gz" | awk '{print $1}' | tr -d '\r')

if [ "$stored_sha" = "$actual_sha" ] && [ -n "$stored_sha" ]; then
  echo "  [PASS] Integridad SHA-256 verificada: $stored_sha"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Discrepancia SHA-256 (almacenado: $stored_sha, calculado: $actual_sha)"
  FAIL=$((FAIL + 1))
fi

# 5. Verificar archivado continuo de WAL
wal_count=$(docker compose exec -T postgres-db sh -c "ls -1 /var/lib/postgresql/wal_archive | wc -l" | tr -d '\r')
if [ "$wal_count" -gt 0 ]; then
  echo "  [PASS] Archivador de WAL activo con $wal_count segmentos archivados"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] No se encontraron segmentos WAL en /var/lib/postgresql/wal_archive"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "Resultado: $PASS pruebas exitosas, $FAIL fallidas."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
