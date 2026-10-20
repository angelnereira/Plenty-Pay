#!/usr/bin/env bash
# ADR 0019 §5: publica en GitHub Pages (`server.json` de la rama gh-pages) la URL vigente del
# gateway para que las apps instaladas la descubran. No hace nada si ya está publicada.
# Lo corre el temporizador `plentypay-server-url.timer` (scripts/systemd/) cada 2 minutos.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="$("$ROOT/scripts/current-tunnel-url.sh")"
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
