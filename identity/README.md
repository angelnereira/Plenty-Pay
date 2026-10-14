# identity

Usuarios, negocios (tenants), sesiones, roles, permisos y confirmación fuerte. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go |
| Puerto | 50060 (admin `:9100` en servicios propios) |
| Fase del roadmap | F08 (F08.1, F08.2) |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Estructura | ✅ | Cumple `go-standards.md` §2: `internal/{config,domain,service,store,server,observability,tenancy,migrate}` + `migrations/` (2026-10-14, F08.2) |
| Código | ✅ | Register (R1–R3, R6, R18 con `reason` estable), Login (R4), ValidateToken, GetUserPermissions (R10), RefreshToken sobre la interfaz `store.UserStore`; reglas puras en `domain`, casos de uso en `service`, adaptador gRPC en `server` |
| Persistencia | ✅ | `PostgresUserStore` con pgx v5 + PgBouncer: crea usuario y consentimientos en una transacción, `SET LOCAL app.tenant_id/app.user_id/app.actor_role` (RLS como segunda barrera, ADR 0014); login por `find_user_by_email` (SECURITY DEFINER del migrador) |
| Migraciones | ✅ | `migrations/0001_users_and_consents.{up,down}.sql` aplicadas por `identity migrate` (embebidas con `go:embed`); DDL como `migrator_identity`, DML como `identity_svc`; idempotentes |
| Pruebas | ✅ | L1 `go test -race ./...` (58 pruebas: domain R1/R2, service R3/R4/R6/R18, server, auth, observabilidad); L2 `./identity/test/test_store_l2.sh` (14 aserciones + 6 pruebas Go contra PostgreSQL real, incluido aislamiento RLS); L4 `./scripts/e2e-identity-gateway.sh` 35/35 |
| Imagen Docker | ✅ | `golang:1.26-alpine` → distroless nonroot; construida y `healthy` en Compose con `PP_DB_DSN` |
| Observabilidad | ✅ | Logs JSON con `request_id`/`trace_id`, error con pila y registro único en el borde, trazas W3C, métricas §2.1 |

## Arranque local
```bash
cp .env.example .env       # completar valores (nunca commitear .env)
docker compose up --build identity          # store en memoria (sin PP_DB_DSN) o postgres
docker compose exec identity /app migrate   # aplicar migraciones (job migrate-identity)
```

## Desarrollo
```bash
cd identity
go test -race ./...         # L1
go test -race -tags l2 ./internal/store/   # L2 (requiere PP_TEST_DB_DSN)
go vet ./...                # L0
./identity/test/test_store_l2.sh            # L2 orquestado (migraciones + RLS + store)
../scripts/e2e-identity-gateway.sh          # L4
```

## Base de datos
- DSN de servicio: `PP_DB_DSN` (por defecto `postgres://identity_svc:***@pgbouncer:6432/plentypay`).
- DSN de migración: `PP_MIGRATE_DSN` (directo a `postgres-db:5432` como `migrator_identity`: PgBouncer en modo transacción rechaza los parámetros de arranque de lib/pq).
- El DSN **no lleva `search_path`**: PgBouncer lo rechaza; el rol ya lo trae por defecto.

## Limitaciones conocidas
Sin rotación/reuso de refresh (F08.3), sin bloqueo progresivo (F08.4), sin tenants/roles personalizados/invitaciones (F08.5–F08.7). Las consultas de plataforma sobre otros tenants aún no cruzan RLS con su `app.actor_role` (F08.5).
