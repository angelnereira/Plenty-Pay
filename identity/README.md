# identity

Usuarios, negocios (tenants), sesiones, roles, permisos y confirmación fuerte. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go |
| Puerto | 50060 (admin `:9100` en servicios propios) |
| Fase del roadmap | F08 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | 📝 parcial: Register (con consentimientos N-DAT-02/N-DAT-14 y `reason` estable en cada rechazo), Login, ValidateToken, GetUserPermissions (catálogo de permisos + presets + módulos derivados), RefreshToken con almacén **en memoria** | |
| Pruebas | L1 `go test -race ./...` (48 pruebas: server, auth, permisos) y L4 `scripts/e2e-identity-gateway.sh` (30 comprobaciones, incluye los rechazos por consentimiento) — ejecutadas 2026-10-12 | |
| Imagen Docker | Plantilla de `go-standards.md` §6 (golang:1.24-alpine → distroless nonroot, `go mod download`); construida y `healthy` en Compose — 2026-10-10 . **No reconstruida tras F04.6** (2026-10-12: el daemon de Docker no estaba disponible); sí compila con los mismos parámetros del Dockerfile (`CGO_ENABLED=0 go build -trimpath -ldflags="-s -w"`) | |
| Salud | Puerto admin `:9100` con `/healthz/live` y `/healthz/ready`, subcomando `/app healthcheck`, apagado ordenado con SIGTERM (F02.1); `/metrics` en F04.6 | L1 `internal/observability` |
| Observabilidad | 📝 Implementado y probado 2026-10-12: logs JSON de una línea con `request_id`, `trace_id` y `span_id`; modelo de error con pila en el origen y registro único en el borde; recuperación de pánicos con `pp_panics_total`; trazas OpenTelemetry con propagación W3C; `/metrics` con contadores. Métricas obligatorias §2.1 implementadas 2026-10-12: `pp_rpc_server_requests_total{service,rpc,code}`, `pp_rpc_server_duration_seconds` (histograma con buckets 5 ms–10 s, `_sum`/`_count`), medidores (`pp_outbox_pending`, `pp_outbox_oldest_age_seconds`), `pp_build_info{service,version,commit}` y rechazo de etiquetas prohibidas (§2.3) con prueba. **Falta para cerrar F04.6**: métricas de base de datos y de outbox en uso real (llegan con PostgreSQL, F08.2), puente de logs a OTLP (hoy solo stdout), exportación verificada contra un colector real (F04.1) y `golangci-lint` con las reglas de §14 (herramienta no instalada: no ejecutado) | L1: pruebas `TestObs_*`; L4: E2E 23/23 con la misma traza en gateway e identity |

## Arranque local
```bash
cp .env.example .env       # completar valores (nunca commitear .env)
docker compose up --build identity
```

## Desarrollo
```bash
cd identity
go test -race ./...         # L1
go vet ./...                # L0
../scripts/e2e-identity-gateway.sh   # L4 (desde la raíz: ./scripts/e2e-identity-gateway.sh)
```
Estándar: `docs/standards/go-standards.md`. La estructura actual es anterior al estándar (falta `internal/config`, `domain`, `service`, `observability`); alinear en F08.2/F09.2.

## Limitaciones conocidas
Sin PostgreSQL (F08.2: los consentimientos se guardan hoy solo en memoria), sin rotación/reuso de refresh (F08.3), sin bloqueo progresivo (F08.4), sin tenants/roles personalizados/invitaciones (F08.5–F08.7), sin step-up ni mTLS (F05).
