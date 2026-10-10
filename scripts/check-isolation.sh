#!/usr/bin/env bash
# Hace cumplir ADR 0002/0016: una carpeta de la raíz = una unidad de despliegue, aislada.
# Falla (exit 1) si algún contenedor depende de código de OTRO. Única carpeta legible: network-contracts/ (ADR 0004).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NON_CONTAINERS="docs infra scripts output network-contracts _legacy-typescript-reference node_modules"
VIOLATIONS=0
fail() { echo "  VIOLACIÓN [$1]: $2"; VIOLATIONS=$((VIOLATIONS+1)); }

for dir in */; do
  name="${dir%/}"
  case " $NON_CONTAINERS " in *" $name "*) continue;; esac
  [ -d "$name" ] || continue
  if [ -f "$name/go.mod" ]; then
    while IFS= read -r imp; do
      owner="$(echo "$imp" | cut -d/ -f2)"
      [ "$owner" = "$name" ] || fail "$name" "importa $imp (código de otro contenedor)"
    done < <(grep -rhoE --include='*.go' '"plentypay/[^"]+"' "$name" | tr -d '"' | sort -u)
    grep -nE '=>\s*\.\.?/' "$name/go.mod" >/dev/null 2>&1 && fail "$name" "go.mod tiene un replace con ruta relativa hacia afuera"
    grep -nE '=>\s*/' "$name/go.mod" >/dev/null 2>&1 && fail "$name" "go.mod tiene un replace con ruta absoluta (solo válido en la máquina de quien lo escribió)"
  fi
  if [ -f "$name/Cargo.toml" ]; then
    grep -nE 'path\s*=\s*"\.\./' "$name/Cargo.toml" >/dev/null 2>&1 && fail "$name" "Cargo.toml depende de una ruta fuera de la carpeta"
    [ -f "$name/build.rs" ] && grep -nE '"\.\./' "$name/build.rs" >/dev/null 2>&1 && fail "$name" "build.rs lee archivos fuera de la carpeta (usa sync-protos.sh)"
  fi
  if [ -f "$name/pubspec.yaml" ]; then
    grep -nE 'path:\s*\.\./' "$name/pubspec.yaml" >/dev/null 2>&1 && fail "$name" "pubspec.yaml depende de una ruta fuera de la carpeta"
  fi
  if [ -f "$name/Dockerfile" ]; then
    grep -nE '^\s*COPY\s+.*\.\./' "$name/Dockerfile" >/dev/null 2>&1 && fail "$name" "Dockerfile hace COPY desde fuera de su carpeta"
  fi
done

# docker-compose: cada servicio construye desde SU carpeta (./<contenedor>)
for f in docker-compose*.yml; do
  [ -f "$f" ] || continue
  while IFS= read -r ctx; do
    case "$ctx" in
      ./*) rest="${ctx#./}"; [ "$(echo "$rest" | tr -cd '/' | wc -c)" -eq 0 ] || fail "$f" "contexto de build anidado: $ctx" ;;
      *)   fail "$f" "contexto de build fuera de la convención ./<contenedor>: $ctx" ;;
    esac
  done < <(grep -E '^\s*context:' "$f" | sed -E 's/^\s*context:\s*//' | tr -d '"')
done

if [ "$VIOLATIONS" -eq 0 ]; then echo "aislamiento OK: ningún contenedor depende del código de otro"; exit 0; fi
echo "$VIOLATIONS violación(es) de ADR 0002"; exit 1
