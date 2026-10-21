#!/usr/bin/env bash
# Aplica a uno o más esquemas los permisos que `postgres-db/init/00-roles-and-schemas.sql` da en una base
# nueva: USAGE y CREATE al rol del servicio (<esquema>_svc) y al migrador (migrator_<esquema>), privilegios
# por defecto y lectura para readonly_ops. Idempotente.
#
# Hace falta en la base de producción porque se creó antes de que el script de inicio diera esos
# permisos: sin ellos la migración falla con «failed to open database: no schema».
# Uso: ./scripts/db-grant-schema.sh catalog inventory pos orders
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -gt 0 ] || { echo "uso: $0 <esquema>..." >&2; exit 2; }
for s in "$@"; do
  [[ "$s" =~ ^[a-z_]+$ ]] || { echo "esquema inválido: $s" >&2; exit 2; }
  docker compose exec -T postgres-db psql -v ON_ERROR_STOP=1 -U postgres -d plentypay -q <<SQL
GRANT USAGE, CREATE ON SCHEMA $s TO ${s}_svc;
GRANT USAGE, CREATE ON SCHEMA $s TO migrator_$s;
ALTER DEFAULT PRIVILEGES IN SCHEMA $s GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${s}_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA $s GRANT ALL ON TABLES TO migrator_$s;
ALTER DEFAULT PRIVILEGES IN SCHEMA $s GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${s}_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA $s GRANT ALL ON SEQUENCES TO migrator_$s;
GRANT USAGE ON SCHEMA $s TO readonly_ops;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator_$s IN SCHEMA $s GRANT SELECT ON TABLES TO readonly_ops;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator_$s IN SCHEMA $s GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${s}_svc;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator_$s IN SCHEMA $s GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${s}_svc;
SQL
  echo "permisos aplicados: $s"
done
