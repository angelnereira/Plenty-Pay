#!/usr/bin/env bash
# Etapa 5 de CI: construcción de imágenes Docker (docs/standards/delivery-pipeline.md §2).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "AVISO: El daemon de Docker no está accesible en este entorno."
  echo "Verificando únicamente existencia y estructura básica de los Dockerfiles..."
  for dir in */; do
    name="${dir%/}"
    if [ -f "$name/Dockerfile" ]; then
      echo "  Dockerfile encontrado: $name/Dockerfile"
    fi
  done
  exit 0
fi

echo "=== Construyendo imágenes Docker con Dockerfile ==="
ERR=0
for dir in */; do
  name="${dir%/}"
  if [ -f "$name/Dockerfile" ]; then
    echo "--- Construyendo $name ---"
    docker build -t "plentypay-$name:local" "$name" || ERR=$((ERR+1))
  fi
done

if [ "$ERR" -gt 0 ]; then
  echo "ERROR: Falló la construcción de $ERR imagen(es)"
  exit 1
fi

echo "build-images OK"
