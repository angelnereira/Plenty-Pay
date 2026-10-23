#!/usr/bin/env bash
# Herramienta de DESARROLLO (no se despliega): ayuda para pruebas L4 en el teléfono por adb.
# Requiere adb con un solo dispositivo conectado y python3 (solo para leer el volcado de la UI).
#
# Uso:
#   scripts/dev/pixel.sh tap "<texto>"   toca el primer elemento cuyo texto o content-desc es <texto>
#                                         (o cuya primera línea es <texto>); --last toca el último
#   scripts/dev/pixel.sh type "<texto>"  escribe en el campo con foco (espacios → %s)
#   scripts/dev/pixel.sh hidekb          cierra el teclado SOLO si está visible (nunca «atrás» a ciegas)
#   scripts/dev/pixel.sh scan <dígitos>  simula un lector de códigos HID: teclas seguidas + Enter
#   scripts/dev/pixel.sh shot <archivo>  captura de pantalla en PNG
#   scripts/dev/pixel.sh ui              lista textos y content-desc visibles
#
# Trampas (ver docs/roadmap/execution/README.md §2.5): `adb shell input text` NO simula un lector;
# los campos de Flutter no pierden el foco al tocar una zona vacía; cancela diálogos del sistema;
# no vuelques la pantalla con un campo de contraseña enfocado.
set -euo pipefail
cmd="${1:?indica tap, type, hidekb, scan, shot o ui}"; shift || true

dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb shell cat /sdcard/ui.xml; }

case "$cmd" in
  tap)
    which=first
    if [ "${1:-}" = "--last" ]; then which=last; shift; fi
    target="${1:?texto}"
    xy="$(dump | python3 -I -c '
import re, sys, xml.etree.ElementTree as ET
target, which = sys.argv[1], sys.argv[2]
hits = []
for n in ET.fromstring(sys.stdin.read()).iter("node"):
    for a in ("text", "content-desc"):
        v = n.get(a, "")
        if v == target or v.split("\n")[0] == target:
            x1, y1, x2, y2 = map(int, re.findall(r"\d+", n.get("bounds")))
            hits.append(f"{(x1+x2)//2} {(y1+y2)//2}")
            break
if not hits:
    sys.exit(1)
print(hits[0] if which == "first" else hits[-1])
' "$target" "$which")" || { echo "no encontrado: $target" >&2; exit 1; }
    adb shell input tap $xy
    echo "tap $target ($xy)"
    ;;
  type)
    adb shell input text "$(printf '%s' "${1:?texto}" | sed 's/ /%s/g')"
    ;;
  hidekb)
    sleep 0.5
    if adb shell dumpsys window windows 2>/dev/null | grep -A20 "Window{.*InputMethod}" | grep -q "mHasSurface=true"; then
      adb shell input keyevent 4
      sleep 0.6
    fi
    ;;
  scan)
    code="${1:?dígitos}"
    case "$code" in *[!0-9]*) echo "solo dígitos" >&2; exit 1 ;; esac
    keys=""
    for c in $(printf '%s' "$code" | grep -o .); do keys="$keys $((c + 7))"; done # KEYCODE_0 = 7
    adb shell input keyevent $keys 66                                            # 66 = Enter
    ;;
  shot)
    adb exec-out screencap -p > "${1:?archivo.png}"
    ;;
  ui)
    dump | grep -o 'text="[^"]\+"\|content-desc="[^"]\+"'
    ;;
  *) echo "comando desconocido: $cmd" >&2; exit 1 ;;
esac
