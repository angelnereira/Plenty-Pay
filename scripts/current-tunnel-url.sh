#!/usr/bin/env bash
# Imprime la URL pública vigente del gateway (túnel rápido de Cloudflare, ADR 0019) y falla si no
# responde /healthz. La URL cambia en cada reinicio del contenedor `tunnel`.
#
# Fuente principal: el endpoint /quicktunnel del servidor de métricas de cloudflared (puerto 20241,
# dentro del contenedor). Los logs no son fiables: en esta máquina `docker logs` sin --tail solo
# devuelve el primer archivo del driver `local` y la línea con la URL quedaba fuera (2026-10-21).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="$(docker compose -f "$ROOT/docker-compose.yml" ps -q tunnel)"
[ -n "$CONTAINER" ] || { echo "el contenedor tunnel no está corriendo" >&2; exit 1; }
host="$(docker run --rm --network "container:$CONTAINER" busybox:stable \
  wget -qO- http://127.0.0.1:20241/quicktunnel 2>/dev/null \
  | sed -nE 's/.*"hostname":"([a-z0-9.-]+\.trycloudflare\.com)".*/\1/p' || true)"
if [ -n "$host" ]; then
  url="https://$host"
else
  url="$(docker logs --tail 2000 "$CONTAINER" 2>&1 \
    | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | grep -v '^https://api\.' | tail -1)"
fi
[ -n "$url" ] || { echo "no se encontró la URL del túnel" >&2; exit 1; }
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url/healthz" || true)"
[ "$code" = 200 ] || { echo "$url/healthz respondió $code" >&2; exit 1; }
echo "$url"
