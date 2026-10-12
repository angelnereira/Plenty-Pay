# api-gateway

Única puerta HTTPS/JSON + WebSocket de la app Flutter y de los webhooks. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go |
| Puerto | 8080 (público) (admin `:9100` en servicios propios) |
| Fase del roadmap | F09 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | 📝 parcial: `/healthz`, `/v1/auth/{login,register,refresh}`, `/v1/me`, `/v1/me/permissions`, middleware de autenticación y errores `{error,reason}` (falta `request_id` en el cuerpo de error que exige SPEC §3.11: pendiente de F09.4) | |
| Pruebas | L1 10 pruebas de handlers; L4 E2E con identity (14 comprobaciones) — ejecutadas 2026-10-10 | |
| Imagen Docker | Plantilla de `go-standards.md` §6 (`go mod download`, distroless nonroot); construida y `healthy` en Compose — 2026-10-10 | |
| Salud | Puerto admin `:9100` con `/healthz/live` y `/healthz/ready`, subcomando `/app healthcheck`, apagado ordenado con SIGTERM (F02.1). `ready` no depende de identity (matriz de degradación); `/metrics` en F04.6 | L1 `internal/observability` |

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
