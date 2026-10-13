#!/usr/bin/env bash
# PlentyPay — Entrypoint de ScyllaDB con inicialización automática (F07.1, F07.2)
set -e

# Proceso de inicialización en segundo plano
(
  echo "Esperando a que ScyllaDB acepte conexiones CQL..."
  READY=0
  for i in $(seq 1 60); do
    if cqlsh -u cassandra -p cassandra -e "DESCRIBE KEYSPACES;" >/dev/null 2>&1; then
      READY=1
      break
    fi
    sleep 2
  done

  if [ "$READY" -eq 1 ]; then
    echo "ScyllaDB listo. Aplicando definiciones de roles y keyspaces (F07.2)..."
    cqlsh -u cassandra -p cassandra -f /etc/scylla/init/00-roles-and-keyspaces.cql
    echo "Inicialización de ScyllaDB completada con éxito."
  else
    echo "AVISO: Tiempo de espera agotado para la inicialización de ScyllaDB."
  fi
) &

exec /docker-entrypoint.py "$@"
