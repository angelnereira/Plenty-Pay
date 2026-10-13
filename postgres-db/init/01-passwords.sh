#!/usr/bin/env bash
set -eo pipefail

# Actualiza las contraseñas de los roles si se proveen variables de entorno *_DB_PASSWORD
schemas=(identity ledger payments settlement fiscal catalog inventory orders pos logistics geo payroll notifications analytics security infra)

for s in "${schemas[@]}"; do
  var_name="$(echo "${s}" | tr '[:lower:]' '[:upper:]')_DB_PASSWORD"
  pass="${!var_name:-}"
  if [ -n "$pass" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
      ALTER ROLE ${s}_svc WITH PASSWORD '${pass}';
      ALTER ROLE migrator_${s} WITH PASSWORD '${pass}_mig';
EOSQL
  fi
done
