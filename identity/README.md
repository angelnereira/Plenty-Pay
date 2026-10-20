# identity

Usuarios, negocios (tenants), sesiones, roles, permisos y confirmación fuerte. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go |
| Puerto | 50060 (admin `:9100` en servicios propios) |
| Fase del roadmap | F08 (F08.1–F08.7; F08.6 ampliado con el modelo de acceso, ADR 0018) |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Estructura | ✅ | Cumple `go-standards.md` §2: `internal/{config,domain,service,store,server,observability,tenancy,migrate}` + `migrations/` (2026-10-14, F08.2) |
| Código | ✅ | Idempotencia de mutaciones (`grpc-conventions.md` §3) por interceptor gRPC sobre `idempotency_keys`; Register (R1–R3, R6, R18 con `reason` estable), Login (R4, `ACCOUNT_SUSPENDED`), ValidateToken (con permisos, alcance y capacidades), GetUserPermissions (R10, R21, R22, R24), RefreshToken; modelo de acceso (2026-10-19, ADR 0018): perfil de negocio y verticales (R20), capacidades (R21), rol asignado sin preset por defecto (R22), anti-escalada A1–A3 (R23), sucursales y alcance por sucursal (R24), invitaciones con alcance y cuentas existentes (H8), suspensión/reactivación, step-up consumido por operación (R14). Resolución del permiso efectivo como función pura `auth.ResolveAccess`; reglas puras en `domain`/`auth`, casos de uso en `service`, adaptador gRPC en `server` |
| Persistencia | ✅ | `PostgresUserStore` con pgx v5 + PgBouncer: crea usuario y consentimientos en una transacción, `SET LOCAL app.tenant_id/app.user_id/app.actor_role` (RLS como segunda barrera, ADR 0014); login por `find_user_by_email` (SECURITY DEFINER del migrador) |
| Migraciones | ✅ | `0001` users/consents, `0002` sesiones, `0003` bloqueo, `0004` tenants/KYB, `0005` roles/invitaciones, `0006` recuperacion, `0007` perfiles y capacidades (con siembra a negocios previos), `0008` sucursales (matriz `0000` para negocios previos) y `0009` membresías y alcance (backfill desde `users`/`user_roles`, solo con negocio existente) y `0010` claves de idempotencia — 19 tablas, todas con RLS; cada una con `.up.sql` y `.down.sql`; aplicadas por `identity migrate`; DDL como `migrator_identity`, DML como `identity_svc`; idempotentes |
| Pruebas | ✅ | L1 `go test -race ./...` (2026-10-19: 139 pruebas, 160 con subtests; vectores V1–V9 de R10/R11/R21–R24, H8, R14 de step-up, `TestObs_*` de `reason` por error y de sobres de eventos); L2 `./identity/test/test_store_l2.sh` (14 aserciones + 27 pruebas Go contra PostgreSQL y NATS reales: 6 del modelo de acceso y 1 de idempotencia). **Corregido 2026-10-19**: el script compilaba el binario L2 en `identity/identity/test/bin` y ejecutaba uno viejo del 2026-10-14 07:25; las corridas L2 anteriores a esta fecha posteriores a esa hora no ejecutaron el código del momento. E2E identity↔gateway 34/35 (el fallo restante es el rate limit `auth` del gateway, previo, ver `docs/roadmap/status.md`) |
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

## Sesiones y refresh (F08.3)
- El registro y el login abren una sesion; los tokens llevan `session_id` y un `token_id` por emision (dos tokens del mismo segundo serian identicos sin el).
- **R8**: cada refresh emite uno nuevo y consume el anterior de forma atomica; presentar uno ya usado revoca la sesion (`REFRESH_REUSE`), escribe `pp.identity.session.revoked.v1` en el outbox y reporta `TOKEN_REUSE` a `security`.
- **R9**: `ValidateToken` exige sesion viva, con cache de revocacion (TTL <= 15 s); una revocacion se ve de inmediato en el mismo proceso.

## Negocios y eventos (F08.5)
- `CreateBusiness` da de alta el negocio en `PENDING_REVIEW`, asciende al dueño a `BUSINESS_OWNER` y devuelve sesion.
- `ReviewBusiness` (solo plataforma) aplica la máquina de estados del dominio; cada transición escribe **un** evento en el outbox y el relay lo publica en `pp.identity.tenant.status_changed.v1` con `Nats-Msg-Id = event_id` (JetStream deduplica).
- Un `event_type` sin publicador (la solicitud de notificación provisional de F08.4) queda **pendiente** en el outbox en vez de perderse.

## Base de datos
- DSN de servicio: `PP_DB_DSN` (por defecto `postgres://identity_svc:***@pgbouncer:6432/plentypay`).
- DSN de migración: `PP_MIGRATE_DSN` (directo a `postgres-db:5432` como `migrator_identity`: PgBouncer en modo transacción rechaza los parámetros de arranque de lib/pq).
- El DSN **no lleva `search_path`**: PgBouncer lo rechaza; el rol ya lo trae por defecto.

## Limitaciones conocidas
Sin tenants/roles personalizados/invitaciones (F08.5–F08.7). El relay del outbox (publicar `SessionRevoked` en NATS) llega con la fase de eventos; el escritor ya está en la misma transacción que el efecto (ADR 0012). El refresh de 30 días y el access de 15 min son de SPEC R7.
