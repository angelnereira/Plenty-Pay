#!/bin/sh
# PlentyPay — arranque de object-storage (Garage).
# SPEC: object-storage/SPEC.md §5 (F07.8).
set -e

mkdir -p /var/lib/garage/data /var/lib/garage/meta

# El servidor corre en segundo plano: primero hay que levantarlo para poder
# aplicar el layout por su RPC (localhost:3901).
/usr/local/bin/garage server &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' TERM INT

# Aplicación idempotente del layout (no recrea nada si ya está asignado).
/usr/local/bin/scripts/init-layout.sh

# Aplicación idempotente de buckets y llaves (F07.9).
/usr/local/bin/scripts/init-buckets.sh

# Proceso principal = servidor Garage (PID 1 recibe las señales por el trap).
wait "$SERVER_PID"
