#!/usr/bin/env bash
# F02.7 — builds de release de flutter_app a `output/` con checksums SHA-256.
#
# Uso:  ./scripts/build-release.sh [plataforma ...]
#       Plataformas: web linux android windows macos ios  (por omisión: todas las que el
#       sistema operativo actual puede construir). iOS/macOS requieren macOS; Windows
#       requiere Windows + Visual Studio: en otro sistema se omiten y se dice.
#
# Convenciones (output/README.md):
#   - prod siempre https (AppConfig rechaza http en staging/prod).
#   - las llaves de firma NUNCA están en el repo: se pasan por variables de entorno.
#   - cada artefacto con checksum en SHA256SUMS; APK ≤ 40 MB por ABI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/flutter_app"
OUT="$ROOT/output"
VERSION="$(sed -nE 's/^version: ([0-9]+\.[0-9]+\.[0-9]+).*/\1/p' "$APP/pubspec.yaml")"
[ -n "$VERSION" ] || { echo "no se pudo leer la versión de flutter_app/pubspec.yaml"; exit 1; }

# URL del despliegue en producción / servidor host expuesto en internet
API_BASE_URL="${API_BASE_URL:-https://undo-guards-roots-lectures.trycloudflare.com}"
DEFINES=(--dart-define=FLAVOR=prod --dart-define=API_BASE_URL="$API_BASE_URL")

# Firma (CI): KEYSTORE_PATH + KEYSTORE_PROPERTIES (nunca en el repo).
# Sin ellas el APK queda sin firmar y el script lo advierte.
SIGN_ARGS=()
if [ -n "${KEYSTORE_PATH:-}" ] && [ -n "${KEYSTORE_PROPERTIES:-}" ]; then
  SIGN_ARGS=(--keystore "$KEYSTORE_PATH" --keystore-properties "$KEYSTORE_PROPERTIES")
else
  echo "AVISO: sin KEYSTORE_PATH/KEYSTORE_PROPERTIES los APK quedan sin firmar (las llaves nunca van al repo)."
fi

PLATFORMS=("$@")
if [ ${#PLATFORMS[@]} -eq 0 ]; then
  PLATFORMS=(web linux android)
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) PLATFORMS+=(windows) ;;
    Darwin) PLATFORMS+=(macos ios) ;;
  esac
fi

cd "$APP"
mkdir -p "$OUT"

checksums() { # $1 = directorio del artefacto dentro de output/
  (cd "$OUT/$1" && sha256sum -- * > SHA256SUMS 2>/dev/null || true)
  echo "  checksums: $1/SHA256SUMS"
}

