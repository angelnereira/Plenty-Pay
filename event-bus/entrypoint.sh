#!/bin/sh
set -e

mkdir -p /data/jetstream

# Ejecutar aplicación idempotente de streams y KV en segundo plano al arrancar
/usr/local/bin/scripts/init-definitions.sh &

# Ejecutar nats-server como PID 1
exec nats-server -c /etc/nats/nats.conf
