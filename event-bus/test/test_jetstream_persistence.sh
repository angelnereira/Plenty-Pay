#!/usr/bin/env bash
# Pruebas de JetStream persistente (F07.4, L2)
# Criterio de aceptación: "Stream sobrevive reinicio".
# Reglas verificadas: event-bus/SPEC.md §4 (R2 configuración persistente en volumen).
#
# Ejecutar desde la raíz del repositorio:  ./event-bus/test/test_jetstream_persistence.sh
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

echo "=== Pruebas de JetStream persistente en event-bus (F07.4) ==="

# 0. Precondición: contenedor saludable
HEALTH=$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q event-bus)")
assert_eq "event-bus está healthy antes de las pruebas" "healthy" "$HEALTH"

# 1. F07.4: JetStream habilitado (el endpoint /jsz solo responde con config si lo está)
JSZ=$(compose exec -T event-bus sh -c 'wget -qO- http://localhost:8222/jsz 2>/dev/null' || true)
STORE_DIR=$(echo "$JSZ" | jq -r '.config.store_dir // ""')
MAX_MEM=$(echo "$JSZ" | jq -r '.config.max_memory // 0')
NUM_STREAMS=$(echo "$JSZ" | jq -r '.streams // 0')
assert_eq "JetStream está habilitado con store_dir /data/jetstream/jetstream (nats.conf)" "/data/jetstream/jetstream" "$STORE_DIR"
assert_eq "JetStream respeta max_mem 512MB de nats.conf" "536870912" "$MAX_MEM"
if [ "${NUM_STREAMS:-0}" -ge 11 ]; then
  assert_true "El servidor reporta los $NUM_STREAMS streams declarados en event-bus/streams/" "true"
else
  assert_true "El servidor reporta los streams declarados en event-bus/streams/" "false"
fi

# 2. F07.4: el directorio de persistencia existe dentro del contenedor
STORE=$(compose exec -T event-bus sh -c 'ls -d /data/jetstream 2>/dev/null || echo missing' | tr -d '\r')
assert_eq "store_dir /data/jetstream existe en el contenedor" "/data/jetstream" "$STORE"

# 3. Persistencia: publicar un mensaje marcador, reiniciar y verificar que sigue
STREAM="PP_IDENTITY"
SUBJECT="pp.identity.persistence.probe.v1"
MARKER="persistence-probe-$(date +%s)"

BEFORE=$(compose exec -T event-bus nats stream info "$STREAM" -s localhost:4222 --user admin --password admin_nats_secret -j 2>/dev/null | jq '.state.messages')
echo "  [*] Mensajes en $STREAM antes de publicar: $BEFORE"

compose exec -T event-bus nats pub "$SUBJECT" "$MARKER" -s localhost:4222 --user admin --password admin_nats_secret >/dev/null 2>&1

AFTER_PUB=$(compose exec -T event-bus nats stream info "$STREAM" -s localhost:4222 --user admin --password admin_nats_secret -j 2>/dev/null | jq '.state.messages')
assert_eq "El mensaje publicado queda almacenado en el stream" "$((BEFORE + 1))" "$AFTER_PUB"

# 4. Reinicio completo del contenedor (el volumen nats-data debe conservar el estado)
echo "  [*] Reiniciando contenedor event-bus..."
compose restart event-bus >/dev/null 2>&1

# Esperar a que vuelva a estar healthy
for _ in $(seq 1 30); do
  STATUS=$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q event-bus)" 2>/dev/null || echo unknown)
  [ "$STATUS" = "healthy" ] && break
  sleep 2
done
assert_eq "event-bus vuelve a estar healthy tras el reinicio" "healthy" "$STATUS"

# 5. F07.4 (criterio): el stream y su mensaje sobreviven el reinicio
AFTER_RESTART=$(compose exec -T event-bus nats stream info "$STREAM" -s localhost:4222 --user admin --password admin_nats_secret -j 2>/dev/null | jq '.state.messages')
assert_eq "El conteo de mensajes de $STREAM sobrevive el reinicio" "$AFTER_PUB" "$AFTER_RESTART"

# El mensaje marcador sigue almacenado: se recupera por su número de secuencia.
LAST_SEQ=$(compose exec -T event-bus nats stream info "$STREAM" -s localhost:4222 --user admin --password admin_nats_secret -j 2>/dev/null | jq '.state.last_seq')
STORED=$(compose exec -T event-bus nats stream get "$STREAM" "$LAST_SEQ" -s localhost:4222 --user admin --password admin_nats_secret 2>/dev/null | grep -c "$MARKER" || true)
assert_eq "El mensaje marcador publicado sigue almacenado tras el reinicio" "1" "$STORED"

# 6. Limpieza: purgar el stream de prueba (en desarrollo no hay tráfico real)
compose exec -T event-bus nats stream purge "$STREAM" -f -s localhost:4222 --user admin --password admin_nats_secret >/dev/null 2>&1 || true
PURGED=$(compose exec -T event-bus nats stream info "$STREAM" -s localhost:4222 --user admin --password admin_nats_secret -j 2>/dev/null | jq '.state.messages')
assert_eq "Stream de prueba purgado tras la verificación" "0" "$PURGED"

echo ""
echo "Resultado F07.4: $PASS pasadas, $FAIL fallidas"
[ "$FAIL" -eq 0 ] || exit 1
