# SPEC — inventory

## 1. Responsabilidad
**Hace**: bodegas, existencias por (bodega, variante, lote), movimientos inmutables, reservas con TTL, transferencias entre bodegas, proveedores, órdenes de compra y recepción, alertas de stock bajo y sugerencias de reorden basadas en la velocidad real de venta.
**No hace**: precios ni datos de producto (catalog), ventas (pos/orders llaman aquí).

## 2. Ficha
Go · 50066 · `inventory.proto` · esquema `inventory` · Fase F16 · Capa L3.

## 3. Modelo de datos
```sql
CREATE TABLE inventory.warehouses (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, branch_id uuid, name text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE inventory.lots (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, variant_id uuid NOT NULL, code text NOT NULL,
  expires_on date, received_on date, UNIQUE (tenant_id, variant_id, code));
CREATE TABLE inventory.stock_levels (
  tenant_id uuid NOT NULL, warehouse_id uuid NOT NULL, variant_id uuid NOT NULL, lot_id uuid,
  on_hand_milli bigint NOT NULL DEFAULT 0, reserved_milli bigint NOT NULL DEFAULT 0 CHECK (reserved_milli >= 0),
  reorder_point_milli bigint, version bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (warehouse_id, variant_id, lot_id)       -- lot_id NULL → usar uuid cero para PK
);
CREATE TABLE inventory.movements (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, warehouse_id uuid NOT NULL, variant_id uuid NOT NULL, lot_id uuid,
  type smallint NOT NULL, qty_milli bigint NOT NULL CHECK (qty_milli <> 0),   -- con signo: + entra, − sale
  unit_cost_minor bigint, reference_type text, reference_id text, reason text, created_by uuid,
  idempotency_key text NOT NULL, created_at timestamptz NOT NULL, UNIQUE (tenant_id, idempotency_key)
) PARTITION BY RANGE (created_at);
CREATE TABLE inventory.reservations (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, warehouse_id uuid NOT NULL, variant_id uuid NOT NULL,
  qty_milli bigint NOT NULL CHECK (qty_milli > 0), status smallint NOT NULL, reference_type text NOT NULL, reference_id text NOT NULL,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL);
CREATE TABLE inventory.suppliers (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, name text NOT NULL, ruc text, email text, phone text, lead_time_days int);
CREATE TABLE inventory.purchase_orders (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, supplier_id uuid NOT NULL, warehouse_id uuid NOT NULL,
  status smallint NOT NULL, lines jsonb NOT NULL, expected_on date, total_minor bigint NOT NULL, created_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1);
CREATE TABLE inventory.sales_velocity (tenant_id uuid, variant_id uuid, warehouse_id uuid, day date, sold_milli bigint NOT NULL,
  PRIMARY KEY (warehouse_id, variant_id, day));          -- alimentada por movimientos SALE
-- + outbox, idempotency_keys
```

