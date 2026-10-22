#!/usr/bin/env bash
# ADR 0019 §5: publica en GitHub Pages (`server.json` de la rama gh-pages) la URL vigente del
# gateway para que las apps instaladas la descubran. No hace nada si ya está publicada.
# Lo corre el temporizador `plentypay-server-url.timer` (scripts/systemd/) cada 2 minutos.
#
# ADR 0019 §7 · vigilancia: un túnel rápido puede quedar «Tunnel not found» con el proceso vivo
# (Docker no lo reinicia). Si el gateway responde en local pero el túnel no, dos revisiones
# seguidas (~4 min) reinician el contenedor `tunnel`, se lee la URL nueva y se publica. Si el que
# no responde es el gateway, el túnel no se toca: reiniciarlo no arregla nada.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="${XDG_STATE_HOME:-$HOME/.local/state}/plentypay"
mkdir -p "$STATE"
FAILS_FILE="$STATE/tunnel-failures"
MAX_FAILS="${PP_TUNNEL_MAX_FAILS:-2}"

if URL="$("$ROOT/scripts/current-tunnel-url.sh" 2>"$STATE/tunnel-last-error")"; then
  echo 0 > "$FAILS_FILE"
else
  cause="$(cat "$STATE/tunnel-last-error")"
  local_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8080/healthz || true)"
  if [ "$local_code" != 200 ]; then
    echo "el gateway no responde en local ($local_code): no se reinicia el túnel" >&2
    exit 1
  fi
  n=$(( $(cat "$FAILS_FILE" 2>/dev/null || echo 0) + 1 ))
  echo "$n" > "$FAILS_FILE"
  echo "túnel sin responder ($n/$MAX_FAILS): $cause" >&2
  [ "$n" -ge "$MAX_FAILS" ] || exit 1
  echo "reiniciando el túnel (ADR 0019 §7)" >&2
  docker compose -f "$ROOT/docker-compose.yml" restart tunnel >&2
  echo 0 > "$FAILS_FILE"
  URL=""
  for _ in $(seq 1 18); do
    sleep 5
    if URL="$("$ROOT/scripts/current-tunnel-url.sh" 2>/dev/null)"; then break; fi
    URL=""
  done
  [ -n "$URL" ] || { echo "el túnel reiniciado aún no responde" >&2; exit 1; }
fi
REMOTE="$(git -C "$ROOT" remote get-url origin)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git clone -q --depth 1 --branch gh-pages "$REMOTE" "$TMP/pages"
DOC="{\"api_base_url\": \"$URL\"}"
if [ -f "$TMP/pages/server.json" ] && [ "$(cat "$TMP/pages/server.json")" = "$DOC" ]; then
  exit 0
fi
printf '%s' "$DOC" > "$TMP/pages/server.json"
git -C "$TMP/pages" add server.json
git -C "$TMP/pages" -c user.name="$(git -C "$ROOT" config user.name)" \
  -c user.email="$(git -C "$ROOT" config user.email)" commit -q -m "deploy(server): $URL"
git -C "$TMP/pages" push -q origin gh-pages
echo "server.json → $URL"
