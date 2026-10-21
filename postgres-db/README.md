# postgres-db

Base relacional: un esquema y un rol por contenedor. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | PostgreSQL 16 + PostGIS (`postgis/postgis@sha256:681931a625df344215e9b8998bf34daf146b6a395ceacee4439eb9c85869239f`) |
| Puerto | 5432 (interno red data) / 6432 (PgBouncer) |
| Fase del roadmap | F06 (F06.1) |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Esquemas y roles | ✅ implementado | 16 esquemas (`identity`, `ledger`, `payments`, etc.) y 16 roles (`<svc>_svc`) con permisos estrictos de no-cruce |
| Pruebas de aislamiento | ✅ implementadas | `./postgres-db/test/test_isolation.sh` verifica que un rol no puede leer ni escribir en el esquema de otro rol |
| Imagen Docker | ✅ fijada y verificada | Construida sobre postgis 16-3.4-alpine, scripts en `init/`, `postgresql.conf` con `wal_level=replica` y archivado |
| PgBouncer | ✅ implementado | Pooler en puerto 6432 con `pool_mode=transaction` y auth SCRAM delegada vía `auth_query`; `./postgres-db/test/test_pgbouncer.sh` pasa (7/7) |
| Monitoreo y alertas | ✅ implementado | `postgres_exporter` v0.16.0 en `:9187`, Prometheus target activo, 6 alertas (réplica, disco, conexiones, WAL) y paneles en dashboard Plataforma (`pp-platform`); `./postgres-db/test/test_monitoring.sh` pasa (8/8) |
| Respaldos base y WAL | ✅ implementado | Script `backup.sh` (`pg_basebackup -Ft -z -Xs`) genera respaldos comprimidos diarios con streaming de WAL y verificación SHA-256; `./postgres-db/test/test_backup.sh` pasa (7/7) |
| Restauración PITR | ✅ implementado y probado | Procedimiento documentado en `docs/runbooks/postgres-pitr.md`; `./postgres-db/test/test_pitr.sh` pasa (4/4) verificando restauración exacta a restore point y descarte de corrupción |

## Arranque local
Integrado en `docker-compose.yml`:
```bash
docker compose up -d postgres-db pgbouncer postgres-exporter
```

## Permisos de esquema en la base de producción
La base de producción se creó antes de que `init/00-roles-and-schemas.sql` diera `USAGE, CREATE` sobre cada
esquema a `<esquema>_svc` y `migrator_<esquema>`; además varios esquemas tenían tablas de esbozo creadas a
mano por `postgres`. Antes de la primera migración de un servicio: `./scripts/db-grant-schema.sh <esquema>`
(idempotente; sin esto la migración falla con «failed to open database: no schema»). Aplicado a `fiscal`
el 2026-10-21.

## Pruebas de verificación
```bash
./postgres-db/test/test_isolation.sh
./postgres-db/test/test_pgbouncer.sh
./postgres-db/test/test_monitoring.sh
./postgres-db/test/test_backup.sh
./postgres-db/test/test_pitr.sh
```

