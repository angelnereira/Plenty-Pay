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
| RPC | Permiso | Comportamiento clave |
|---|---|---|
| UpsertWarehouse / ListWarehouses | `inventory:adjust` / `inventory:read` | |
| GetStock / ListStock | `inventory:read` | `available = on_hand − reserved` por bodega/lote |
| AdjustStock | `inventory:adjust` (servicios pos/orders para SALE/RETURN) | movimiento con motivo obligatorio para ADJUSTMENT/WRITE_OFF |
| TransferStock | `inventory:adjust` | TRANSFER_OUT + TRANSFER_IN en la misma transacción |
| ListMovements | `inventory:read` | keyset por fecha |
| ReserveStock / CommitReservation / ReleaseReservation | orders (servicio) | reserva todo-o-nada por pedido; commit genera SALE; TTL |
| UpsertSupplier / ListSuppliers | `inventory:purchase:manage` | |
| CreatePurchaseOrder / UpdatePurchaseOrderStatus / ListPurchaseOrders | `inventory:purchase:manage` | §8.12 domain-model |
| ReceiveGoods | `inventory:receive` | recepción parcial/total por línea; crea lotes; RECEIPT con costo |
| GetReorderSuggestions | `inventory:read` | §5 R6 |

## 5. Reglas
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
