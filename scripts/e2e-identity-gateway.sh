#!/usr/bin/env bash
# E2E REAL (nivel L4): levanta identity y api-gateway como procesos separados y ejercita el flujo
# completo por HTTP → gateway → gRPC → identity.
# Uso normal:            ./scripts/e2e-identity-gateway.sh   (compila con `go build`)
# Con binarios propios:  IDENTITY_BIN=... GATEWAY_BIN=... ./scripts/e2e-identity-gateway.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
IDENTITY_BIN="${IDENTITY_BIN:-}"; GATEWAY_BIN="${GATEWAY_BIN:-}"
if [ -z "$IDENTITY_BIN" ]; then (cd "$ROOT/identity" && go build -o "$TMP/identity" .) || exit 1; IDENTITY_BIN="$TMP/identity"; fi
if [ -z "$GATEWAY_BIN" ];  then (cd "$ROOT/api-gateway" && go build -o "$TMP/gateway" .) || exit 1; GATEWAY_BIN="$TMP/gateway"; fi

export ACCESS_TOKEN_SECRET="e2e-access-secret-at-least-32-characters-long"
export REFRESH_TOKEN_SECRET="e2e-refresh-secret-at-least-32-characters-long"
PORT=50960 ADMIN_PORT=59160 "$IDENTITY_BIN" >"$TMP/identity.log" 2>&1 & IDP=$!
PORT=8980 ADMIN_PORT=59180 IDENTITY_SERVICE_URL=localhost:50960 "$GATEWAY_BIN" >"$TMP/gateway.log" 2>&1 & GWP=$!
cleanup() { kill $IDP $GWP 2>/dev/null; wait $IDP $GWP 2>/dev/null; }
trap cleanup EXIT
for _ in $(seq 1 50); do curl -sf localhost:8980/healthz >/dev/null && break; sleep 0.2; done

PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ok   $1"; else FAIL=$((FAIL+1)); echo "  FAIL $1 (esperaba $2, obtuve $3)"; fi; }
code() { curl -s -o "$TMP/body" -w '%{http_code}' "$@"; }
J='-H Content-Type:application/json'

check "healthz del gateway"                       200 "$(code localhost:8980/healthz)"
check "ruta protegida sin token"                  401 "$(code localhost:8980/v1/me)"
check "registro con rol privilegiado rechazado"   400 "$(code -X POST $J -d '{"email":"x@y.co","password":"contraseña-larga-123","role":"PLATFORM_ADMIN"}' localhost:8980/v1/auth/register)"
check "registro con contraseña corta rechazado"   400 "$(code -X POST $J -d '{"email":"x@y.co","password":"corta"}' localhost:8980/v1/auth/register)"
check "registro válido (CUSTOMER)"                200 "$(code -X POST $J -d '{"email":"ana@test.co","password":"contraseña-larga-123","full_name":"Ana"}' localhost:8980/v1/auth/register)"
check "correo duplicado rechazado"                400 "$(code -X POST $J -d '{"email":"ana@test.co","password":"contraseña-larga-123"}' localhost:8980/v1/auth/register)"
check "login con contraseña incorrecta"           401 "$(code -X POST $J -d '{"email":"ana@test.co","password":"incorrecta-incorrecta"}' localhost:8980/v1/auth/login)"
check "login correcto"                            200 "$(code -X POST $J -d '{"email":"ana@test.co","password":"contraseña-larga-123"}' localhost:8980/v1/auth/login)"
ACCESS=$(sed -E 's/.*"access_token":"([^"]+)".*/\1/' "$TMP/body")
REFRESH=$(sed -E 's/.*"refresh_token":"([^"]+)".*/\1/' "$TMP/body")
check "GET /v1/me con token válido"               200 "$(code -H "Authorization: Bearer $ACCESS" localhost:8980/v1/me)"
check "GET /v1/me con token falsificado"          401 "$(code -H "Authorization: Bearer ${ACCESS}x" localhost:8980/v1/me)"
check "GET /v1/me/permissions"                    200 "$(code -H "Authorization: Bearer $ACCESS" localhost:8980/v1/me/permissions)"
# identity/SPEC.md R10: CUSTOMER ve exactamente wallet y marketplace, con permisos de cliente y ninguno de comercio.
grep -q '"enabled_modules":\["wallet","marketplace"\]' "$TMP/body" && grep -q '"wallet:pay"' "$TMP/body" && ! grep -q '"pos:' "$TMP/body" \
  && { PASS=$((PASS+1)); echo "  ok   CUSTOMER ve wallet+marketplace, tiene wallet:pay y ningún pos:*"; } \
  || { FAIL=$((FAIL+1)); echo "  FAIL módulos de CUSTOMER incorrectos: $(cat "$TMP/body")"; }
check "refresh con refresh token"                 200 "$(code -X POST $J -d "{\"refresh_token\":\"$REFRESH\"}" localhost:8980/v1/auth/refresh)"
check "refresh con un ACCESS token (debe fallar)" 401 "$(code -X POST $J -d "{\"refresh_token\":\"$ACCESS\"}" localhost:8980/v1/auth/refresh)"

echo; echo "$PASS correctas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || { echo "--- logs ---"; tail -n 5 "$TMP/identity.log" "$TMP/gateway.log"; exit 1; }
