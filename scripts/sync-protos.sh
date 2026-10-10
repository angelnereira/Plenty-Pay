#!/usr/bin/env bash
# Fuente de verdad: network-contracts/proto/*.proto + network-contracts/consumers.txt (ADR 0004).
# Entrega a cada contenedor lo que necesita para construirse SIN salir de su carpeta (ADR 0002):
#   Go:   código generado (protoc-gen-go + protoc-gen-go-grpc), todo en UN paquete `pb` del contenedor
#   Rust: copia de los .proto en <contenedor>/proto/ (tonic-build los compila desde build.rs)
# Uso:  ./scripts/sync-protos.sh          → regenera
#       ./scripts/sync-protos.sh --check  → exit 1 si algo está desactualizado (CI)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROTO="$ROOT/network-contracts/proto"
MANIFEST="$ROOT/network-contracts/consumers.txt"
MODE="${1:-sync}"
STATUS=0

command -v protoc >/dev/null || { echo "falta protoc"; exit 1; }
# Los contratos deben compilar juntos antes de generar nada
protoc -I "$PROTO" --descriptor_set_out=/dev/null "$PROTO"/*.proto || { echo "los .proto no compilan"; exit 1; }

while IFS='|' read -r svc lang outdir protos; do
  case "$svc" in ''|\#*) continue;; esac
  svc="$(echo "$svc" | xargs)"; lang="$(echo "$lang" | xargs)"; outdir="$(echo "$outdir" | xargs)"; protos="$(echo "$protos" | xargs)"
  IFS=, read -ra files <<<"$protos"
  dest="$ROOT/$svc/$outdir"

  if [ "$lang" = "go" ]; then
    [ -f "$ROOT/$svc/go.mod" ] || { echo "  omitido  $svc (sin go.mod todavía)"; continue; }
    command -v protoc-gen-go >/dev/null && command -v protoc-gen-go-grpc >/dev/null || { echo "faltan protoc-gen-go / protoc-gen-go-grpc"; exit 1; }
    mflags=(); for f in "${files[@]}"; do mflags+=("--go_opt=M$f=plentypay/$svc/$outdir" "--go-grpc_opt=M$f=plentypay/$svc/$outdir"); done
    gen() { protoc -I "$PROTO" --go_out="$1" --go_opt=paths=source_relative --go-grpc_out="$1" --go-grpc_opt=paths=source_relative "${mflags[@]}" "${files[@]/#/$PROTO/}"; }
    if [ "$MODE" = "--check" ]; then
      tmp="$(mktemp -d)"; gen "$tmp"
      if diff -rq "$tmp" "$dest" >/dev/null 2>&1; then echo "  ok   $svc/$outdir"; else echo "  DESACTUALIZADO $svc/$outdir (corre scripts/sync-protos.sh)"; STATUS=1; fi
      rm -rf "$tmp"
    else
      rm -rf "$dest"; mkdir -p "$dest"; gen "$dest"; echo "  generado $svc/$outdir  [${protos}]"
    fi
  elif [ "$lang" = "rust" ]; then
    [ -f "$ROOT/$svc/Cargo.toml" ] || { echo "  omitido  $svc (sin Cargo.toml todavía)"; continue; }
    if [ "$MODE" = "--check" ]; then
      for f in "${files[@]}"; do cmp -s "$PROTO/$f" "$dest/$f" && echo "  ok   $svc/$outdir/$f" || { echo "  DESACTUALIZADO $svc/$outdir/$f"; STATUS=1; }; done
    else
      mkdir -p "$dest"; for f in "${files[@]}"; do cp "$PROTO/$f" "$dest/$f"; done; echo "  copiado  $svc/$outdir  [${protos}]"
    fi
  fi
done < "$MANIFEST"
exit $STATUS
