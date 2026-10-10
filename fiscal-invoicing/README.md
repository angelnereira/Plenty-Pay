# fiscal-invoicing

Facturación electrónica DGI vía PAC: facturas, notas, folios, CUFE/QR. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go |
| Puerto | 50064 (admin `:9100` en servicios propios) |
| Fase del roadmap | F13 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | 📋 planificado: solo especificación (`SPEC.md`) | |
| Pruebas | — | |
| Imagen Docker | — | |

## Arranque local
Se agrega a `docker-compose.yml` al llegar a su fase (F13). Hasta entonces no forma parte del sistema local.

## Desarrollo
Crear el proyecto siguiendo `docs/standards/go-standards.md` (estructura de carpetas obligatoria), registrar el contenedor en `network-contracts/consumers.txt` (fila ya prevista) y correr `./scripts/sync-protos.sh`.

## Limitaciones conocidas
Todo pendiente; ver plan en `SPEC.md` §12 y la fase en `05-HOJA-DE-RUTA-30-FASES.md`.
