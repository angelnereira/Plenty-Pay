# inventory

Bodegas, existencias, movimientos inmutables, reservas con TTL, proveedores, órdenes de compra con recepción y sugerencias de reorden (R6); lotes FEFO (F16.4) y existencia bloqueada con aviso de vencimiento (F16.10). Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go 1.26 |
| Puerto | gRPC `50066`, administración `9100` |
| Fase del roadmap | F16 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Dominio: signo por tipo, motivo obligatorio, R2 (sin negativo salvo venta física), R7 (StockLow ≤ 1 por día), SALE/RETURN solo de pos y orders | ✅ L1 | `internal/domain/stock_test.go` |
| Movimientos y ajustes (F16.2) con idempotencia en la propia fila (`UNIQUE (tenant, key, type)`) | ✅ L2 | `TestIdempotency_*`: misma clave = un movimiento, también con 10 reintentos concurrentes |
| R1: `on_hand = Σ movimientos`; movimientos inmutables (trigger y sin UPDATE/DELETE) | ✅ L2 | `TestR1_*` |
| R3: bloqueo ordenado; 50 salidas concurrentes sobre 30 unidades → exactamente 30 | ✅ L2 | `TestR3_ConcurrentOutflowsNeverOversell` |
| Transferencias atómicas OUT+IN (F16.4 sin lotes) | ✅ L2 | `TestSPEC4_TransferIsAtomic` |
| Bodegas y bodega por defecto (una por tenant, también con altas concurrentes) | ✅ L2 | `TestDefaultWarehouseIsCreatedOnce` |
| RLS y aislamiento entre comercios | ✅ L2 | `TestRLS_TenantsAreIsolated` |
| `StockChanged` y `StockLow` en la misma transacción del movimiento | ✅ L2 · ⏳ en vivo | `TestOutbox_EveryMovementEmitsStockChanged`, `TestR2_*` |
| Reservas con TTL (F16.3, R4): todo o nada, solo pos y orders, confirmación = venta, vencimiento cada 30 s | ✅ L2 | `TestSPEC11_100ConcurrentReservationsOver50Units`, `TestR4_ReservationIsAllOrNothing`, `TestR4_ExpiredReservationsReturnStockAndCannotBeCommitted`, `TestReservation_CommitIsASaleAndReleaseReturns`, `TestReservation_IdempotentAndServiceOnly`; `./inventory/test/test_l2.sh` 17/17 |
| Proveedores, órdenes de compra y recepción (F16.5): RUC+DV, correo y teléfono validados; total = Σ half_up(cantidad × costo / 1000); recepción parcial/total por línea que nunca pasa lo pedido; cada recepción genera RECEIPT idempotente en la misma transacción | ✅ L2 | `TestL2_F16_5_PurchaseOrderLifecycle`; reasons `INVALID_SUPPLIER`, `RECEIPT_EXCEEDS_ORDERED`, `UNKNOWN_ORDER_LINE`, `INVALID_STATE_TRANSITION` (`TestReasons_PurchasingErrorsUseGlossaryNames`) |
| R6 reorden (F16.6): velocidad EWMA α=0.3 sobre 28 días completos (America/Panama) en enteros, cobertura, cantidad sugerida, clase ABC, en tránsito y proveedor habitual | ✅ L1 · ✅ L2 | `internal/domain/reorder_test.go` (cálculo de referencia), `TestL2_R6_ReorderSuggestions` |
| Lotes FEFO (R5) | ✅ L2 | F16.4/F16.8: `TestL2_R5_*`, `TestL2_F16_8_PurchaseReceiptWithLots` |
| Sucursal y alcance (F16.9, R11): bodegas por sucursal, `BRANCH_OUT_OF_SCOPE`, lecturas filtradas, Casa Matriz asignada con identity | ✅ L2 · ✅ L4 | `TestADR0018_*`, `TestF16_9_*`; migración `0007_warehouse_branch` (2026-10-23) |
| Incidencias de recepción (F16.12, R10): dañado entra bloqueado; «Cerrar con faltante» | ✅ L2 · ✅ L4 | `TestL2_R10_*`; migración `0006_receipt_issues` en producción (2026-10-23) |
| Existencia bloqueada y aviso de vencimiento (F16.10, R9) | ✅ L2 · ✅ L4 | `TestL2_F16_10_*`; migración `0005_blocked` en producción (2026-10-23); L4 en el Pixel 8 Pro |
| Observabilidad | ◐ | interceptor, métricas `pp_rpc_*`, `pp_outbox_*` y `pp_inventory_blocked_levels` (F16.10) |
| Despliegue en producción | ⏳ | `~/plentypay-backups/commerce-reset.sh` |

28 pruebas L2 en verde (`./inventory/test/test_l2.sh`, 2026-10-23). Antes: 26 (F16.12), 24 (F16.10) y 19 (2026-10-21). Desplegado en producción 2026-10-21 con la migración `0003_purchasing` (respaldo previo con `pg_dump`); humo de lectura de compras OK.

## Arranque
```bash
docker compose build inventory && docker compose run --rm --no-deps inventory migrate && docker compose up -d --no-deps inventory
```

## Limitaciones conocidas
- `movements` aún no se particiona por fecha: la clave única de idempotencia tendría que incluir la columna de partición. Se hará antes del volumen de F16.
- `StockChanged` se emite por movimiento (sin el *debounce* de 5 s de R8).
- La validación del producto contra catalog usa el permiso base `catalog:read` en nombre del llamador.