# APK ≤ 40 MB por ABI (criterio de aceptación de F02.7).
check_apk_size() {
  local max=$((40 * 1024 * 1024)) f size found=0
  for f in "$OUT"/android/*.apk; do
    [ -e "$f" ] || continue
    [[ "$f" == *"universal"* ]] && continue
    found=1
    size=$(stat -c%s "$f")
    if [ "$size" -gt "$max" ]; then
      echo "ERROR: $(basename "$f") pesa $((size / 1024 / 1024)) MB (> 40 MB)"
      return 1
    fi
    echo "  ok   $(basename "$f") — $((size / 1024 / 1024)) MB"
  done
  [ "$found" = 1 ] || { echo "ERROR: no se copió ningún APK a output/android"; return 1; }
}

for platform in "${PLATFORMS[@]}"; do
  echo "=== [Flutter] build $platform ==="
  case "$platform" in
    web)
      flutter build web --release "${DEFINES[@]}"
      rm -rf "$OUT/web"; mkdir -p "$OUT/web"
      tar -czf "$OUT/web/plentypay-web-$VERSION.tar.gz" -C build/web .
      checksums web
      # El contenedor `web` sirve el bundle desde web/static/app/ (ADR 0016: no se versiona).
      rm -rf "$ROOT/web/static/app"
      mkdir -p "$ROOT/web/static/app"
      tar -xzf "$OUT/web/plentypay-web-$VERSION.tar.gz" -C "$ROOT/web/static/app"
      echo "  bundle servido por web: web/static/app/"
      ;;
    linux)
      flutter build linux --release "${DEFINES[@]}"
      rm -rf "$OUT/linux"; mkdir -p "$OUT/linux"
      tar -czf "$OUT/linux/plentypay-$VERSION-x64.tar.gz" -C build/linux/x64/release .
      checksums linux
      ;;
    android)
      flutter build apk --release --split-per-abi "${DEFINES[@]}" "${SIGN_ARGS[@]}"
      rm -rf "$OUT/android"; mkdir -p "$OUT/android"
      # Solo los APK por ABI de release (`--split-per-abi`): nunca el app-debug.apk que
      # deja una compilación de depuración anterior.
      for abi in arm64-v8a armeabi-v7a x86_64; do
        src="build/app/outputs/flutter-apk/app-$abi-release.apk"
        [ -f "$src" ] || src="build/app/outputs/apk/release/app-$abi-release.apk"
        [ -f "$src" ] || { echo "ERROR: falta el APK de $abi"; exit 1; }
        cp "$src" "$OUT/android/plentypay-$VERSION-$abi.apk"
      done
      check_apk_size
      # APK universal para mayor compatibilidad en pruebas en dispositivos
      flutter build apk --release "${DEFINES[@]}" "${SIGN_ARGS[@]}"
      universal_src="build/app/outputs/flutter-apk/app-release.apk"
      [ -f "$universal_src" ] || universal_src="build/app/outputs/apk/release/app-release.apk"
      if [ -f "$universal_src" ]; then
        cp "$universal_src" "$OUT/android/plentypay-$VERSION-universal.apk"
      fi
      # .aab para las tiendas (output/README.md); la firma y subida son de F25.5.
      flutter build appbundle --release "${DEFINES[@]}" "${SIGN_ARGS[@]}"
      cp build/app/outputs/bundle/release/app-release.aab "$OUT/android/plentypay-$VERSION.aab"
      checksums android
      ;;
    windows)
      if [ "$(uname -s | cut -c1-5)" != "MINGW" ] && ! command -v cmd.exe >/dev/null 2>&1; then
        echo "  omitido: flutter build windows requiere Windows + Visual Studio"
        continue
      fi
      flutter build windows --release "${DEFINES[@]}"
      rm -rf "$OUT/windows"; mkdir -p "$OUT/windows"
      (cd build/windows/x64/runner/Release && zip -qr "$OUT/windows/plentypay-$VERSION-x64.zip" .)
      checksums windows
      ;;
    macos)
      [ "$(uname -s)" = "Darwin" ] || { echo "  omitido: macOS requiere un runner macOS"; continue; }
      flutter build macos --release "${DEFINES[@]}"
      rm -rf "$OUT/macos"; mkdir -p "$OUT/macos"
      (cd build/macos/Build/Products/Release && zip -qr "$OUT/macos/PlentyPay-$VERSION.zip" *.app)
      checksums macos
      ;;
    ios)
      [ "$(uname -s)" = "Darwin" ] || { echo "  omitido: iOS requiere un runner macOS con certificados"; continue; }
      flutter build ipa --release --export-options-plist="${IOS_EXPORT_OPTIONS:?}" "${DEFINES[@]}"
      rm -rf "$OUT/ios"; mkdir -p "$OUT/ios"
      cp build/ios/ipa/*.ipa "$OUT/ios/plentypay-$VERSION.ipa"
      checksums ios
      ;;
    *)
      echo "Plataforma desconocida: $platform"; exit 1 ;;
  esac
done

echo
echo "Artefactos en output/:"
find "$OUT" -type f ! -name README.md ! -name .gitignore -printf '  %P (%s bytes)\n' | sort
