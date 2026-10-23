# pos

Caja de mostrador: sesiones con fondo y arqueo, ventas con precio de catálogo, cobro en efectivo y con billetera PlentyPay, recibo interno e historial. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go 1.26 |
| Puerto | gRPC `50067`, administración `9100` |
| Fase del roadmap | F17 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Dominio: R2 impuesto incluido por línea `half_up`, R4 medios (Σ = total; vuelto en centavos), R7 cobro por otro monto → revisión, R8 anular solo sin cobros electrónicos | ✅ L1 | `internal/domain/sale_test.go` (vectores de domain-model §4) |
| Sesiones (F17.3): una abierta por caja, fondo, entradas y salidas, cierre con diferencia | ✅ L2 | `TestR1_*`, `TestSessionClose_*` |
| Ventas y checkout (F17.4–F17.5): efectivo y billetera; precio siempre del catálogo; descuento solo con `pos:discount:apply` | ✅ L2 | `TestSPEC11_1_CashPlusWalletPaysAndDiscountsStock` (aceptación 1 del SPEC) |
| Atomicidad al pagar: recibo consecutivo (R10), efectivo esperado, tareas de stock y `SalePaid` en UNA transacción | ✅ L2 | mismo caso + `TestR4_CashOnlyPaysAtOnceWithConsecutiveReceipts` |
| Consumidor durable `pos-payments` de `PP_PAYMENTS` (cobros con `reference = {sale, id}`), idempotente por `event_id` | ✅ L2 · ⏳ en vivo | `TestADR0012_DuplicatePaymentEventHasNoEffect`, `TestRLS_SalesAndPaymentEventsAreTenantScoped` |
| Descuento de existencias en inventory con clave `sale:<venta>:<línea>`; inventory caído → diferido con backoff; rechazo → venta para revisión | ✅ L2 | `TestStockWorker_InventoryDownIsDeferredNotLost` |
| Estacionar y retomar (F17.4): OPEN ↔ PARKED solo con la caja abierta (sesión bloqueada `FOR SHARE`), reintento sin cambios, estacionadas bloquean el cierre (`SALES_PENDING`) y no se cobran; no tocan inventario | ✅ L1 · ✅ L2 · ✅ L4 (humo + Pixel 8 Pro) | `TestR13_ParkAndResumeTransitions`, `TestL2_R13_*` (incluye 10 retomas concurrentes → una transición), `TestReasons_ParkAndResumeUseGlossaryNames` |
| Devoluciones (F17.9, R9): por líneas y cantidades, efectivo y saldo PlentyPay, reingreso opcional, confirmación fuerte atada al monto (ADR 0023), `SaleRefunded` por outbox | ✅ L1 · ✅ L2 · ✅ L4 en efectivo (humo por API y Pixel 8 Pro, 2026-10-22); saldo PlentyPay solo L2 | `TestR9_*` (dominio), `TestL2_R9_CashRefundIsAtomicAndIdempotent`, `TestL2_R9_WalletRefundIsDeliveredOnce`, `TestL2_R9_ConcurrentRefundsNeverExceedSold`. Falta la nota de crédito (F13.5) |
| Configuración de caja (F17.11, R14): documento, medios activos, tope de descuento (R3), pie del recibo; `version` optimista | ✅ L2 · ✅ L4 | `TestR14_*`, `TestR3_DiscountWithinLimit`, `TestL2_F17_11_*` (20/20 con las demás); migración `0004_settings` (2026-10-23) |
| Sucursal (F17.12, R15, ADR 0018): la caja se abre en una sucursal del alcance, la venta la copia; fuera de alcance `BRANCH_OUT_OF_SCOPE`; historial filtrado | ✅ L1 · ✅ L2 · ✅ L4 (como dueña) | `TestADR0018_PosBranchOutOfScope` (21/21 con las demás), `TestR15_*`; migración `0005_branch` (2026-10-23) |
| Reporte Z y conteo por denominación (F17.3, R16): calculado y guardado en la transacción del cierre | ✅ L1 · ✅ L2 · ⏳ L4 | `TestF17_3_*`, `TestL2_F17_3_CloseStoresZReport` (22/22 con las demás); migraciones `0006_zreport`, `0007_refund_movement_link` (2026-10-23). L4 pendiente: el teléfono se desconectó |
| Crédito de la casa, puntos, ventas offline, pantalla del cliente | 📋 | responden `UNIMPLEMENTED` |
| Observabilidad | ◐ | `pp_pos_refund_tasks_total{result}`, `pp_pos_stock_tasks_total{result}`, `pp_pos_stock_tasks_pending`, `pp_pos_stock_task_oldest_seconds`, `pp_pos_payment_events_total`. **Faltan** `pp_pos_checkout_duration_seconds` y el histograma de diferencias de caja |
| Despliegue en producción | ✅ | 2026-10-20 (0001); 2026-10-21 migración `0002_park` con respaldo previo (`pos-before-0002-*.sql.gz`); 2026-10-22 migración `0003_refunds` (`pos-before-0003-*.sql.gz`); 2026-10-23 migración `0004_settings` con respaldo previo (`pos-before-0004-*.sql.gz`); 2026-10-23 migración `0005_branch` (`pos-before-0005-*.sql.gz`); 2026-10-23 migraciones `0006_zreport` y `0007_refund_movement_link` (`pos-before-0006-*`, `pos-before-0007-*`) |

17 pruebas L2 en verde (`./pos/test/test_l2.sh`, 2026-10-22).

## Arranque
```bash
docker compose build pos && docker compose run --rm --no-deps pos migrate && docker compose up -d --no-deps pos
```

## Limitaciones conocidas
- La etiqueta de la sesión (`terminal_label`) es el código público del punto de cobro (S-FIN-04) por el que cobra la billetera: el QR de la venta es `https://plentypay.app/t/<código>?sale=<id>&amount=<centavos>`.
- `GetCashSession` sin id devuelve la sesión abierta del cajero (ruta `/v1/pos/sessions/current`).
- Solo efectivo y billetera PlentyPay; los demás medios esperan a sus PSP (Q-02, Q-03).
