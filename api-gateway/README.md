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
| Código | 📝 parcial: `/healthz`, `/v1/auth/{login,register,refresh}` (register reenvía los consentimientos y propaga el `reason` de identity), `/v1/me`, `/v1/me/permissions`, middleware de autenticación y errores `{error,reason,request_id}` | |
| Pruebas | L1 14 pruebas de handlers + 9 de observabilidad; L4 E2E con identity (30 comprobaciones) — ejecutadas 2026-10-12 | |
| Imagen Docker | Plantilla de `go-standards.md` §6 (`go mod download`, distroless nonroot); construida y `healthy` en Compose — 2026-10-10 . **No reconstruida tras F04.6** (2026-10-12: el daemon de Docker no estaba disponible); sí compila con los mismos parámetros del Dockerfile (`CGO_ENABLED=0 go build -trimpath -ldflags="-s -w"`) | |
| Salud | Puerto admin `:9100` con `/healthz/live` y `/healthz/ready`, subcomando `/app healthcheck`, apagado ordenado con SIGTERM (F02.1). `ready` no depende de identity (matriz de degradación); `/metrics` en F04.6 | L1 `internal/observability` |
| Observabilidad | 📝 Implementado y probado 2026-10-12: logs JSON de una línea con `request_id`, `trace_id` y `span_id`; modelo de error con pila en el origen y registro único en el borde; recuperación de pánicos con `pp_panics_total`; trazas OpenTelemetry con propagación W3C; `/metrics` con contadores. **Falta para cerrar F04.6**: histogramas y el resto de métricas obligatorias (§2.1), puente de logs a OTLP (hoy solo stdout), exportación verificada contra un colector real (F04.1) y `golangci-lint` con las reglas de §14 (herramienta no instalada: no ejecutado) | L1: pruebas `TestObs_*`; L4: E2E 23/23 con la misma traza en gateway e identity |

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
