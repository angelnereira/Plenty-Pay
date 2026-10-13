# web

Sirve Flutter Web, enlaces de pago, seguimiento público y deep links. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go (estático) |
| Puerto | 8081 (público) (admin `:9100` en servicios propios) |
| Fase del roadmap | F22 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | ✅ F02.8: servidor estático del bundle de Flutter Web (`internal/server`), configuración validada al arrancar (`internal/config`) y paquete de observabilidad propio (`internal/observability`) | `go vet ./...` y `go test -race ./...` OK, 2026-10-12 |
| Pruebas | L1: 10 pruebas (cabeceras de seguridad, política de caché, SPA, 404 para métodos mutables en rutas SPA, path traversal, página de mantenimiento, salud, configuración) | 2026-10-12 |
| Verificado en marcha | Con el bundle real servido en `:8081`: `/` y `/register` → 200 (SPA), assets → 200 con caché inmutable, asset inexistente → 404, `/../` → no escapa del bundle, `/healthz` → 200; sin bundle → 503 con la página de mantenimiento y `/healthz/ready` → 503 | Verificado con binario local y en Docker Compose (2026-10-13) |
| Imagen Docker | ✅ Construida y operando en Docker Compose: distroless nonroot, `healthy` contra `:9100/healthz/ready` | `docker compose up` OK (2026-10-13) |

## Arranque local
```bash
./scripts/build-release.sh web        # construye el bundle y lo deja en web/static/app/
docker compose up -d web              # http://localhost:8081
```
Sin bundle, `web` responde una página de mantenimiento y su `ready` es 503 (SPEC R4).

## Desarrollo
Estructura de `go-standards.md` §2 ya aplicada (`main.go` solo cableado, `internal/{config,server,observability}`). **Falta**: `internal/pb` cuando el contenedor empiece a llamar a otro servicio (F18.6 seguimiento, F23.5 enlaces de pago); hoy no aparece en `network-contracts/consumers.txt` porque no consume ningún `.proto`.

## Limitaciones conocidas
Páginas públicas (`/t/<code>`, `/track/<token>`), `.well-known/*` y el proxy de medios llegan en F23.5, F18.6 y F22.3.

