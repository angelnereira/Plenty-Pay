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
| Devoluciones, crédito de la casa, puntos, ventas offline, pantalla del cliente, configuración | 📋 | responden `UNIMPLEMENTED` |
| Observabilidad | ◐ | `pp_pos_stock_tasks_total{result}`, `pp_pos_stock_tasks_pending`, `pp_pos_stock_task_oldest_seconds`, `pp_pos_payment_events_total`. **Faltan** `pp_pos_checkout_duration_seconds` y el histograma de diferencias de caja |
| Despliegue en producción | ✅ | 2026-10-20 (0001); 2026-10-21 migración `0002_park` con respaldo previo (`pos-before-0002-*.sql.gz`) |

14 pruebas L2 en verde (`./pos/test/test_l2.sh`, 2026-10-21).

## Arranque
```bash
docker compose build pos && docker compose run --rm --no-deps pos migrate && docker compose up -d --no-deps pos
```

## Limitaciones conocidas
- La etiqueta de la sesión (`terminal_label`) es el código público del punto de cobro (S-FIN-04) por el que cobra la billetera: el QR de la venta es `https://plentypay.app/t/<código>?sale=<id>&amount=<centavos>`.
- `GetCashSession` sin id devuelve la sesión abierta del cajero (ruta `/v1/pos/sessions/current`).
- Solo efectivo y billetera PlentyPay; los demás medios esperan a sus PSP (Q-02, Q-03).
