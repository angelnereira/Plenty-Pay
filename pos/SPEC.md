# SPEC — pos

## 1. Responsabilidad
**Hace**: punto de venta de mostrador: cajas (registers), sesiones de caja con arqueo, ventas con múltiples líneas y múltiples formas de pago (efectivo, wallet, tarjeta, QR, crédito de la casa, puntos), ventas estacionadas, anulaciones y devoluciones, sincronización de ventas offline, pantalla del cliente en tiempo real, recibos, lealtad y crédito de la casa (detalle por cliente).
**No hace**: catálogo/precios (catalog), stock (inventory — pos pide descuento), cobros electrónicos (payments-core), facturas fiscales (fiscal-invoicing).

## 2. Ficha
| Campo | Valor |
|---|---|
| Lenguaje | Go |
| Puerto / admin | 50067 / 9100 |
| Contrato | `pos.proto` |
| Esquema | `pos` |
| Otros | object-storage (recibos PDF), NATS |
| Fase | F17 |
| Capa | L4 |

## 3. Modelo de datos
```sql
CREATE TABLE pos.registers (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, branch_id uuid NOT NULL, warehouse_id uuid NOT NULL,
  label text NOT NULL, terminal_id uuid, display_pairing_code text, active boolean NOT NULL DEFAULT true);
CREATE TABLE pos.cash_sessions (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, register_id uuid NOT NULL, opened_by uuid NOT NULL, closed_by uuid,
  opening_float_minor bigint NOT NULL, expected_cash_minor bigint, counted_cash_minor bigint, difference_minor bigint,
  status text NOT NULL CHECK (status IN ('OPEN','CLOSED')), opened_at timestamptz NOT NULL, closed_at timestamptz,
  totals jsonb                                   -- por forma de pago al cierre (reporte Z)
);
CREATE UNIQUE INDEX one_open_session_per_register ON pos.cash_sessions (register_id) WHERE status = 'OPEN';
CREATE TABLE pos.cash_movements (id uuid PRIMARY KEY, session_id uuid NOT NULL, kind text NOT NULL, -- PAY_IN|PAY_OUT|DROP
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), reason text NOT NULL, created_by uuid NOT NULL, created_at timestamptz NOT NULL);
CREATE TABLE pos.sales (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, register_id uuid NOT NULL, session_id uuid NOT NULL, cashier_id uuid NOT NULL,
  status smallint NOT NULL, customer_user_id uuid, customer_taxpayer_id uuid,
  subtotal_minor bigint NOT NULL, discount_minor bigint NOT NULL, tax_minor bigint NOT NULL, total_minor bigint NOT NULL,
  paid_minor bigint NOT NULL DEFAULT 0, refunded_minor bigint NOT NULL DEFAULT 0, currency char(3) NOT NULL,
  receipt_number bigint, invoice_id uuid, document_kind text,       -- FISCAL | INTERNAL
  delivery_id uuid, delivery_address jsonb, recipient_name text, recipient_phone text, delivery_fee_minor bigint NOT NULL DEFAULT 0,
  client_txn_id uuid UNIQUE,                                         -- idempotencia de ventas offline
  offline_created_at timestamptz, needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1
);
CREATE TABLE pos.sale_lines (id uuid PRIMARY KEY, sale_id uuid NOT NULL, variant_id uuid NOT NULL, snapshot jsonb NOT NULL,
  qty_milli bigint NOT NULL CHECK (qty_milli > 0), unit_price_minor bigint NOT NULL, discount_minor bigint NOT NULL DEFAULT 0,
  tax_rate_bps int NOT NULL, tax_minor bigint NOT NULL, total_minor bigint NOT NULL, refunded_qty_milli bigint NOT NULL DEFAULT 0);
CREATE TABLE pos.tenders (id uuid PRIMARY KEY, sale_id uuid NOT NULL, method text NOT NULL,   -- CASH|WALLET|CARD|QR|YAPPY|CLAVE|HOUSE_CREDIT|POINTS
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), cash_received_minor bigint, change_minor bigint,
  payment_intent_id uuid, status text NOT NULL,                 -- PENDING|CAPTURED|FAILED|UNKNOWN|REFUNDED
  created_at timestamptz NOT NULL);
CREATE TABLE pos.customer_accounts (tenant_id uuid, customer_user_id uuid, credit_limit_minor bigint NOT NULL DEFAULT 0,
  points_balance bigint NOT NULL DEFAULT 0,       -- caché; la verdad está en ledger (sub-libros T8/T9)
  PRIMARY KEY (tenant_id, customer_user_id));
CREATE TABLE pos.settings (tenant_id uuid PRIMARY KEY, receipt_footer text, tax_included boolean NOT NULL DEFAULT true,
  max_discount_bps int NOT NULL DEFAULT 1000, points_per_dollar int NOT NULL DEFAULT 0, offline_max_sales int NOT NULL DEFAULT 200,
  offline_max_hours int NOT NULL DEFAULT 24, require_manager_for_void boolean NOT NULL DEFAULT true);
-- + outbox, processed_events, idempotency_keys
```

