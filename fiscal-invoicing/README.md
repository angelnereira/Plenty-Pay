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
| Código | 📝 bloque A (2026-10-21): servicio Go con la estructura de `go-standards.md` §2 (copia adaptada de inventory: config, observabilidad, migraciones, tenancy, outbox). Perfil fiscal (RUC/DV/razón social desde identity, step-up `security.credentials.update`, credenciales a security), folios sin huecos (R2), contribuyentes (N-FIS-07), política de documento (§8.8). Bloque B: emisión de facturas (R1, R2, R6) con PAC simulado, worker de envío con lease y backoff (R3) y eventos por outbox. Bloque D: notas de crédito y débito (R7, N-FIS-08). Bloque E: rutas `/v1/fiscal/*` en el gateway, servicio en `docker-compose.yml` y pantallas S-FIN-07/08/09 en la app. **PAC seleccionable (ADR 0022)**: registro de adaptadores (`internal/pac`), adaptador de The Factory HKA por `github.com/angelnereira/hka-sdk` (fijado al commit `6a8ebe6`) con montos exactos desde centavos, validación previa sin red antes de numerar, lectura de credenciales desde security al enviar y traducción de los códigos de HKA; simulador conservado; `ListPacProviders`; migración `0002` (adaptador y sucursal por documento, dirección y ubicación del receptor, tipo `GOBIERNO`). **Pendiente**: desplegar (`~/plentypay-backups/fiscal-deploy.sh`, con respaldo), probar contra el ambiente de integración de HKA (necesita los tokens del negocio) y XML/PDF (C) | `SPEC.md` §12, ADR 0022 |
| Pruebas | ✅ L1 `go test -race ./...` (dominio con vectores de R1, N-FMT-06, N-FIS-04/07; adaptador HKA contra un servidor SOAP falso local: montos exactos, receptor por tipo, códigos 200/102/109/119/300/401, red caída, tokens fuera de los errores; servicio con fakes: credenciales desde security, alertas, defecto por documento ilegible, validación previa sin consumir folio; `TestObs_ErrorsCarryStableReason`). ✅ L2 `./fiscal-invoicing/test/test_l2.sh` en base efímera: 17/17 (2026-10-21, con la migración 0002 y `TestL2_ADR0022_*`). ⚠ **No ejecutado**: envío real al ambiente de integración de HKA (faltan los tokens del negocio). Antes: 15/15 (notas de crédito y débito con R7 y concurrencia, 40 asignaciones simultáneas sin huecos, rollback sin huecos, RLS, contribuyentes, versión del perfil, aceptaciones 1 y 2 del SPEC, idempotencia por clave y origen, tasas desde infra-management, rechazo del PAC, inmutabilidad N-FIS-08) | 2026-10-21 |
| Imagen Docker | ✅ se construye (la usa el L2, con el SDK de HKA descargado en el build); en `docker-compose.yml` con la red `pac-egress` para salir al PAC, sin desplegar | |
| Observabilidad | ✅ paquete copiado de inventory: logs JSON con `request_id`, error con pila y registro en el borde, trazas, `/metrics`, `pp_outbox_pending`. Envío al PAC: `pac needs attention` (warn, `peer.service=pac-<adaptador>`) y `pac rejected document format` (defecto con pila), con `pp.invoice_id` y `pp.pac_provider`; las credenciales nunca se registran (`TestObs_HKATokensNotInErrors`, `TestR3_SendUsesCredentialsFromSecurity`) | |

## Arranque local
Se agrega a `docker-compose.yml` en el bloque E. Antes de migrar en producción hay que retirar las 5 tablas vacías que se crearon a mano el 2026-10-19 (dueño `postgres`, sin `schema_migrations`), con respaldo previo.

## Desarrollo
Crear el proyecto siguiendo `docs/standards/go-standards.md` (estructura de carpetas obligatoria), registrar el contenedor en `network-contracts/consumers.txt` (fila ya prevista) y correr `./scripts/sync-protos.sh`.

## Limitaciones conocidas
- `PROD` responde `PAC_NOT_CONFIGURED` mientras `FISCAL_PROD_ENABLED` no sea `true` (se enciende tras la validación legal, F30.3). El DV del RUC solo se valida en formato (algoritmo: Q-22; HKA ofrece `ConsultarRucDV`, aún sin usar).
- Con HKA la factura lleva una sola forma de pago: el contrato aún no trae el monto de cada una (ADR 0022 §6). Solo USD.
- La salida a internet (`pac-egress`) no está limitada a los dominios de HKA.
- Tras un `102` (duplicado) se recupera el CUFE con `EstadoDocumento`, que no devuelve el QR: ese documento queda sin QR hasta el bloque C.
- infra-management no guarda vigencias: la tasa usada es la vigente al emitir (que es la fecha del documento) y queda registrada en `legal_param_version`.
