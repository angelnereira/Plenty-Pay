#!/usr/bin/env bash
# Hace cumplir ADR 0010 (la documentación gobierna): verificaciones estructurales que CI corre en cada PR.
# Solo usa bash + coreutils + grep/sed/awk (sin dependencias extra).
#  1. Cada contenedor del inventario (service-dependencies.md §1) tiene SPEC.md y README.md.
#  2. El índice de ADR lista exactamente los archivos NNNN-*.md existentes.
#  3. Los enlaces Markdown relativos [x](ruta) apuntan a archivos existentes.
#  4. Las rutas citadas entre comillas invertidas en AGENTS.md existen.
#  5. Los colores del design system coinciden con flutter_app/lib/core/theme/app_theme.dart.
#  6. Cada mensaje del catálogo de eventos existe en algún .proto.
#  7. Los pasos de docs/roadmap/status.md son exactamente los de 05-HOJA-DE-RUTA-30-FASES.md.
#  8. Toda pregunta Q-NN citada existe en docs/open-questions.md.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ERR=0
fail() { echo "  ERROR [$1]: $2"; ERR=$((ERR+1)); }

# 1. SPEC + README por contenedor
inv="docs/architecture/service-dependencies.md"
containers=$(awk '/^## 1\./{f=1;next} /^## 2\./{f=0} f' "$inv" | grep -oE '^\| [0-9]+ \| `[a-z-]+`' | sed -E 's/.*`([a-z-]+)`/\1/')
[ -n "$containers" ] || fail "inventario" "no se pudo leer la tabla §1 de $inv"
n=0
for c in $containers; do
  n=$((n+1))
  [ -d "$c" ] || { fail "$c" "carpeta inexistente (está en el inventario)"; continue; }
  [ -f "$c/SPEC.md" ] || fail "$c" "falta SPEC.md"
  [ -f "$c/README.md" ] || fail "$c" "falta README.md"
done
echo "  contenedores en inventario: $n"

# 2. Índice de ADR
for f in docs/adr/[0-9][0-9][0-9][0-9]-*.md; do
  b=$(basename "$f")
  grep -q "($b)" docs/adr/README.md || fail "adr" "$b no está en docs/adr/README.md"
done
while IFS= read -r ref; do
  [ -f "docs/adr/$ref" ] || fail "adr" "el índice enlaza $ref, que no existe"
done < <(grep -oE '\([0-9]{4}-[a-z0-9-]+\.md\)' docs/adr/README.md | tr -d '()')

# 3. Enlaces relativos en Markdown (excluye legado y node_modules)
while IFS= read -r md; do
  dir=$(dirname "$md")
  while IFS= read -r link; do
    target="${link%%#*}"
    [ -z "$target" ] && continue
    case "$target" in http*|mailto:*|computer:*) continue;; esac
    [ -e "$dir/$target" ] || [ -e "$target" ] || fail "enlace" "$md → $link"
  done < <(grep -oE '\]\([^)[:space:]]+\)' "$md" | sed -E 's/^\]\((.*)\)$/\1/')
done < <(find . -name '*.md' -not -path './_legacy-typescript-reference/*' -not -path '*/node_modules/*' -not -path './.git/*' -not -path './docs/templates/*')

# 4. Rutas citadas en AGENTS.md
while IFS= read -r p; do
  [ -e "$p" ] || fail "AGENTS.md" "cita \`$p\`, que no existe"
done < <(grep -oE '`(docs|scripts|network-contracts|flutter_app|output|infra)/[A-Za-z0-9_./-]+`' AGENTS.md | tr -d '`' | sort -u | grep -v '<')

# 5. Tokens de color
theme="flutter_app/lib/core/theme/app_theme.dart"
if [ -f "$theme" ]; then
  for hex in $(awk '/^## 2\./{f=1;next} /^## 3\./{f=0} f' docs/design-system.md | grep -oE '#[0-9A-Fa-f]{6}' | sort -u); do
    v=$(echo "${hex#\#}" | tr 'a-f' 'A-F')
    case "$v" in 4CC38A|1E7F4F|F2B84B|8A5A00) continue;; esac   # success/warning: se agregan en F02.4
    grep -q "0xFF$v" "$theme" || fail "design-system" "$hex del documento no está en $theme"
  done
else
  fail "design-system" "no existe $theme"
fi

# 6. Mensajes del catálogo de eventos
while IFS= read -r msg; do
  name="${msg##*.}"
  grep -qE "^message $name " network-contracts/proto/*.proto || fail "eventos" "\`$msg\` no existe en ningún .proto"
done < <(awk '/^## 7\./{f=1;next} /^## 8\./{f=0} f' docs/standards/events-and-messaging.md | grep -oE '`[a-z_]+\.[A-Z][A-Za-z]+`' | tr -d '`' | sort -u)

# 7. Pasos del roadmap = pasos del estado
diff <(grep -oE '^\| F[0-9]{2}\.[0-9]+ ' 05-HOJA-DE-RUTA-30-FASES.md | awk '{print $2}') \
     <(grep -oE '^\| F[0-9]{2}\.[0-9]+ ' docs/roadmap/status.md | awk '{print $2}') >/dev/null \
  || fail "roadmap" "los pasos de status.md no coinciden con 05-HOJA-DE-RUTA-30-FASES.md"
phases=$(grep -cE '^## F[0-9]{2} — ' 05-HOJA-DE-RUTA-30-FASES.md)
[ "$phases" -ge 20 ] || fail "roadmap" "solo $phases fases (mínimo 20)"

# 8. Preguntas abiertas citadas
while IFS= read -r q; do
  grep -qE "\*\*$q\*\*|\| $q \|" docs/open-questions.md || fail "open-questions" "$q citada pero no definida"
done < <(grep -rhoE 'Q-[0-9]{2}' --include='*.md' . --exclude-dir=_legacy-typescript-reference | sort -u)

if [ "$ERR" -eq 0 ]; then echo "documentación OK"; exit 0; fi
echo "$ERR problema(s) de documentación"; exit 1