## 4. RPCs
| RPC | Permiso | Idemp. | Comportamiento | Errores |
|---|---|---|---|---|
| OpenCashSession / CloseCashSession / GetCashSession | `pos:session:manage` | sí | apertura con fondo; cierre con conteo → diferencia y reporte Z | `SESSION_ALREADY_OPEN`, `SALES_PENDING` |
| RecordCashMovement | `pos:session:manage` | sí | entradas/salidas de efectivo con motivo | `SESSION_CLOSED` |
| CreateSale / UpdateSale | `pos:sell` (+`pos:discount:apply`) | sí | líneas con precio de catalog (o caché del cliente validada), impuestos por línea `half_up`; si incluye `delivery_address`, cotiza cobertura/tarifa con `logistics.QuoteDelivery` | `PRICE_STALE`, `DISCOUNT_EXCEEDS_LIMIT`, `OUT_OF_DELIVERY_ZONE` |
| ParkSale / ResumeSale | `pos:sell` | — | OPEN ↔ PARKED | `INVALID_STATE_TRANSITION` |
| Checkout | `pos:sell` | sí | §5 R4 y R12 | `TENDERS_MISMATCH`, `CREDIT_LIMIT_EXCEEDED`, `INSUFFICIENT_POINTS`, `OUT_OF_DELIVERY_ZONE` |
| VoidSale | `pos:void` (+ supervisor si `require_manager_for_void`) | sí | solo sin tenders electrónicos capturados | `HAS_CAPTURED_PAYMENTS` |
| RefundSale | `pos:refund` + step-up | sí | por líneas/cantidades; reembolso por el mismo medio (electrónico → payments.RefundPayment; efectivo → salida de caja); stock RETURN; nota de crédito si hubo factura | `EXCEEDS_SOLD_QTY` |
| GetSale / ListSales / GetReceipt | `pos:sell` | — | recibo como datos estructurados + URL PDF | |
| SyncOfflineSales | `pos:sell` | sí por `client_txn_id` | §5 R7 | resultado por venta |
| StreamCustomerDisplay | dispositivo emparejado | — | stream de la venta activa del register | |
| GetPosSettings / UpdatePosSettings | `pos:sell` / `pos:settings:manage` | sí | | |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-FIS-01, N-FIS-03, N-FIS-04, N-FIS-07, N-CON-01, N-CON-04, N-CON-05, N-CON-06, N-CON-11 y N-LOG-07. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Una sola sesión OPEN por caja; ventas solo dentro de una sesión abierta del cajero.
- **R2** Totales: `total = Σ líneas (precio×qty − descuento) + delivery_fee_minor`; impuesto por línea `half_up`; con `tax_included` el impuesto se extrae: `tax = total_línea − round_half_up(total_línea × 10000 / (10000 + rate))`.
- **R3** Descuento > `max_discount_bps` requiere `pos:discount:apply` de un supervisor (PIN de supervisor = step-up local auditado).
- **R4** Checkout: Σ tenders = total (efectivo puede exceder: calcula vuelto). Cada tender electrónico es un `payments.CreatePaymentIntent` con `reference=sale`; la venta queda AWAITING_PAYMENT hasta que todos estén CAPTURED; un tender UNKNOWN deja la venta en AWAITING_PAYMENT con aviso "confirmando". Al PAID: `inventory` movimiento SALE (bodega del register), fiscal según preferencia, puntos (T8) si aplica, si tiene `delivery_address` crea la entrega en `logistics` (R12), evento `SalePaid`, recibo.
- **R5** Crédito de la casa: requiere cliente identificado con `credit_limit`; saldo deudor + venta ≤ límite; asiento T9 vía payments-core (`PostTransaction` delegado — payments-core es el único escritor de dinero hacia ledger; para memo-libros se expone RPC interno `payments.PostMemoEntry` *a agregar en F17.6*).
- **R6** Efectivo: suma al esperado de caja; vuelto calculado en centavos; el cajón no se abre por software sin venta o movimiento registrado.
- **R7** Offline: el cliente envía ventas con `client_txn_id`; el servidor las procesa en orden; si un precio difiere de la versión vigente al momento offline (> 24 h) o el stock queda negativo → `needs_review=true` (la venta se acepta; el gerente revisa). Solo efectivo/crédito de la casa offline.
- **R8** Anulación ≠ devolución: anular solo antes de pagos electrónicos capturados; después se devuelve.
- **R9** Devolución: cantidades ≤ vendidas − devueltas; reembolso proporcional por medio en orden inverso al pago (último medio primero) salvo que el cajero elija.
- **R10** Número de recibo interno consecutivo por tenant (independiente del folio fiscal).
- **R11** Customer display: solo datos de la venta activa (líneas, total, QR de pago); nunca datos de otros clientes.
- **R12** Venta con envío a domicilio: cuando el cajero registra `delivery_address` y datos del destinatario en la venta, se valida cobertura y tarifa con `logistics.QuoteDelivery`. Al pasar la venta a `PAID`, `pos` invoca `logistics.CreateDelivery` con `source={type:"sale", id:sale_id}`, `recipient_user_id=customer_user_id` (si el cliente está identificado en PlentyPay), `branch_id` y `warehouse_id` del register, y guarda `delivery_id` en la venta. Si la entrega termina en `FAILED` definitivo (3 intentos fallidos, evento `DeliveryStatusChanged`), la venta se marca `needs_review=true` para gestionar el reintegro al cliente y el retorno de mercancía a la bodega.

