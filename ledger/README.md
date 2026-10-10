# ledger

Libro mayor de doble entrada: cuentas, asientos inmutables, saldos y holds. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Rust |
| Puerto | 50061 (admin `:9100` en servicios propios) |
| Fase del roadmap | F10 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | 📋 planificado: solo especificación (`SPEC.md`) | |
| Pruebas | — | |
| Imagen Docker | — | |

## Arranque local
Se agrega a `docker-compose.yml` al llegar a su fase (F10). Hasta entonces no forma parte del sistema local.

## Desarrollo
Crear el proyecto siguiendo `docs/standards/rust-standards.md` (estructura de carpetas obligatoria), registrar el contenedor en `network-contracts/consumers.txt` (fila ya prevista) y correr `./scripts/sync-protos.sh`.

## Limitaciones conocidas
Todo pendiente; ver plan en `SPEC.md` §12 y la fase en `05-HOJA-DE-RUTA-30-FASES.md`.
