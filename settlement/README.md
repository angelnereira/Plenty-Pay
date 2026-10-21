# settlement

Liquidación a comercios y conciliación contra extractos de rieles y bancos. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Rust |
| Puerto | 50063 (admin `:9100` en servicios propios) |
| Fase del roadmap | F12 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | 📝 F12.2–F12.4 y F12.7 (2026-10-21): servicio Rust reconstruido sobre la estructura de payments-core (`rust-standards.md` §3). Calendario y destino (cifrado en security, step-up, bloqueo de 48 h), lotes armados desde el extracto de `MERCHANT_PAYABLE` del ledger (R1–R6), pago a la billetera con T6b al instante y al banco con T6 confirmado por la plataforma, jobs (lotes automáticos a las 17:00 de Panamá, reintento de T6b, indicadores), outbox. **Pendiente**: importación de extractos y conciliación (F12.5–F12.6), feriados (R9), conector bancario (Q-10) | `SPEC.md` §12 |
| Pruebas | ✅ L1 `cargo test` 10/10 (selección de partidas con el vector A y R1, R2, R3, R6, desbordes, calendario en hora de Panamá, titular del destino, `reason` estables y `INTERNAL` sin detalle, sobre del evento). ✅ L2 `./settlement/test/test_l2.sh`: base y **ledger reales efímeros**, migración idempotente, sin DELETE, RLS forzada en 4 tablas, y 4 pruebas (aceptación 1 con T6b, R5 con step-up y cifrado, lote bancario sin cobros de prueba confirmado con T6 tras el T5 del riel y lote fallido que libera sus partidas, job una vez por día con RLS) | 2026-10-21 |
| Imagen Docker | ✅ en `docker-compose.yml` | |
| Despliegue | ✅ **2026-10-21**: migración aplicada en producción (respaldo `~/plentypay-backups/settlement-before-deploy-20261021-133804.sql.gz`; las 6 tablas de esbozo vacías se apartaron a `stub_archive_settlement`, sin borrar). L4 de humo por el gateway: resumen, calendario, «Liquidar ahora» (lote de $9.68 pagado a la billetera con T6b, marcado de prueba) y cambio de destino sin step-up → `STEP_UP_REQUIRED` | |
| Observabilidad | ✅ logs JSON en el borde, métricas `pp_settlement_*` en `/metrics`, `/readyz` | |

## Arranque local
`docker compose build settlement && docker compose run --rm --no-deps settlement migrate && docker compose up -d --no-deps settlement`.

## Desarrollo
Crear el proyecto siguiendo `docs/standards/rust-standards.md` (estructura de carpetas obligatoria), registrar el contenedor en `network-contracts/consumers.txt` (fila ya prevista) y correr `./scripts/sync-protos.sh`.

## Limitaciones conocidas
- Sin conector bancario (Q-10): un lote al banco queda «En proceso» hasta que la plataforma confirma la transferencia, y el T6 exige que el ledger tenga los depósitos del riel (T5), que llegan con la conciliación (F12.5–F12.6); mientras tanto `BANK_FUNDS_PENDING`.
- Los cobros de prueba (rieles sin credenciales) solo se liquidan a la billetera del negocio (R2).
- `commission` y `tax` del lote van vacíos: el ledger acredita al comercio el neto; las comisiones se ven por cobro en S-FIN-03.
- El extracto se pide de a 2000 movimientos por lote; un negocio con más espera al lote siguiente.
