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
reason_of() { sed -E 's/.*"reason":"([^"]+)".*/\1/' "$1"; }
J='-H Content-Type:application/json'

check "healthz del gateway"                       200 "$(code localhost:8980/healthz)"
check "ruta protegida sin token"                  401 "$(code localhost:8980/v1/me)"
# Aceptaciones del registro (S-GEN-03): edad, términos y privacidad por separado; mercadeo opcional.
CONSENTS='[{"purpose":"AGE_CONFIRMATION","text_version":"v1","granted":true},{"purpose":"TERMS","text_version":"v1","granted":true},{"purpose":"PRIVACY_DATA_PROCESSING","text_version":"v1","granted":true},{"purpose":"MARKETING","text_version":"v1","granted":false}]'
check "registro con rol privilegiado rechazado"   400 "$(code -X POST $J -d '{"email":"x@y.co","password":"contraseña-larga-123","role":"PLATFORM_ADMIN"}' localhost:8980/v1/auth/register)"
check "registro con contraseña corta rechazado"   400 "$(code -X POST $J -d '{"email":"x@y.co","password":"corta"}' localhost:8980/v1/auth/register)"
# N-DAT-02 / N-DAT-14: sin las aceptaciones obligatorias no se crea la cuenta.
check "registro sin consentimientos rechazado"    400 "$(code -X POST $J -d '{"email":"sin@test.co","password":"contraseña-larga-123"}' localhost:8980/v1/auth/register)"
check "  reason AGE_REQUIREMENT"                        "$(reason_of "$TMP/body")" "AGE_REQUIREMENT"
check "registro sin confirmar edad rechazado"    400 "$(code -X POST $J -d '{"email":"menor@test.co","password":"contraseña-larga-123","consents":[{"purpose":"TERMS","text_version":"v1","granted":true},{"purpose":"PRIVACY_DATA_PROCESSING","text_version":"v1","granted":true}]}' localhost:8980/v1/auth/register)"
check "  reason AGE_REQUIREMENT"                         "$(reason_of "$TMP/body")" "AGE_REQUIREMENT"
check "registro con términos rechazados"         400 "$(code -X POST $J -d '{"email":"noterms@test.co","password":"contraseña-larga-123","consents":[{"purpose":"AGE_CONFIRMATION","text_version":"v1","granted":true},{"purpose":"TERMS","text_version":"v1","granted":false},{"purpose":"PRIVACY_DATA_PROCESSING","text_version":"v1","granted":true}]}' localhost:8980/v1/auth/register)"
check "  reason CONSENT_REQUIRED"                        "$(reason_of "$TMP/body")" "CONSENT_REQUIRED"
check "registro válido (CUSTOMER)"                200 "$(code -X POST $J -d '{"email":"ana@test.co","password":"contraseña-larga-123","full_name":"Ana","consents":'"$CONSENTS"'}' localhost:8980/v1/auth/register)"
check "correo duplicado rechazado"                400 "$(code -X POST $J -d '{"email":"ana@test.co","password":"contraseña-larga-123","consents":'"$CONSENTS"'}' localhost:8980/v1/auth/register)"
check "  reason EMAIL_TAKEN"                              "$(reason_of "$TMP/body")" "EMAIL_TAKEN"
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
# Observabilidad (observability-standards.md §15.3): una petición con traceparent deja el MISMO trace_id y
# request_id en los logs del gateway y de identity; los errores llevan request_id; /metrics responde.
TRACE=4bf92f3577b34da6a3ce929d0e0e4736; RID=0192f0c1-7b2a-7c3d-8e4f-5a6b7c8d9e0f
check "petición trazada"                          200 "$(code -H "Authorization: Bearer $ACCESS" -H "traceparent: 00-$TRACE-00f067aa0ba902b7-01" -H "X-Request-Id: $RID" localhost:8980/v1/me/permissions)"
sleep 0.3
ok_if() { if eval "$2"; then PASS=$((PASS+1)); echo "  ok   $1"; else FAIL=$((FAIL+1)); echo "  FAIL $1"; fi; }
ok_if "gateway registra trace_id y request_id del cliente"  "grep '\"trace_id\":\"$TRACE\"' '$TMP/gateway.log' | grep -q '\"request_id\":\"$RID\"'"
ok_if "identity continúa la misma traza y request_id"       "grep '\"trace_id\":\"$TRACE\"' '$TMP/identity.log' | grep -q '\"request_id\":\"$RID\"'"
check "error con X-Request-Id"                    401 "$(code -H "X-Request-Id: $RID" localhost:8980/v1/me)"
ok_if "el cuerpo de error lleva request_id"                 "grep -q '\"request_id\":\"$RID\"' '$TMP/body'"
ok_if "todo registro es JSON con ts, level, service y msg"  "! grep -vE '^\{\"ts\":\"[0-9T:.-]+Z\",\"level\":\"(debug|info|warn|error)\",\"msg\":' '$TMP/gateway.log' '$TMP/identity.log' | grep -q ."
ok_if "ningún registro contiene tokens ni contraseñas"      "! grep -qE 'eyJ[A-Za-z0-9_-]{5,}\\.|contraseña-larga|$REFRESH' '$TMP/gateway.log' '$TMP/identity.log'"
check "/metrics del gateway (puerto admin)"       200 "$(code localhost:59180/metrics)"
ok_if "/metrics expone pp_build_info y pp_panics_total"     "grep -q 'pp_build_info{service=\"api-gateway\"' '$TMP/body' && grep -q 'pp_panics_total{service=\"api-gateway\"} 0' '$TMP/body'"

echo; echo "$PASS correctas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || { echo "--- logs ---"; tail -n 5 "$TMP/identity.log" "$TMP/gateway.log"; exit 1; }
