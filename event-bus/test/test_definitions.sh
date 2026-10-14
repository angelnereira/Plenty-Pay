#!/usr/bin/env bash
# Pruebas de streams y KV como código (F07.5, L2)
# Criterio de aceptación: "Job aplica definiciones idempotentemente".
# Reglas verificadas: event-bus/SPEC.md §3 (definiciones versionadas) y §4 R2.
#
# Ejecutar desde la raíz del repositorio:  ./event-bus/test/test_definitions.sh
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
NATS=(nats -s localhost:4222 --user admin --password admin_nats_secret)

echo "=== Pruebas de definiciones de Streams y KV como código (F07.5) ==="

# 1. F07.5: los 11 streams declarados en event-bus/streams/ existen con sus subjects
for f in event-bus/streams/*.json; do
  NAME=$(jq -r '.name' "$f")
  SUBJECTS=$(jq -r '.subjects | join(" ")' "$f")
  INFO=$(compose exec -T event-bus "${NATS[@]}" stream info "$NAME" -j 2>/dev/null || true)
  if echo "$INFO" | jq -e '.config.name == "'"$NAME"'"' >/dev/null 2>&1; then
    CONFIGURED=$(echo "$INFO" | jq -r '.config.subjects | sort | join(" ")')
    EXPECTED=$(echo "$SUBJECTS" | tr ' ' '\n' | sort | tr '\n' ' ' | sed 's/ $//')
    assert_eq "Stream $NAME existe con los subjects declarados en $f" "$EXPECTED" "$CONFIGURED"
  else
    assert_eq "Stream $NAME existe con los subjects declarados en $f" "existe" "ausente"
  fi
done

# 2. F07.5: los 3 buckets KV declarados existen con su configuración
for f in event-bus/kv/*.json; do
  BUCKET=$(jq -r '.bucket' "$f")
  HISTORY=$(jq -r '.history // 1' "$f")
  INFO=$(compose exec -T event-bus "${NATS[@]}" kv info "$BUCKET" 2>&1 || true)
  if echo "$INFO" | grep -q "Information for Key-Value Store Bucket $BUCKET"; then
    KEPT=$(echo "$INFO" | awk '/History Kept:/ {print $NF}')
    assert_eq "Bucket KV $BUCKET existe con historial $HISTORY declarado en $f" "$HISTORY" "$KEPT"
  else
    assert_eq "Bucket KV $BUCKET existe" "existe" "ausente"
  fi
done

# 3. F07.5 (criterio): el job aplica las definiciones de forma idempotente
echo "  [*] Reejecutando scripts/init-definitions.sh (1.ª vez)..."
OUT1=$(compose exec -T event-bus /usr/local/bin/scripts/init-definitions.sh 2>&1)
EXIT1=$?
assert_eq "init-definitions.sh termina con código 0 (1.ª ejecución)" "0" "$EXIT1"
UNCHANGED1=$(echo "$OUT1" | grep -c "sin cambios" || true)
STREAMS_TOTAL=$(ls event-bus/streams/*.json | wc -l | tr -d ' ')
KV_TOTAL=$(ls event-bus/kv/*.json | wc -l | tr -d ' ')
assert_eq "La 1.ª reejecución detecta todas las definiciones ya existentes" "$((STREAMS_TOTAL + KV_TOTAL))" "$UNCHANGED1"

echo "  [*] Reejecutando scripts/init-definitions.sh (2.ª vez)..."
OUT2=$(compose exec -T event-bus /usr/local/bin/scripts/init-definitions.sh 2>&1)
EXIT2=$?
assert_eq "init-definitions.sh termina con código 0 (2.ª ejecución)" "0" "$EXIT2"
UNCHANGED2=$(echo "$OUT2" | grep -c "sin cambios" || true)
assert_eq "La 2.ª reejecución sigue sin recrear nada (idempotente)" "$((STREAMS_TOTAL + KV_TOTAL))" "$UNCHANGED2"

# 4. Ningún stream fue recreado: la fecha de creación no cambia
STREAM_NAMES=$(for f in event-bus/streams/*.json; do jq -r '.name' "$f"; done | sort)
BEFORE=""
AFTER=""
for s in $STREAM_NAMES; do
  C=$(compose exec -T event-bus "${NATS[@]}" stream info "$s" -j 2>/dev/null | jq -r '.config.created')
  BEFORE="$BEFORE$s=$C;"
done
echo "  [*] Reejecutando scripts/init-definitions.sh (3.ª vez) para confirmar..."
compose exec -T event-bus /usr/local/bin/scripts/init-definitions.sh >/dev/null 2>&1
for s in $STREAM_NAMES; do
  C=$(compose exec -T event-bus "${NATS[@]}" stream info "$s" -j 2>/dev/null | jq -r '.config.created')
  AFTER="$AFTER$s=$C;"
done
assert_eq "Las fechas de creación de los streams no cambian (no se recrean)" "$BEFORE" "$AFTER"

# 5. KV funcional: put/get con marcador y limpieza (R2: pp_ratelimit con TTL de 1 min)
compose exec -T event-bus "${NATS[@]}" kv put pp_flags test.probe "probe-ok" >/dev/null 2>&1
GOT=$(compose exec -T event-bus "${NATS[@]}" kv get pp_flags test.probe 2>/dev/null | awk 'NF' | tail -1 | tr -d '\r')
assert_eq "KV put/get funciona en el bucket pp_flags" "probe-ok" "$GOT"
compose exec -T event-bus "${NATS[@]}" kv del pp_flags test.probe >/dev/null 2>&1 || true

# 6. El bucket pp_ratelimit conserva el TTL declarado (SPEC §3: 1 min)
RL_INFO=$(compose exec -T event-bus "${NATS[@]}" kv info pp_ratelimit 2>&1 || true)
MAX_AGE=$(echo "$RL_INFO" | awk '/Maximum Age:/ {print $NF}')
assert_eq "Bucket pp_ratelimit conserva el TTL declarado de 1 min" "1m0s" "$MAX_AGE"

echo ""
echo "Resultado F07.5: $PASS pasadas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || exit 1
