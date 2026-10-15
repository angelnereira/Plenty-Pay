#!/usr/bin/env bash
# PlentyPay — Respaldo Base Diario de PostgreSQL (F06.4)
# SPEC: postgres-db/SPEC.md §5 R3 (RPO <= 5 min)
# Ejecuta pg_basebackup con compresión gzip, streaming de WAL y verificación de integridad.
set -euo pipefail

BACKUP_ROOT="${BACKUP_DIR:-/var/lib/postgresql/backup}"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
BACKUP_NAME="base_backup_${TIMESTAMP}"
TARGET_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"

echo "=== Iniciando respaldo base de PostgreSQL: ${BACKUP_NAME} ==="

mkdir -p "${TARGET_DIR}"

# 1. Ejecutar pg_basebackup
# -Ft: formato tar
# -z: compresión gzip
# -Xs: incluye los archivos WAL generados durante el respaldo
# -P: progreso
PGPASSWORD="${POSTGRES_PASSWORD:-postgres_dev_master_password_32ch}" \
  pg_basebackup -h localhost -p 5432 -U postgres -D "${TARGET_DIR}" -Ft -z -Xs -c fast

# 2. Forzar rotación de WAL y archivado inmediato para garantizar RPO
PGPASSWORD="${POSTGRES_PASSWORD:-postgres_dev_master_password_32ch}" \
  psql -h localhost -p 5432 -U postgres -d plentypay -c "SELECT pg_switch_wal();" >/dev/null

# 3. Calcular checksum SHA-256 de base.tar.gz
SHA256="$(sha256sum "${TARGET_DIR}/base.tar.gz" | awk '{print $1}')"
SIZE_BYTES="$(stat -c %s "${TARGET_DIR}/base.tar.gz" 2>/dev/null || stat -f %z "${TARGET_DIR}/base.tar.gz")"

# 4. Generar metadatos del respaldo
cat <<EOF > "${TARGET_DIR}/metadata.json"
{
  "backup_name": "${BACKUP_NAME}",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "format": "tar.gz",
  "size_bytes": ${SIZE_BYTES},
  "sha256": "${SHA256}",
  "wal_streamed": true,
  "wal_archive_dir": "/var/lib/postgresql/wal_archive"
}
EOF

echo "Respaldo base completado con éxito:"
echo "  Directorio: ${TARGET_DIR}"
echo "  Tamaño: ${SIZE_BYTES} bytes"
echo "  SHA-256: ${SHA256}"
