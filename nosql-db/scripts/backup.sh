#!/usr/bin/env bash
# PlentyPay — Respaldo de ScyllaDB mediante nodetool snapshot (F07.3)
# SPEC: nosql-db/SPEC.md §4 R3
set -euo pipefail

BACKUP_ROOT="${BACKUP_DIR:-/var/lib/scylla/backup}"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
SNAPSHOT_TAG="scylla_snapshot_${TIMESTAMP}"
TARGET_DIR="${BACKUP_ROOT}/${SNAPSHOT_TAG}"

echo "=== Iniciando respaldo snapshot de ScyllaDB: ${SNAPSHOT_TAG} ==="
mkdir -p "${TARGET_DIR}/data"

# 1. Ejecutar snapshot consistente por keyspaces
KEYSPACES="catalog_attrs geo_tracks analytics_events"
for ks in $KEYSPACES; do
  echo "  [*] Creando snapshot para keyspace $ks..."
  nodetool snapshot -t "${SNAPSHOT_TAG}" "$ks"
done

# 2. Recolectar archivos SSTable de los snapshots
for ks in $KEYSPACES; do
  mkdir -p "${TARGET_DIR}/data/${ks}"
  find /var/lib/scylla/data/"${ks}" -type d -name "${SNAPSHOT_TAG}" | while read -r sdir; do
    table_dir="$(dirname "$(dirname "$sdir")")"
    table_name="$(basename "$table_dir")"
    mkdir -p "${TARGET_DIR}/data/${ks}/${table_name}"
    cp -r "${sdir}"/* "${TARGET_DIR}/data/${ks}/${table_name}/" 2>/dev/null || true
  done
done

# 3. Empaquetar y comprimir
echo "  [*] Comprimiendo archivos de respaldo..."
tar -czf "${TARGET_DIR}/snapshot.tar.gz" -C "${TARGET_DIR}/data" .
rm -rf "${TARGET_DIR}/data"

# 4. Calcular checksum y metadatos
SHA256="$(sha256sum "${TARGET_DIR}/snapshot.tar.gz" | awk '{print $1}')"
SIZE_BYTES="$(stat -c %s "${TARGET_DIR}/snapshot.tar.gz" 2>/dev/null || stat -f %z "${TARGET_DIR}/snapshot.tar.gz")"

cat <<EOF > "${TARGET_DIR}/metadata.json"
{
  "backup_name": "${SNAPSHOT_TAG}",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "keyspaces": ["catalog_attrs", "geo_tracks", "analytics_events"],
  "format": "tar.gz",
  "size_bytes": ${SIZE_BYTES},
  "sha256": "${SHA256}"
}
EOF

# 5. Limpiar snapshot en ScyllaDB
for ks in $KEYSPACES; do
  nodetool clearsnapshot -t "${SNAPSHOT_TAG}" "$ks" >/dev/null 2>&1 || true
done

echo "Respaldo ScyllaDB completado con éxito:"
echo "  Directorio: ${TARGET_DIR}"
echo "  Tamaño: ${SIZE_BYTES} bytes"
echo "  SHA-256: ${SHA256}"