## 4. RPCs
| RPC | Permiso | Comportamiento clave | Errores (`reason`) |
|---|---|---|---|
| UpsertWarehouse / ListWarehouses | `inventory:adjust` / `inventory:read` | | `NOT_FOUND` |
| GetStock / ListStock | `inventory:read` | `available = on_hand − reserved` por bodega/lote | `NOT_FOUND` |
| AdjustStock | `inventory:adjust` (servicios pos/orders para SALE/RETURN) | movimiento con motivo obligatorio para ADJUSTMENT/WRITE_OFF | `VARIANT_NOT_FOUND`, `INVALID_MOVEMENT_TYPE`, `MOVEMENT_REASON_REQUIRED`, `LOT_REQUIRED`, `LOT_EXPIRED`, `OUT_OF_STOCK`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| TransferStock | `inventory:adjust` | TRANSFER_OUT + TRANSFER_IN en la misma transacción | `SAME_WAREHOUSE`, `VARIANT_NOT_FOUND`, `LOT_REQUIRED`, `OUT_OF_STOCK`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| ListMovements | `inventory:read` | keyset por fecha | — |
| ReserveStock / CommitReservation / ReleaseReservation | orders (servicio) | reserva todo-o-nada por pedido; commit genera SALE; TTL | `VARIANT_NOT_FOUND`, `OUT_OF_STOCK`, `NOT_FOUND`, `INVALID_STATE_TRANSITION`, `IDEMPOTENCY_KEY_REUSED` |
| UpsertSupplier / ListSuppliers | `inventory:purchase:manage` | | `NOT_FOUND` |
| CreatePurchaseOrder / UpdatePurchaseOrderStatus / ListPurchaseOrders | `inventory:purchase:manage` | §8.12 domain-model | `VARIANT_NOT_FOUND`, `NOT_FOUND`, `INVALID_STATE_TRANSITION`, `IDEMPOTENCY_KEY_REUSED` |
| ReceiveGoods | `inventory:receive` | recepción parcial/total por línea; crea lotes; RECEIPT con costo | `UNKNOWN_ORDER_LINE`, `RECEIPT_EXCEEDS_ORDERED`, `LOT_REQUIRED`, `NOT_FOUND`, `INVALID_STATE_TRANSITION`, `IDEMPOTENCY_KEY_REUSED` |
| GetReorderSuggestions | `inventory:read` | §5 R6 | — |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-LOG-01 y N-LOG-07. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Movimientos inmutables; `on_hand` = Σ movimientos (job de verificación diario).
- **R2** Por defecto `available` no puede quedar < 0 en reservas y ajustes; ventas POS **sí** pueden dejar negativo (venta física ya ocurrida) marcando alerta `NEGATIVE_STOCK` para revisión (configurable por tenant).
- **R3** Bloqueo por fila de `stock_levels` en orden `(warehouse_id, variant_id)` ascendente.
- **R4** Reservas todo-o-nada; TTL vencido → EXPIRED por job cada 30 s.
- **R5** Lotes: salida FEFO (primero en vencer, primero en salir) si el producto maneja lotes.
- **R6** Sugerencia de reorden: velocidad = media ponderada exponencial de ventas diarias (α=0.3, 28 días); días de cobertura = available / velocidad; sugerir si cobertura < lead_time + 7; cantidad = velocidad × (lead_time + 14) − available − en tránsito.
- **R7** `StockLow` cuando cobertura < lead_time o available ≤ reorder_point (máx. 1 evento/día/variante).
- **R8** `StockChanged` agregado (debounce 5 s por variante) para la proyección de catalog.

## 6. Eventos
Publica `StockLow`, `StockChanged`. Consume: `ProductChanged` (variantes nuevas/archivadas).

## 7. Dependencias
catalog (validar variante, 500 ms, lectura). Llamado por gateway, pos, orders, catalog.

## 11. Pruebas de aceptación
100 reservas concurrentes sobre 50 unidades → exactamente 50 confirmadas; transferencia atómica; sugerencia de reorden con datos sintéticos coincide con cálculo de referencia.

## 12. Plan
F16.1 bodegas/stock → F16.2 movimientos/ajustes → F16.3 reservas → F16.4 transferencias y lotes → F16.5 proveedores/OC/recepción → F16.6 velocidad, StockLow y reorden → F16.7 pantallas Flutter de inventario.

## 13. Estado de implementación (2026-10-20)
- **Implementado**: UpsertWarehouse, ListWarehouses (crea la bodega por defecto «Bodega principal» si no hay), GetStock (sin bodega suma todas; sin movimientos = 0), ListStock (keyset producto/bodega, `only_low`), AdjustStock, TransferStock, ListMovements. Reservas, proveedores, compras, recepción y reorden responden `UNIMPLEMENTED`.
- **Contrato (aditivo)**: `AdjustStockRequest.reference = 8` (qué causó el movimiento, p. ej. `{sale, <id>}` desde pos).
- **Idempotencia**: la clave vive en la fila del movimiento (`UNIQUE (tenant_id, idempotency_key, type)`) con el hash del contenido: misma clave y mismo contenido → el movimiento original; otro contenido → `IDEMPOTENCY_KEY_REUSED`; reintentos concurrentes → uno solo.
- **Quién mueve qué**: SALE y RETURN solo desde pos u orders (`x-pp-actor-service`; el gateway siempre fija `api-gateway`); las personas registran RECEIPT, ADJUSTMENT y WRITE_OFF; TRANSFER solo por TransferStock.
- **Desviaciones**: `movements` sin partición por fecha (ver README); `StockChanged` por movimiento, sin *debounce*.
- **Errores agregados**: `INVENTORY_NOT_TRACKED`, `INVALID_WAREHOUSE`, `DEPENDENCY_UNAVAILABLE`, `TENANT_REQUIRED`.
