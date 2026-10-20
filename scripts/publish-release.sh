#!/usr/bin/env bash
# Publica una versión de flutter_app después de cada push a main (F02.7):
#   1. sube la versión de flutter_app/pubspec.yaml y la empuja a main;
#   2. compila web, Linux y Android contra la API de producción (scripts/build-release.sh); el
#      bundle web queda servido al instante por el contenedor `web` (web/static/app);
#   3. verifica que los APK estén firmados con la MISMA llave que la versión anterior (si no, las
#      apps instaladas no podrían actualizarse) y se niega a publicar si difiere;
#   4. publica el bundle en GitHub Pages (/Plenty-Pay/);
#   5. crea la etiqueta y el release de GitHub con instaladores y SHA256SUMS.
#
# Se ejecuta en la máquina de producción porque la CI de GitHub no corre mientras la cuenta tenga
# un bloqueo de facturación (2026-10-20). Las llaves de firma nunca van al repositorio.
#
# Uso: ./scripts/publish-release.sh <patch|minor|major> <notas.md>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/flutter_app"
OUT="$ROOT/output"
BUMP="${1:?indica patch, minor o major}"
NOTES="${2:?indica el archivo de notas del release (markdown)}"
[ -f "$NOTES" ] || { echo "no existe $NOTES"; exit 1; }
APKSIGNER="${APKSIGNER:-$(ls -d "$HOME"/Android/Sdk/build-tools/*/apksigner 2>/dev/null | tail -1)}"
[ -x "$APKSIGNER" ] || { echo "falta apksigner (Android build-tools)"; exit 1; }

cd "$ROOT"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "publica desde main"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "hay cambios sin commitear: primero commit y push"; exit 1; }
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main local no coincide con origin/main: haz push primero"; exit 1; }

# Llave de la versión publicada anterior (las apps instaladas solo aceptan esa).
PREV_TAG="$(gh release list --limit 1 --json tagName -q '.[0].tagName')"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
gh release download "$PREV_TAG" -p '*arm64-v8a.apk' -D "$TMP" >/dev/null
EXPECTED_SIGNER="$("$APKSIGNER" verify --print-certs "$TMP"/*.apk | sed -n 's/.*certificate SHA-256 digest: //p' | head -1)"
[ -n "$EXPECTED_SIGNER" ] || { echo "no se pudo leer la firma de $PREV_TAG"; exit 1; }

# 1. Versión
CURRENT="$(sed -nE 's/^version: ([0-9]+)\.([0-9]+)\.([0-9]+)\+([0-9]+).*/\1 \2 \3 \4/p' "$APP/pubspec.yaml")"
read -r MA MI PA BUILD <<<"$CURRENT"
case "$BUMP" in
  major) MA=$((MA + 1)); MI=0; PA=0 ;;
  minor) MI=$((MI + 1)); PA=0 ;;
  patch) PA=$((PA + 1)) ;;
  *) echo "BUMP inválido: $BUMP"; exit 1 ;;
esac
VERSION="$MA.$MI.$PA"; BUILD=$((BUILD + 1))
sed -i -E "s/^version: .*/version: $VERSION+$BUILD/" "$APP/pubspec.yaml"
git add "$APP/pubspec.yaml"
git commit -q -m "chore(release): bump version to $VERSION"
git push -q origin main
echo "=== versión $VERSION+$BUILD ==="

# 2. Builds (web queda servida por `web` al terminar)
"$ROOT/scripts/build-release.sh" web linux android

# 3. Firma
for apk in "$OUT"/android/*.apk; do
  got="$("$APKSIGNER" verify --print-certs "$apk" | sed -n 's/.*certificate SHA-256 digest: //p' | head -1)"
  [ "$got" = "$EXPECTED_SIGNER" ] || { echo "ERROR: $(basename "$apk") firmado con otra llave ($got); no se publica"; exit 1; }
done
echo "  firma de los APK = la de $PREV_TAG"

# 4. GitHub Pages
PAGES="$TMP/pages"; mkdir -p "$PAGES"
tar -xzf "$OUT/web/plentypay-web-$VERSION.tar.gz" -C "$PAGES"
sed -i 's|<base href="/">|<base href="/Plenty-Pay/">|' "$PAGES/index.html"
cp "$PAGES/index.html" "$PAGES/404.html"; touch "$PAGES/.nojekyll"
(cd "$PAGES" && git init -q && git checkout -q -b gh-pages && git add -A \
  && git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" commit -q -m "deploy(web): v$VERSION" \
  && git push -q -f "$(git -C "$ROOT" remote get-url origin)" gh-pages)
echo "  GitHub Pages actualizado"

# 5. Release (un solo SHA256SUMS: GitHub no admite dos assets con el mismo nombre)
cat "$OUT"/android/SHA256SUMS "$OUT"/linux/SHA256SUMS "$OUT"/web/SHA256SUMS > "$TMP/SHA256SUMS"
gh release create "v$VERSION" --target main --title "PlentyPay v$VERSION" --notes-file "$NOTES" \
  "$OUT"/android/*.apk "$OUT"/android/*.aab "$OUT"/linux/*.tar.gz "$OUT"/web/*.tar.gz "$TMP/SHA256SUMS"
echo "=== publicado v$VERSION ==="
