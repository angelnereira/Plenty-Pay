#!/usr/bin/env bash
# Imprime la URL pública vigente del gateway (túnel rápido de Cloudflare, ADR 0019) y falla si no
# responde /healthz. La URL cambia en cada reinicio del contenedor `tunnel`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
url="$(docker compose -f "$ROOT/docker-compose.yml" logs --no-log-prefix tunnel 2>/dev/null \
  | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | grep -v '^https://api\.' | tail -1)"
[ -n "$url" ] || { echo "no se encontró la URL del túnel en sus logs" >&2; exit 1; }
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url/healthz" || true)"
[ "$code" = 200 ] || { echo "$url/healthz respondió $code" >&2; exit 1; }
echo "$url"
