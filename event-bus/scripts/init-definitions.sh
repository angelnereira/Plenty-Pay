#!/usr/bin/env bash
# PlentyPay — Aplicación idempotente de Streams y KV en NATS JetStream (F07.5)
# SPEC: event-bus/SPEC.md §3
set -euo pipefail

NATS_ADDR="${NATS_TARGET_ADDR:-localhost:4222}"
ADMIN_USER="${NATS_ADMIN_USER:-admin}"
ADMIN_PASS="${NATS_ADMIN_PASSWORD:-admin_nats_secret}"
STREAMS_DIR="${STREAMS_DIR:-/etc/nats/streams}"
KV_DIR="${KV_DIR:-/etc/nats/kv}"

echo "=== Aplicando definiciones de Streams y KV en NATS JetStream ==="

# 1. Esperar a que el servidor NATS esté listo
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if nats rtt -s "$NATS_ADDR" --user "$ADMIN_USER" --password "$ADMIN_PASS" >/dev/null 2>&1; then
    echo "  [*] Servidor NATS disponible en $NATS_ADDR"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "  [!] Error: NATS no respondió tras $MAX_ATTEMPTS intentos"
  exit 1
fi

# 2. Aplicar Streams de forma idempotente
echo "  [*] Verificando y aplicando streams desde ${STREAMS_DIR}..."
for stream_file in "$STREAMS_DIR"/*.json; do
  [ -f "$stream_file" ] || continue
  STREAM_NAME="$(jq -r '.name' "$stream_file")"
  if nats stream info "$STREAM_NAME" -s "$NATS_ADDR" --user "$ADMIN_USER" --password "$ADMIN_PASS" >/dev/null 2>&1; then
    echo "    - Stream $STREAM_NAME ya existe (sin cambios)"
  else
    echo "    - Creando stream $STREAM_NAME desde $(basename "$stream_file")..."
    nats stream add --config "$stream_file" -s "$NATS_ADDR" --user "$ADMIN_USER" --password "$ADMIN_PASS" >/dev/null
    echo "    - Stream $STREAM_NAME creado con éxito"
  fi
done

# 3. Aplicar KV Buckets de forma idempotente
echo "  [*] Verificando y aplicando KV buckets desde ${KV_DIR}..."
for kv_file in "$KV_DIR"/*.json; do
  [ -f "$kv_file" ] || continue
  BUCKET_NAME="$(jq -r '.bucket' "$kv_file")"
  HISTORY="$(jq -r '.history // 1' "$kv_file")"
  TTL="$(jq -r '.ttl // 0' "$kv_file")"
  REPLICAS="$(jq -r '.num_replicas // 1' "$kv_file")"

  if nats kv info "$BUCKET_NAME" -s "$NATS_ADDR" --user "$ADMIN_USER" --password "$ADMIN_PASS" >/dev/null 2>&1; then
    echo "    - Bucket KV $BUCKET_NAME ya existe (sin cambios)"
  else
    echo "    - Creando bucket KV $BUCKET_NAME (historial: $HISTORY, TTL: $TTL)..."
    KV_ARGS=("--history=$HISTORY" "--replicas=$REPLICAS")
    if [ "$TTL" != "0" ] && [ -n "$TTL" ]; then
      KV_ARGS+=("--ttl=$TTL")
    fi
    nats kv add "$BUCKET_NAME" "${KV_ARGS[@]}" -s "$NATS_ADDR" --user "$ADMIN_USER" --password "$ADMIN_PASS" >/dev/null
    echo "    - Bucket KV $BUCKET_NAME creado con éxito"
  fi
done

echo "=== Definiciones de Streams y KV aplicadas con éxito ==="
