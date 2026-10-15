# infra-management

Feature flags, configuración dinámica, mantenimiento y configuración de la app. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go 1.23 |
| Puerto | 50074 (admin `:9100` en servicios propios) |
| Fase del roadmap | F05 (F05.7, F05.8, F05.9) |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | ✅ implementado | Go con `internal/{config,domain,observability,server,service,store}`, contrato `infra_management.proto` |
| Pruebas | ✅ implementadas | 23 pruebas unitarias y de integración pasando con `-race` (`go test -race ./...`) |
| Observabilidad | ✅ implementada | Admin `:9100` (`/healthz/live`, `/healthz/ready`, `/metrics`), logs estructurados JSON con correlación, métricas RED |
| Imagen Docker | ✅ implementada | Distroless Debian 12 nonroot multi-stage, healthcheck con `/app healthcheck`, scrape en Prometheus `:9100` (up) |

## Arranque local
Está integrado en `docker-compose.yml`:
```bash
docker compose up -d infra-management
```
Para verificar salud y métricas:
```bash
curl -s http://localhost:9100/healthz/ready
curl -s http://localhost:9100/metrics
```

## Pruebas
```bash
cd infra-management && go vet ./... && go test -race ./...
```
