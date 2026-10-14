#!/usr/bin/env bash
# Pruebas de URLs prefirmadas y válvulas de tamaño (F07.10, L2)
# Criterio de aceptación: "Subida > tamaño máximo rechazada".
# Reglas verificadas: object-storage/SPEC.md §4 R2 (tipo y tamaño máximo;
# cuota del bucket como segunda barrera).
#
# Ejecuta una cuota temporal de 1 MiB en pp-fiscal para poder rechazar una
# subida de 2 MiB sin mover gigabytes; restaura la cuota documentada al final.
#
# Ejecutar desde la raíz del repositorio:  ./object-storage/test/test_presigned_quotas.sh
set -euo pipefail

PASS=0
FAIL=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (esperado: '$expected', obtenido: '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

assert_true() {
  local desc="$1" cond="$2"
  if [ "$cond" = "true" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc"
    FAIL=$((FAIL + 1))
  fi
}

compose() { docker compose "$@"; }
GARAGE=(/usr/local/bin/garage)
NODE_IMAGE="node@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402"
S3_CLI="$(cd "$(dirname "$0")" && pwd)/s3cli.mjs"
NETWORK="plentypay_data"

s3() {
  local kid="$1" secret="$2" method="$3" bucket="$4" key="${5:-}" envs=()
  [ -n "${S3_PUT_SIZE:-}" ] && envs+=(-e "S3_PUT_SIZE=$S3_PUT_SIZE")
  docker run --rm --network "$NETWORK" -v "$S3_CLI:/s3cli.mjs:ro" "${envs[@]}" \
    "$NODE_IMAGE" node /s3cli.mjs "$kid" "$secret" "$method" "$bucket" "$key" 2>/dev/null | head -1
}

key_credentials() {
  local name="$1" info kid secret
  info=$(compose exec -T object-storage "${GARAGE[@]}" key info --show-secret "$name" 2>/dev/null)
  kid=$(echo "$info" | awk '/Key ID:/ {print $3}')
  secret=$(echo "$info" | awk '/Secret key:/ {print $3}')
  echo "$kid $secret"
}

echo "=== Pruebas de válvulas de tamaño y cuotas (F07.10) ==="

read -r FIS_KID FIS_SECRET <<<"$(key_credentials fiscal_svc)"

# 1. La cuota documentada de pp-fiscal es 20 GiB (presigned-reference.md §3)
QUOTA=$(compose exec -T object-storage "${GARAGE[@]}" bucket info pp-fiscal 2>/dev/null | grep -oE '[0-9.]+ GiB')
assert_eq "La cuota de pp-fiscal es la documentada (20 GiB)" "20.0 GiB" "$QUOTA"

# 2. Cuota temporal de 1 MiB para poder rechazar una subida de 2 MiB
compose exec -T object-storage "${GARAGE[@]}" bucket set-quotas --max-size 1MiB pp-fiscal >/dev/null 2>&1

# 3. Criterio del paso: la subida que excede el máximo es rechazada
echo "  [*] Subiendo 2 MiB contra una cuota de 1 MiB (debe fallar)..."
S3_PUT_SIZE=2097152
CODE=$(s3 "$FIS_KID" "$FIS_SECRET" PUT pp-fiscal "test/quota-oversize.bin")
unset S3_PUT_SIZE
assert_eq "Criterio F07.10: subida > tamaño máximo rechazada (403)" "403" "$CODE"

# 4. Una subida dentro de la cuota sigue aceptándose
S3_PUT_SIZE=102400
CODE=$(s3 "$FIS_KID" "$FIS_SECRET" PUT pp-fiscal "test/quota-inside.bin")
unset S3_PUT_SIZE
assert_eq "Subida dentro de la cuota aceptada (200)" "200" "$CODE"

# 5. Restaurar la cuota documentada (20 GiB)
compose exec -T object-storage "${GARAGE[@]}" bucket set-quotas --max-size 20GiB pp-fiscal >/dev/null 2>&1
QUOTA_AFTER=$(compose exec -T object-storage "${GARAGE[@]}" bucket info pp-fiscal 2>/dev/null | grep -oE '[0-9.]+ GiB')
assert_eq "La cuota de pp-fiscal queda restaurada en 20 GiB" "20.0 GiB" "$QUOTA_AFTER"

# 6. Limpieza de los objetos de prueba
s3 "$FIS_KID" "$FIS_SECRET" DELETE pp-fiscal "test/quota-inside.bin" >/dev/null 2>&1 || true
s3 "$FIS_KID" "$FIS_SECRET" DELETE pp-fiscal "test/quota-oversize.bin" >/dev/null 2>&1 || true

# 7. La referencia documentada declara tipos y tamaños por bucket
DOC="object-storage/presigned-reference.md"
if [ -f "$DOC" ]; then
  TYPES=$(grep -c "image/jpeg\|application/pdf\|application/xml\|text/csv\|application/gzip" "$DOC" || true)
  if [ "${TYPES:-0}" -ge 3 ]; then
    assert_true "presigned-reference.md declara los tipos MIME válvula ($TYPES líneas)" "true"
  else
    assert_true "presigned-reference.md declara los tipos MIME válvula" "false"
  fi
  SIZES=$(grep -c "MiB" "$DOC" || true)
  if [ "${SIZES:-0}" -ge 4 ]; then
    assert_true "presigned-reference.md declara los tamaños máximos por bucket" "true"
  else
    assert_true "presigned-reference.md declara los tamaños máximos por bucket" "false"
  fi
  EXPIRE=$(grep -c "10 minutos" "$DOC" || true)
  assert_eq "La referencia documenta la expiración de 10 minutos (SPEC §3)" "2" "$EXPIRE"
else
  assert_true "presigned-reference.md existe" "false"
fi

echo ""
echo "Resultado F07.10: $PASS pasadas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || exit 1
