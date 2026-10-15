#!/usr/bin/env bash
# Verificacion L4 del criterio de F09.5 (cierre por SessionRevoked <= 5 s).
# La prueba necesita la red de Docker (event-bus), asi que se compila y se
# ejecuta dentro de un contenedor en la red plentypay_data.
#
# Ejecutar desde la raiz del repositorio: ./api-gateway/test/test_realtime_l4.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

BIN=api-gateway/test/bin/realtime.test
mkdir -p api-gateway/test/bin

echo "  [*] Compilando la prueba L4 de realtime..."
(cd api-gateway && go test -c -tags l2 -o test/bin/realtime.test ./internal/realtime/)

echo "  [*] Ejecutando dentro de la red plentypay_data..."
docker run --rm --network plentypay_data \
  -e PP_TEST_NATS_URL="nats://event-bus:4222" \
  -e PP_TEST_NATS_USER="identity_svc" \
  -e PP_TEST_NATS_PASS="identity_nats_secret" \
  -v "$PWD/api-gateway/test/bin:/t:ro" busybox:stable \
  /t/realtime.test -test.run TestR10 -test.v 2>&1 | grep -E "^(=== RUN|--- |ok|FAIL|PASS)|socket cerrado"
