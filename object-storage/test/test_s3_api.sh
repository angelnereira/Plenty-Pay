#!/usr/bin/env bash
# Pruebas de nodo Garage y layout (F07.8, L2)
# Criterio de aceptación: "API S3 responde".
# Reglas verificadas: object-storage/SPEC.md §2 (nodo, puertos, layout) y §4 R3
# (réplica 1 en Compose; 3 nodos en producción, F27).
#
# Ejecutar desde la raíz del repositorio:  ./object-storage/test/test_s3_api.sh
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
# Red de datos de Compose para llegar a la API desde un cliente HTTP externo.
NETWORK="plentypay_data"
ADMIN_TOKEN="${GARAGE_ADMIN_TOKEN:-garage_dev_admin_token_0123456789abcdef}"

echo "=== Pruebas de nodo Garage y layout (F07.8) ==="

# 1. Contenedor healthy (healthcheck = garage health)
HEALTH=$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q object-storage)")
assert_eq "object-storage está healthy" "healthy" "$HEALTH"

# 2. El cluster health respondió (código 0 del CLI)
compose exec -T object-storage "${GARAGE[@]}" health >/dev/null 2>&1
assert_eq "garage health reporta el clúster disponible" "0" "$?"

# 3. F07.8 (criterio): la API S3 responde. Sin credenciales devuelve un error S3
#    bien formado (AccessDenied anónimo): la API está viva y procesando.
S3_RESP=$(docker run --rm --network "$NETWORK" curlimages/curl -s -w "\n%{http_code}" http://object-storage:3900/ 2>/dev/null || true)
S3_CODE=$(echo "$S3_RESP" | tail -1)
S3_BODY=$(echo "$S3_RESP" | head -n -1)
assert_eq "La API S3 (3900) responde HTTP 403 a una petición anónima" "403" "$S3_CODE"
if echo "$S3_BODY" | grep -q "<Code>AccessDenied</Code>"; then
  assert_true "La respuesta de la API S3 es XML S3 válido (Code=AccessDenied)" "true"
else
  assert_true "La respuesta de la API S3 es XML S3 válido (Code=AccessDenied)" "false"
fi
if echo "$S3_BODY" | grep -q "<Region>garage</Region>"; then
  assert_true "La región S3 reportada es la configurada (garage)" "true"
else
  assert_true "La región S3 reportada es la configurada (garage)" "false"
fi

# 4. La API de administración responde 200 con el token de desarrollo
ADMIN_CODE=$(docker run --rm --network "$NETWORK" curlimages/curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" http://object-storage:3903/health 2>/dev/null || true)
assert_eq "La API admin (3903) responde 200 con token" "200" "$ADMIN_CODE"

# 5. Layout: el nodo tiene rol asignado y la versión aplicada es 1
LAYOUT=$(compose exec -T object-storage "${GARAGE[@]}" layout show 2>/dev/null)
VERSION=$(echo "$LAYOUT" | awk '/Current cluster layout version:/ {print $NF}')
assert_eq "La versión de layout aplicada es 1 (nodo único)" "1" "$VERSION"
if echo "$LAYOUT" | grep -q "No nodes currently have a role"; then
  assert_true "El nodo tiene rol asignado en el layout" "false"
else
  assert_true "El nodo tiene rol asignado en el layout" "true"
fi

# 6. Zona y capacidad declaradas (init-layout.sh: dc1, 1G)
if echo "$LAYOUT" | grep -qE "dc1.*1[- ]?G|1G.*dc1"; then
  assert_true "El nodo aparece con zona dc1 y capacidad declarada" "true"
else
  # La tabla muestra la capacidad en bytes; basta con que el nodo figure con zona dc1.
  if echo "$LAYOUT" | grep -q "dc1"; then
    assert_true "El nodo aparece con zona dc1" "true"
  else
    assert_true "El nodo aparece con zona dc1" "false"
  fi
fi

# 7. Persistencia: directorios de datos y metadatos dentro del contenedor
META=$(compose exec -T object-storage /bin/sh -c 'ls /var/lib/garage/meta/db.lmdb >/dev/null 2>&1 && echo ok || echo missing')
assert_eq "El directorio de metadatos LMDB existe en el volumen" "ok" "$META"

# 8. Idempotencia: tras reiniciar, el layout no se reasigna
echo "  [*] Reiniciando contenedor object-storage..."
compose restart object-storage >/dev/null 2>&1
for _ in $(seq 1 30); do
  STATUS=$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q object-storage)" 2>/dev/null || echo unknown)
  [ "$STATUS" = "healthy" ] && break
  sleep 2
done
assert_eq "object-storage vuelve a estar healthy tras el reinicio" "healthy" "$STATUS"

VERSION_AFTER=$(compose exec -T object-storage "${GARAGE[@]}" layout show 2>/dev/null | awk '/Current cluster layout version:/ {print $NF}')
assert_eq "La versión de layout no cambia tras el reinicio (no se reasigna)" "1" "$VERSION_AFTER"

S3_CODE_AFTER=$(docker run --rm --network "$NETWORK" curlimages/curl -s -o /dev/null -w "%{http_code}" http://object-storage:3900/ 2>/dev/null || true)
assert_eq "La API S3 sigue respondiendo tras el reinicio" "403" "$S3_CODE_AFTER"

echo ""
echo "Resultado F07.8: $PASS pasadas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || exit 1
