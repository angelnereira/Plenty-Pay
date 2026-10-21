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
| Código | 📝 bloque A (2026-10-21): servicio Go con la estructura de `go-standards.md` §2 (copia adaptada de inventory: config, observabilidad, migraciones, tenancy, outbox). Perfil fiscal (RUC/DV/razón social desde identity, step-up `security.credentials.update`, credenciales a security), folios sin huecos (R2), contribuyentes (N-FIS-07), política de documento (§8.8). Bloque B: emisión de facturas (R1, R2, R6) con PAC simulado, worker de envío con lease y backoff (R3) y eventos por outbox. **Pendiente**: XML/PDF (C), notas (D), despliegue y pantallas (E) | `SPEC.md` §12 |
| Pruebas | ✅ L1 `go test -race ./...` (dominio con vectores de R1, N-FMT-06, N-FIS-04/07; servicio con fakes; `TestObs_ErrorsCarryStableReason`). ✅ L2 `./fiscal-invoicing/test/test_l2.sh` en base efímera: 12/12 (40 asignaciones simultáneas sin huecos, rollback sin huecos, RLS, contribuyentes, versión del perfil, aceptaciones 1 y 2 del SPEC, idempotencia por clave y origen, tasas desde infra-management, rechazo del PAC, inmutabilidad N-FIS-08) | 2026-10-21 |
| Imagen Docker | ✅ se construye (la usa el L2); aún no está en `docker-compose.yml` | |
| Observabilidad | ✅ paquete copiado de inventory: logs JSON con `request_id`, error con pila y registro en el borde, trazas, `/metrics`, `pp_outbox_pending` | |

## Arranque local
Se agrega a `docker-compose.yml` en el bloque E. Antes de migrar en producción hay que retirar las 5 tablas vacías que se crearon a mano el 2026-10-19 (dueño `postgres`, sin `schema_migrations`), con respaldo previo.

## Desarrollo
Crear el proyecto siguiendo `docs/standards/go-standards.md` (estructura de carpetas obligatoria), registrar el contenedor en `network-contracts/consumers.txt` (fila ya prevista) y correr `./scripts/sync-protos.sh`.

## Limitaciones conocidas
- `PROD` responde `PAC_NOT_CONFIGURED` hasta elegir PAC (Q-11). El DV del RUC solo se valida en formato (algoritmo: Q-22).
- infra-management no guarda vigencias: la tasa usada es la vigente al emitir (que es la fecha del documento) y queda registrada en `legal_param_version`.
