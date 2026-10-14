#!/usr/bin/env bash
# Pruebas de cuentas y permisos por servicio (F07.6, L2)
# Criterio de aceptación: "Servicio no publica fuera de su dominio".
# Reglas verificadas: event-bus/SPEC.md §4 R1 (cada servicio solo publica en
# pp.<su-dominio>.> y pp.audit.<su-nombre>.>; suscribe solo lo que consume).
#
# Ejecutar desde la raíz del repositorio:  ./event-bus/test/test_permissions.sh
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

# pub_exit <usuario> <password> <subject>: código de salida de publicar
pub_exit() {
  local user="$1" pass="$2" subject="$3"
  compose exec -T event-bus nats pub "$subject" "probe" -s localhost:4222 \
    --user "$user" --password "$pass" >/dev/null 2>&1
  echo $?
}

echo "=== Pruebas de permisos por servicio en NATS (F07.6, SPEC R1) ==="

# 1. R1: cada servicio publica en su propio dominio
for pair in "identity_svc:identity_nats_secret:pp.identity" \
            "payments_svc:payments_nats_secret:pp.payments" \
            "ledger_svc:ledger_nats_secret:pp.ledger" \
            "settlement_svc:settlement_nats_secret:pp.settlement" \
            "fiscal_svc:fiscal_nats_secret:pp.fiscal" \
            "catalog_svc:catalog_nats_secret:pp.catalog" \
            "inventory_svc:inventory_nats_secret:pp.inventory" \
            "orders_svc:orders_nats_secret:pp.orders" \
            "pos_svc:pos_nats_secret:pp.pos" \
            "logistics_svc:logistics_nats_secret:pp.logistics" \
            "geo_svc:geo_nats_secret:pp.geo" \
            "payroll_svc:payroll_nats_secret:pp.payroll" \
            "analytics_svc:analytics_nats_secret:pp.analytics" \
            "security_svc:security_nats_secret:pp.security" \
            "gateway_svc:gateway_nats_secret:pp.gateway" \
            "infra_svc:infra_nats_secret:pp.infra"; do
  IFS=':' read -r user pass domain <<<"$pair"
  code=$(pub_exit "$user" "$pass" "${domain}.perm.probe.v1")
  assert_eq "R1: $user puede publicar en su dominio ${domain}.>" "0" "$code"
done

# 2. R1 (criterio del paso): un servicio NO publica fuera de su dominio
DENIED=0
for pair in "identity_svc:identity_nats_secret:pp.ledger" \
            "ledger_svc:ledger_nats_secret:pp.payments" \
            "payments_svc:payments_nats_secret:pp.orders" \
            "catalog_svc:catalog_nats_secret:pp.payroll" \
            "gateway_svc:gateway_nats_secret:pp.ledger" \
            "notifications_svc:notifications_nats_secret:pp.ledger"; do
  IFS=':' read -r user pass domain <<<"$pair"
  code=$(pub_exit "$user" "$pass" "${domain}.perm.denied.v1")
  if [ "$code" != "0" ]; then
    echo "  [PASS] R1: $user NO puede publicar en ${domain}.> (dominio ajeno)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] R1: $user pudo publicar en ${domain}.> sin permiso"
    FAIL=$((FAIL + 1))
    DENIED=$((DENIED + 1))
  fi
done
[ "$DENIED" -eq 0 ] || echo "  (aviso: $DENIED publicaciones cruzadas indebidas)"

# 3. R1: la auditoría la puede firmar cada servicio sobre su propio subject
code=$(pub_exit "identity_svc" "identity_nats_secret" "pp.audit.identity.recorded.v1")
assert_eq "R1: identity_svc puede publicar en pp.audit.identity.>" "0" "$code"
code=$(pub_exit "identity_svc" "identity_nats_secret" "pp.audit.ledger.recorded.v1")
assert_eq "R1: identity_svc NO puede firmar la auditoría de ledger" "1" "$code"

# 4. R1: suscripción fuera de lo consumido se rechaza (ledger solo consumiría _INBOX/$JS.API)
SUB_CODE=$(compose exec -T event-bus timeout 5 nats sub "pp.payments.payment.captured.v1" --count 1 \
  -s localhost:4222 --user ledger_svc --password ledger_nats_secret >/dev/null 2>&1; echo $?)
assert_eq "R1: ledger_svc NO puede suscribir eventos de payments (no los consume)" "1" "$SUB_CODE"

# 5. R1 + R3: KV — solo infra-management administra buckets; gateway solo pp_ratelimit
RL_PUT=0
compose exec -T event-bus nats kv put pp_ratelimit perm.probe ok -s localhost:4222 \
  --user gateway_svc --password gateway_nats_secret >/dev/null 2>&1 || RL_PUT=$?
assert_eq "R1: gateway_svc puede escribir en el bucket pp_ratelimit (límites de tasa)" "0" "$RL_PUT"

FLAGS_PUT=0
compose exec -T event-bus nats kv put pp_flags perm.probe ok -s localhost:4222 \
  --user gateway_svc --password gateway_nats_secret >/dev/null 2>&1 || FLAGS_PUT=$?
assert_eq "R1: gateway_svc NO puede escribir en pp_flags (dominio de infra-management)" "1" "$FLAGS_PUT"

# 6. Limpieza del sujeto de prueba
compose exec -T event-bus nats kv del pp_ratelimit perm.probe -s localhost:4222 \
  --user gateway_svc --password gateway_nats_secret >/dev/null 2>&1 || true
compose exec -T event-bus nats stream purge PP_IDENTITY -f -s localhost:4222 \
  --user admin --password admin_nats_secret >/dev/null 2>&1 || true
compose exec -T event-bus nats stream purge PP_PAYMENTS -f -s localhost:4222 \
  --user admin --password admin_nats_secret >/dev/null 2>&1 || true

echo ""
echo "Resultado F07.6: $PASS pasadas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || exit 1