## 6. Eventos
Publica: `SalePaid`, `SaleRefunded`, `AuditRecorded` (anulaciones, descuentos, diferencias de caja). Consume: `PaymentCaptured/Failed/Unknown`, `RefundSucceeded`, `InvoiceAccepted/Rejected`, `DeliveryStatusChanged` (entregas originadas en ventas POS).

## 7. Dependencias
catalog (precios/lookup; 500 ms), inventory (movimiento SALE/RETURN; 1 s; si cae → movimiento diferido en outbox propio), payments-core (3 s), logistics (QuoteDelivery, CreateDelivery; 2 s), fiscal-invoicing (asíncrono).

## 8. Configuración
`POS_GRPC_ADDR`, `DATABASE_URL`, `NATS_URL`, `CATALOG_ADDR`, `INVENTORY_ADDR`, `PAYMENTS_ADDR`, `LOGISTICS_ADDR`, `FISCAL_ADDR`, `OBJECT_STORAGE_*`.

## 9. Observabilidad
`pp_pos_sales_total{status}`, `pp_pos_checkout_duration_seconds`, `pp_pos_offline_sales_synced_total{result}`, `pp_pos_cash_difference_minor` (histograma). Alerta: diferencias de caja > umbral del tenant (notificación al dueño, no página).

## 10. Seguridad
Acciones sensibles (anular, descuento alto, devolución, diferencia de caja) auditadas con usuario del cajero y supervisor.

## 11. Pruebas de aceptación
1. Venta de 3 artículos pagada con 10.00 efectivo + resto con wallet → PAID, stock descontado, recibo con vuelto correcto.
2. 50 ventas offline sincronizadas dos veces → 50 ventas, sin duplicados.
3. Cierre de caja con conteo distinto → diferencia registrada y evento de auditoría.
4. Devolución parcial de una venta pagada con tarjeta → reembolso parcial + stock RETURN + nota de crédito.

## 12. Plan
F17.1 dominio (totales, impuestos incluidos) → F17.2 migraciones → F17.3 cajas/sesiones + reporte Z → F17.4 ventas/estacionar → F17.5 checkout multi-tender → F17.6 crédito y puntos (`payments.PostMemoEntry`) → F17.7 offline sync → F17.8 customer display stream → F17.9 devoluciones/anulaciones → F17.10 pantallas Flutter del POS.

## 13. Riesgos
Integración con impresoras/cajones por plataforma (Flutter `printing`; ESC/POS por red en F24) — Q-12 modelos de hardware a soportar.
