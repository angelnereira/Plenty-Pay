# SPEC — postgres-db

## 1. Responsabilidad
Base relacional fuente de verdad: **PostgreSQL 16 + PostGIS** (imagen `postgis/postgis:16-3.4` o equivalente fijada) con **PgBouncer** (pool en modo transacción). Un esquema y un rol por contenedor (ADR 0014).

## 2. Ficha
Puertos internos 5432 (PostgreSQL), 6432 (PgBouncer; los servicios se conectan aquí). Red `data`. Fase F06. Capa L0. En Kubernetes: **CloudNativePG** (1 primario + 2 réplicas, PITR a object-storage).

## 3. Estructura
```
postgres-db/
├── SPEC.md · README.md · .env.example
├── Dockerfile                   # FROM postgis/postgis:16-3.4 + extensiones (pg_stat_statements, pgcrypto)
├── init/00-roles-and-schemas.sql   # crea esquemas y roles por contenedor (sin contraseñas: se leen de env en 01-*.sh)
├── init/01-passwords.sh         # asigna contraseñas desde variables *_DB_PASSWORD
├── postgresql.conf              # parámetros base (shared_buffers, wal_level=replica, pg_stat_statements)
└── pgbouncer/                   # pgbouncer.ini + userlist generado al arrancar
```

## 4. Esquemas y roles
| Esquema | Rol (LOGIN) | Contenedor |
|---|---|---|
| identity | identity_svc | identity |
| ledger | ledger_svc | ledger |
| payments | payments_svc | payments-core |
| settlement | settlement_svc | settlement |
| fiscal | fiscal_svc | fiscal-invoicing |
| catalog | catalog_svc | catalog |
| inventory | inventory_svc | inventory |
| orders | orders_svc | orders |
| pos | pos_svc | pos |
| logistics | logistics_svc | logistics |
| geo | geo_svc | geolocation |
| payroll | payroll_svc | payroll |
| notifications | notifications_svc | notifications |
| analytics | analytics_svc | analytics-bi |
| security | security_svc | security |
| infra | infra_svc | infra-management |
Cada rol: `USAGE, CREATE` solo en su esquema; `REVOKE ALL ON SCHEMA public`; sin `BYPASSRLS`; `search_path` = su esquema. Rol `migrator_<svc>` separado para DDL (usado por el job de migración). Rol `readonly_ops` para soporte (auditado).

## 5. Reglas
- **R1** Ningún contenedor recibe credenciales de otro esquema.
- **R2** `ssl=on` en prod; contraseñas ≥ 32 caracteres aleatorias desde security/OpenBao.
- **R3** Backups: base diaria + WAL continuo (RPO ≤ 5 min); restauración probada trimestralmente (runbook F30).
- **R4** Monitoreo con postgres_exporter (observability): conexiones, réplicas, lag, bloat, consultas lentas.

## 6. Plan
F06.1 imagen + init de roles/esquemas → F06.2 PgBouncer → F06.3 exporter + alertas → F06.4 backups (pgBackRest/barman o CloudNativePG) → F06.5 prueba de restauración.
