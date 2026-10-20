#!/usr/bin/env bash
# Despliega automáticamente la versión compilada de Flutter Web a GitHub Pages (rama gh-pages).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/flutter_app"
BUILD_DIR="$APP/build/web"

echo "=== 1. Compilando Flutter Web para GitHub Pages (/Plenty-Pay/) ==="
cd "$APP"
flutter pub get
flutter build web --release --base-href /Plenty-Pay/

echo "=== 2. Configurando artefactos para GitHub Pages (SPA 404 + .nojekyll) ==="
cp "$BUILD_DIR/index.html" "$BUILD_DIR/404.html"
touch "$BUILD_DIR/.nojekyll"

echo "=== 3. Publicando en la rama gh-pages de GitHub ==="
TMP_PAGES="$(mktemp -d)"
trap 'rm -rf "$TMP_PAGES"' EXIT

cp -r "$BUILD_DIR"/* "$BUILD_DIR"/.nojekyll "$TMP_PAGES"/

cd "$TMP_PAGES"
git init
git config user.name "$(git -C "$ROOT" config user.name || echo 'PlentyPay Deployer')"
git config user.email "$(git -C "$ROOT" config user.email || echo 'bot@plentypay.app')"
git checkout -b gh-pages
git add -A
git commit -m "deploy(web): automated GitHub Pages release from main"
git remote add origin "$(git -C "$ROOT" remote get-url origin)"
git push -f origin gh-pages

echo "=== Despliegue completado con éxito en https://angelnereira.github.io/Plenty-Pay/ ==="
