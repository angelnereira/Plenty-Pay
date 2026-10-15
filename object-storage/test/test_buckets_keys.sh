#!/usr/bin/env bash
# Pruebas de buckets y llaves por contenedor (F07.9, L2)
# Criterio de aceptación: "Llave de catalog no lee pp-fiscal".
# Reglas verificadas: object-storage/SPEC.md §3 (una llave por contenedor con
# permisos SOLO sobre sus buckets) y §4.
#
# Ejecutar desde la raíz del repositorio:  ./object-storage/test/test_buckets_keys.sh
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

compose() { docker compose "$@"; }
GARAGE=(/usr/local/bin/garage)
NETWORK="plentypay_data"
S3CLI_DIR="$(cd "$(dirname "$0")/s3cli" && pwd)"
S3CLI_BIN="$S3CLI_DIR/s3clibin"
RUNNER_IMAGE="busybox:stable"

# compile_s3cli compila el cliente de prueba (Go stdlib, binario estatico) si falta.
compile_s3cli() {
  if [ ! -x "$S3CLI_BIN" ]; then
    echo "  [*] Compilando el cliente S3 de prueba (Go stdlib)..."
    (cd "$S3CLI_DIR" && CGO_ENABLED=0 go build -o s3clibin .) || return 1
  fi
}
compile_s3cli || { echo "no se pudo compilar el cliente S3 de prueba"; exit 1; }

# s3 <keyId> <secret> <LIST|PUT|GET|DELETE> <bucket> [key]: codigo HTTP
s3() {
  local kid="$1" secret="$2" method="$3" bucket="$4" key="${5:-}" envs=()
  [ -n "${S3_PUT_SIZE:-}" ] && envs+=(-e "S3_PUT_SIZE=$S3_PUT_SIZE")
  docker run --rm --network "$NETWORK" -v "$S3CLI_DIR:/src:ro" "${envs[@]}" \
    "$RUNNER_IMAGE" /src/s3clibin "$kid" "$secret" "$method" "$bucket" "$key" 2>/dev/null | head -1
}

# key_credentials <llave>: imprime "keyId secret"
key_credentials() {
  local name="$1" info kid secret
  info=$(compose exec -T object-storage "${GARAGE[@]}" key info --show-secret "$name" 2>/dev/null)
  kid=$(echo "$info" | awk '/Key ID:/ {print $3}')
  secret=$(echo "$info" | awk '/Secret key:/ {print $3}')
  echo "$kid $secret"
}

echo "=== Pruebas de buckets y llaves por contenedor (F07.9) ==="

# 1. Los 6 buckets del SPEC §3 existen
for b in pp-catalog-media pp-kyb pp-fiscal pp-receipts pp-exports pp-backups; do
  FOUND=$(compose exec -T object-storage "${GARAGE[@]}" bucket list 2>/dev/null | awk 'NR>1 {print $3}' | grep -c "$b" || true)
  assert_eq "Bucket $b declarado en SPEC §3 existe" "1" "$FOUND"
done

# 2. Las 11 llaves por contenedor existen
KEYS="catalog_svc identity_svc fiscal_svc pos_svc payroll_svc logistics_svc analytics_svc settlement_svc postgres_svc nosql_svc web_svc"
for k in $KEYS; do
  FOUND=$(compose exec -T object-storage "${GARAGE[@]}" key list 2>/dev/null | awk 'NR>1 {print $3}' | grep -c "$k" || true)
  assert_eq "Llave $k existe" "1" "$FOUND"
done

# 3. Criterio del paso: la llave de catalog NO lee pp-fiscal
read -r CAT_KID CAT_SECRET <<<"$(key_credentials catalog_svc)"
CODE=$(s3 "$CAT_KID" "$CAT_SECRET" LIST pp-fiscal)
assert_eq "Criterio F07.9: catalog_svc NO puede leer pp-fiscal (403)" "403" "$CODE"

# 4. ...y tampoco el resto de buckets ajenos
for b in pp-kyb pp-receipts pp-exports pp-backups; do
  CODE=$(s3 "$CAT_KID" "$CAT_SECRET" LIST "$b")
  assert_eq "catalog_svc NO puede leer $b (bucket ajeno)" "403" "$CODE"
done

# 5. catalog_svc SÍ puede listar su bucket
CODE=$(s3 "$CAT_KID" "$CAT_SECRET" LIST pp-catalog-media)
assert_eq "catalog_svc puede leer su bucket pp-catalog-media (200)" "200" "$CODE"

# 6. fiscal_svc hace round-trip real en pp-fiscal (PUT 200, GET 200) y limpia
read -r FIS_KID FIS_SECRET <<<"$(key_credentials fiscal_svc)"
CODE=$(s3 "$FIS_KID" "$FIS_SECRET" PUT pp-fiscal "test/f079-probe.bin")
assert_eq "fiscal_svc puede escribir en pp-fiscal (200)" "200" "$CODE"
CODE=$(s3 "$FIS_KID" "$FIS_SECRET" GET pp-fiscal "test/f079-probe.bin")
assert_eq "fiscal_svc puede leer su objeto en pp-fiscal (200)" "200" "$CODE"

# 7. fiscal_svc no puede escribir en pp-exports (bucket ajeno)
CODE=$(s3 "$FIS_KID" "$FIS_SECRET" PUT pp-exports "test/f079-probe.bin")
assert_eq "fiscal_svc NO puede escribir en pp-exports (403)" "403" "$CODE"

# 8. web_svc solo lectura: LIST 200, PUT 403
read -r WEB_KID WEB_SECRET <<<"$(key_credentials web_svc)"
CODE=$(s3 "$WEB_KID" "$WEB_SECRET" LIST pp-catalog-media)
assert_eq "web_svc puede leer pp-catalog-media (solo lectura)" "200" "$CODE"
CODE=$(s3 "$WEB_KID" "$WEB_SECRET" PUT pp-catalog-media "test/web-probe.bin")
assert_eq "web_svc NO puede escribir en pp-catalog-media (403)" "403" "$CODE"

# 9. Limpieza del objeto de prueba
s3 "$FIS_KID" "$FIS_SECRET" DELETE pp-fiscal "test/f079-probe.bin" >/dev/null 2>&1 || true

# 10. Idempotencia: reejecutar el script no recrea llaves ni buckets
OUT=$(compose exec -T object-storage /usr/local/bin/scripts/init-buckets.sh 2>&1)
UNCHANGED=$(echo "$OUT" | grep -c "ya existe" || true)
# 6 buckets + 11 llaves = 17 definiciones detectadas como existentes.
assert_eq "La reejecución detecta las 17 definiciones ya existentes" "17" "$UNCHANGED"

echo ""
echo "Resultado F07.9: $PASS pasadas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || exit 1
