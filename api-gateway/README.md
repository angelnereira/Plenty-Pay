# api-gateway

Única puerta HTTPS/JSON + WebSocket de la app Flutter y de los webhooks. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go |
| Puerto | 8080 (público) (admin `:9100` en servicios propios) |
| Fase del roadmap | F09 (F09.1–F09.5 parcial) |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | 📝 parcial: `/healthz`, `/v1/auth/{login,register,refresh}` (register reenvía los consentimientos y propaga el `reason` de identity), `/v1/me`, `/v1/me/permissions` (con `branch_scope` y `capabilities`), middleware de autenticación y errores `{error,reason,request_id}`; tabla declarativa con las rutas del modelo de acceso (ADR 0018, §4.1) y verificación del `Permission` de cada ruta contra el permiso efectivo de la sesión; metadatos `x-pp-permissions`/`x-pp-branch-scope`/`x-pp-capabilities` desde `ValidateToken` y `x-pp-step-up` desde `X-Step-Up-Token` (2026-10-19) | |
| Pruebas | L1 `go test -race ./...` 78 pruebas (2026-10-19; incluye `TestR24_OutgoingBranchScopeAndCapabilities`, `TestR23_RoutePermissionCheckedAtGateway`, `TestR24_RequireAuthBuildsCallerFromValidatedSession`); E2E con identity 34/35 (2026-10-19; el fallo es el rate limit `auth` que responde 429 a la 11.ª llamada del script, previo a este cambio) | |
| Imagen Docker | Plantilla de `go-standards.md` §6 (`go mod download`, distroless nonroot); construida y `healthy` en Compose — 2026-10-10 . **No reconstruida tras F04.6** (2026-10-12: el daemon de Docker no estaba disponible); sí compila con los mismos parámetros del Dockerfile (`CGO_ENABLED=0 go build -trimpath -ldflags="-s -w"`) | |
| Salud | Puerto admin `:9100` con `/healthz/live` y `/healthz/ready`, subcomando `/app healthcheck`, apagado ordenado con SIGTERM (F02.1). `ready` no depende de identity (matriz de degradación); `/metrics` en F04.6 | L1 `internal/observability` |
| Observabilidad | 📝 Implementado y probado 2026-10-12: logs JSON de una línea con `request_id`, `trace_id` y `span_id`; modelo de error con pila en el origen y registro único en el borde; recuperación de pánicos con `pp_panics_total`; trazas OpenTelemetry con propagación W3C; `/metrics` con contadores. Métricas obligatorias §2.1 implementadas 2026-10-12: `pp_http_requests_total{route,status}`, `pp_http_duration_seconds{route}` (histograma 5 ms–10 s), `pp_rpc_client_requests_total{target,rpc,code}` y `pp_rpc_client_duration_seconds` en el interceptor de cliente, `pp_build_info{service,version,commit}` y rechazo de etiquetas prohibidas (§2.3) con prueba. **Falta para cerrar F04.6**: métricas de `pp_db_*` cuando haya base de datos, `pp_ws_connections_current` y `pp_rate_limited_total` (F09.5/F09.6), puente de logs a OTLP (hoy solo stdout), exportación verificada contra un colector real (F04.1) y `golangci-lint` (herramienta no instalada: no ejecutado) | L1: pruebas `TestObs_*`; L4: E2E 23/23 con la misma traza en gateway e identity |

## Billetera y pagos (F11.3)
- **Rutas**: `/v1/wallet/{balance,statement}` van al ledger y son solo de lectura, siempre sobre la cuenta de la persona del token. `/v1/payments/*`, `/v1/pay-links/{code}`, `/v1/terminals` y `/v1/fee-policies` van a payments-core. Detalle en SPEC §4.2.
- **Conexiones**: `PP_PAYMENTS_ADDR` (`payments-core:50062`) y `PP_LEDGER_ADDR` (`ledger:50061`), perezosas y con la misma cadena de interceptores (metadatos, traza, métricas).
- **Pruebas**: L1 en `internal/routes/payments_test.go`:
  - el ledger solo expone lecturas;
  - la cuenta sale del token aunque el cliente mande otra;
  - campos anidados del query y fechas RFC 3339;
  - la clave de idempotencia llega al proto;
  - `quote` no se confunde con un id.
- **Pendiente**: el L4 de punta a punta, que necesita el ledger y payments-core desplegados.

## Tiempo real (F09.5)
GET /v1/realtime (WebSocket): autenticacion por primer mensaje {"type":"auth","token":...} en 5 s, suscripciones por topic (inbox, payment.status, delivery, customer_display, geo.subject, session), maximo 20 por conexion y 1 conexion por sesion, ping cada 25 s. Al llegar SessionRevoked de NATS se cierran los sockets de esas sesiones (R10).

Pruebas: L1 en internal/realtime (protocolo, limites, cierre) y L4 del criterio con
infraestructura real: ./api-gateway/test/test_realtime_l4.sh.

## Tabla de rutas (F09.3)
Las rutas viven en `internal/routes/table.go`: una fila por ruta (método, path, RPC, permiso, auth, idempotencia, step-up). El handler genérico traduce JSON↔proto. Solo login/registro/refresh/me/me-permissions conservan handler propio (moldeado de R2/R2b). Para añadir una ruta: **una fila**, más su golden en `internal/routes/testdata/` (regenerables con `UPDATE_GOLDEN=1 go test ./internal/routes/`).

## Arranque local
```bash
cp .env.example .env       # completar valores (nunca commitear .env)
docker compose up --build api-gateway
```

## Desarrollo
```bash
cd api-gateway
go test -race ./...         # L1
go vet ./...                # L0
../scripts/e2e-identity-gateway.sh   # L4 (desde la raíz: ./scripts/e2e-identity-gateway.sh)
```
Estándar: `docs/standards/go-standards.md`. La estructura actual es anterior al estándar (falta `internal/config`, `domain`, `service`, `observability`); alinear en F08.2/F09.2.

## Limitaciones conocidas
Sin metadatos `x-pp-*` hacia servicios (F09.2), sin traductor genérico ni tabla declarativa de rutas (F09.3), sin WebSocket (F09.5), sin rate limits (F09.6), sin OpenAPI (F09.7).
