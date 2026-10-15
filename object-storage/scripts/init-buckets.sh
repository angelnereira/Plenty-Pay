#!/bin/sh
# PlentyPay — creación idempotente de buckets y llaves por contenedor (F07.9)
# SPEC: object-storage/SPEC.md §3 (tabla de buckets) y §4.
#
# Una llave por contenedor con permisos SOLO sobre sus buckets (SPEC §3).
# Limita conocida: Garage v2.4 no permite "escribir sin borrar" a nivel de llave
# (DeleteObject es una operación de escritura). La retención "sin borrado" de
# pp-fiscal queda anotada como pendiente en object-storage/README.md.
set -e

GARAGE=/usr/local/bin/garage

echo "=== Aplicando definiciones de buckets y llaves (F07.9) ==="

# 1. Buckets (SPEC §3). Se crean solo si no existen. La cuota de tamaño por
#    bucket es la segunda barrera; el tamaño máximo por objeto lo valida el
#    contenedor dueño antes de pedir la URL prefirmada (R2, presigned-reference.md).
#    Formato: <bucket>:<cuota>
BUCKET_RULES="
pp-catalog-media:2GiB
pp-kyb:5GiB
pp-fiscal:20GiB
pp-receipts:20GiB
pp-exports:50GiB
pp-backups:none
"
echo "$BUCKET_RULES" | while read -r rule; do
  [ -z "$rule" ] && continue
  b="${rule%%:*}"
  quota="${rule##*:}"
  if "$GARAGE" bucket list 2>/dev/null | awk 'NR>1 {print $3}' | grep -qx "$b"; then
    echo "  - Bucket $b ya existe (sin cambios)"
  else
    "$GARAGE" bucket create "$b" >/dev/null 2>&1
    echo "  - Bucket $b creado"
  fi
  # Idempotente: fija la cuota documentada (none = sin restricción de tamaño).
  "$GARAGE" bucket set-quotas --max-size "$quota" "$b" >/dev/null 2>&1
  echo "    - cuota $b: $quota"
done

# 2. Llaves y permisos: <llave>|<bucket>:<permisos>
#    permisos: r=lectura, w=escritura, o=owner (administración del bucket).
#    Las llaves de servicio nunca reciben owner: la administración es de plataforma.
KEY_RULES="
catalog_svc|pp-catalog-media:rw
identity_svc|pp-kyb:rw
fiscal_svc|pp-fiscal:rw
pos_svc|pp-receipts:rw
payroll_svc|pp-receipts:rw
logistics_svc|pp-receipts:rw
analytics_svc|pp-exports:rw
settlement_svc|pp-exports:rw
postgres_svc|pp-backups:rw
nosql_svc|pp-backups:rw
web_svc|pp-catalog-media:r
"

echo "$KEY_RULES" | while IFS='|' read -r key rules; do
  [ -z "$key" ] && continue
  if "$GARAGE" key list 2>/dev/null | awk 'NR>1 {print $3}' | grep -qx "$key"; then
    echo "  - Llave $key ya existe (sin cambios)"
  else
    # Los secretos los genera Garage; en desarrollo se consultan con
    # `garage key info --show-secret <llave>` y en producción se guardan en OpenBao.
    "$GARAGE" key create "$key" >/dev/null 2>&1
    echo "  - Llave $key creada"
  fi

  # Permisos sobre cada bucket declarado (allow es idempotente).
  echo "$rules" | tr ' ' '\n' | while read -r rule; do
    [ -z "$rule" ] && continue
    bucket="${rule%%:*}"
    perms="${rule##*:}"
    ARGS=""
    case "$perms" in *r*) ARGS="$ARGS --read" ;; esac
    case "$perms" in *w*) ARGS="$ARGS --write" ;; esac
    case "$perms" in *o*) ARGS="$ARGS --owner" ;; esac
    # shellcheck disable=SC2086
    "$GARAGE" bucket allow $ARGS --key "$key" "$bucket" >/dev/null 2>&1
    echo "    - $key: $bucket ($perms)"
  done
done

echo "=== Definiciones de buckets y llaves aplicadas con éxito ==="
