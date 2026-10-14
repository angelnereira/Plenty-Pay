#!/bin/sh
# PlentyPay — aplicación idempotente del layout de clúster de Garage (F07.8)
# SPEC: object-storage/SPEC.md §2/§5.
#
# Compose: 1 nodo en zona dc1 con 1 GB de capacidad declarada, RF=1 (garage.toml).
# Producción (F27): 3 nodos RF=3 — entonces este script se extiende con la lista
# completa de node-id (cada nodo se descubre con `garage node id`).
set -e

GARAGE=/usr/local/bin/garage
ZONE="${GARAGE_ZONE:-dc1}"
CAPACITY="${GARAGE_NODE_CAPACITY:-1G}"

# 1. Esperar a que el RPC del nodo responda (el server se inició en paralelo).
ATTEMPT=0
MAX_ATTEMPTS=30
NODE=""
until NODE=$("$GARAGE" node id 2>/dev/null) && [ -n "$NODE" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "object-storage-init: el RPC de Garage no respondió tras $MAX_ATTEMPTS intentos" >&2
    exit 1
  fi
  sleep 1
done

# 2. Leer el layout con reintentos: recién arrancado, el RPC puede contestar
#    antes de que el gestor de layout esté listo (condición de carrera observada).
LAYOUT=""
ATTEMPT=0
MAX_ATTEMPTS=15
until LAYOUT=$("$GARAGE" layout show 2>/dev/null) && [ -n "$LAYOUT" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "object-storage-init: no se pudo leer el layout tras $MAX_ATTEMPTS intentos" >&2
    exit 1
  fi
  sleep 1
done

# 3. Si el clúster no tiene layout, asignar el rol de este nodo y aplicarlo.
if echo "$LAYOUT" | grep -q "No nodes currently have a role"; then
  echo "object-storage-init: asignando rol al nodo $NODE (zona $ZONE, capacidad $CAPACITY)"
  "$GARAGE" layout assign -z "$ZONE" -c "$CAPACITY" "$NODE" >/dev/null 2>&1
  "$GARAGE" layout apply --version 1 >/dev/null 2>&1
  echo "object-storage-init: layout v1 aplicado"
else
  echo "object-storage-init: layout ya asignado (sin cambios)"
fi
