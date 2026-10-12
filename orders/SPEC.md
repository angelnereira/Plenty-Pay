# SPEC — orders

## 1. Responsabilidad
**Hace**: carrito del cliente y pedidos del **marketplace multi-comercio**: cotización de checkout, creación del pedido con un sub-pedido por comercio, reserva de inventario, cobro único con splits, aceptación/rechazo por comercio con SLA, coordinación con logística y facturación, reembolsos automáticos por rechazo. (ADR 0017)
**No hace**: ventas de mostrador (pos), precios (catalog), stock (inventory), cobros (payments-core), entregas (logistics).

## 2. Ficha
| Campo | Valor |
|---|---|
| Lenguaje | Go |
| Puerto / admin | 50075 / 9100 |
| Contrato | `orders.proto` |
| Esquema | `orders` |
| Fase | F15 |
| Capa | L4 |

## 3. Modelo de datos
```sql
CREATE TABLE orders.carts (user_id uuid PRIMARY KEY, updated_at timestamptz NOT NULL);
CREATE TABLE orders.cart_items (user_id uuid, listing_id uuid, tenant_id uuid NOT NULL, variant_id uuid NOT NULL,
  qty_milli bigint NOT NULL CHECK (qty_milli > 0), added_at timestamptz NOT NULL, PRIMARY KEY (user_id, listing_id));
CREATE TABLE orders.orders (
  id uuid PRIMARY KEY, buyer_user_id uuid NOT NULL, status smallint NOT NULL,
  currency char(3) NOT NULL, items_minor bigint NOT NULL, shipping_minor bigint NOT NULL, discount_minor bigint NOT NULL,
  total_minor bigint NOT NULL, payment_intent_id uuid, delivery_address jsonb, contact_phone text,
  idempotency_key text NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1,
  UNIQUE (buyer_user_id, idempotency_key)
);
CREATE TABLE orders.sub_orders (
  id uuid PRIMARY KEY, order_id uuid NOT NULL, tenant_id uuid NOT NULL, status smallint NOT NULL,
  fulfillment text NOT NULL CHECK (fulfillment IN ('DELIVERY','PICKUP')),
  lines jsonb NOT NULL,                      -- instantánea: listing, variant, nombre, precio, qty_milli, tax
  items_minor bigint NOT NULL, shipping_minor bigint NOT NULL, total_minor bigint NOT NULL,
  reservation_ids uuid[] NOT NULL, delivery_id uuid, invoice_id uuid, refund_id uuid,
  accept_deadline timestamptz, rejected_reason text, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  version int NOT NULL DEFAULT 1
);
CREATE INDEX sub_orders_tenant_status ON orders.sub_orders (tenant_id, status, created_at DESC);
CREATE INDEX sub_orders_accept_deadline ON orders.sub_orders (accept_deadline) WHERE status = 2;
-- + outbox, processed_events, idempotency_keys
```
RLS: `orders` por `buyer_user_id` (políticas por usuario) y `sub_orders` por `tenant_id`.

## 4. RPCs
| RPC | Permiso | Idemp. | Comportamiento | Errores |
|---|---|---|---|---|
| GetCart / SetCartItem / ClearCart | `orders:create:self` | — | máximo 50 líneas, 10 comercios; `qty=0` elimina | `LISTING_UNAVAILABLE`, `CART_LIMIT` |
| QuoteCheckout | `orders:create:self` | — | precios actuales (catalog), disponibilidad (inventory), envío por comercio (logistics tarifa), comisiones si el portador es CUSTOMER | `LISTING_UNAVAILABLE`, `OUT_OF_STOCK` |
| Checkout | `orders:create:self` + step-up si ≥ umbral | sí | §5 R3 | `PRICE_CHANGED`, `OUT_OF_STOCK`, `TENANT_NOT_ACTIVE`, errores de pago |
| GetOrder / ListMyOrders | `orders:read:self` | — | | `NOT_FOUND` |
| CancelOrder | comprador | sí | solo si todos los sub-pedidos están ≤ AWAITING_ACCEPTANCE | `INVALID_STATE_TRANSITION` |
| ListMerchantOrders | `orders:read` | — | sub-pedidos del tenant | |
| AcceptSubOrder / RejectSubOrder / MarkSubOrderReady / MarkSubOrderCompleted | `orders:manage` | sí por estado | transiciones §8.10; reject → reembolso automático | `INVALID_STATE_TRANSITION`, `ACCEPT_DEADLINE_PASSED` |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-FIS-01, N-FIS-03, N-CON-01, N-CON-03, N-CON-08 y N-CON-10. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Un sub-pedido por comercio; cada línea guarda **instantánea** de nombre, precio, impuesto y variante.
- **R2** Solo listados publicados de tenants ACTIVE.
- **R3** Checkout (saga, en este orden; compensaciones entre paréntesis):
  1. Recotizar; si el total difiere del cotizado por el cliente → `PRICE_CHANGED` (sin efectos).
  2. Crear Order `PENDING_PAYMENT` + sub-pedidos (transacción local).
  3. `inventory.ReserveStock` por comercio con TTL = expiración del intent + 5 min (si falla → liberar reservas previas, Order CANCELLED).
  4. `payments.CreatePaymentIntent` con splits = total por comercio, `reference=order` (si falla → liberar reservas, CANCELLED).
  5. Responder al cliente con el intent (`next_action`); el cliente confirma el pago.
  6. Al consumir `PaymentCaptured` → Order PAID, sub-pedidos AWAITING_ACCEPTANCE con `accept_deadline = now + 15 min`, `CommitReservation`, evento `OrderPaid`.
  7. `PaymentFailed`/`EXPIRED` → liberar reservas, Order CANCELLED. `PaymentUnknown` → mantener reservas hasta resolución (máx. 24 h).
- **R4** SLA de aceptación 15 min (configurable por tenant 5–60): vencido → REJECTED automático (`reason=ACCEPTANCE_TIMEOUT`) → reembolso del split (`payments.RefundPayment` con key `suborder-reject:<id>`, sin step-up: lo origina el sistema y queda auditado).
- **R5** Rechazo por comercio → reembolso del split + devolución de stock (movimiento RETURN si ya se comprometió).
- **R6** Aceptado + fulfillment DELIVERY → `logistics.CreateDelivery`; PICKUP → READY notifica al cliente con código de retiro.
- **R7** Facturación: al ACCEPTED, `fiscal.EvaluateDocumentPolicy` del comercio → `IssueInvoice` con `source=sub_order`.
- **R8** Estado del Order se **deriva** de sus sub-pedidos (domain-model §8.10) en cada cambio.
- **R9** Cancelación del comprador: solo antes de ACCEPTED; reembolso total de los splits no aceptados.
- **R10** Consumidores idempotentes; `logistics.DeliveryStatusChanged` DELIVERED → sub-pedido COMPLETED.

## 6. Eventos
Publica: `OrderPaid`, `SubOrderStatusChanged`, `AuditRecorded`. Consume: `PaymentCaptured/Failed/Unknown`, `RefundSucceeded`, `DeliveryStatusChanged`, `InvoiceAccepted/Rejected`, `catalog.ProductChanged` (invalida carritos con precio viejo).

## 7. Dependencias
catalog (GetMarketplaceProduct, precios; 1 s), inventory (Reserve/Commit/Release; 1 s), payments-core (CreatePaymentIntent, RefundPayment; 3 s), logistics (CreateDelivery, cotización envío; 2 s), fiscal-invoicing (2 s, asíncrono por worker), identity (contacto del comprador).

## 8. Configuración
`ORDERS_GRPC_ADDR`, `DATABASE_URL`, `NATS_URL`, `CATALOG_ADDR`, `INVENTORY_ADDR`, `PAYMENTS_ADDR`, `LOGISTICS_ADDR`, `FISCAL_ADDR`, `IDENTITY_ADDR`, `ACCEPT_SLA_MINUTES` (15).

## 9. Observabilidad
`pp_orders_total{status}`, `pp_checkout_duration_seconds`, `pp_sub_orders_auto_rejected_total`, `pp_checkout_failures_total{reason}`.

## 10. Seguridad
Direcciones y teléfonos del comprador visibles para el comercio solo desde ACCEPTED; para el repartidor solo durante la entrega.

## 11. Pruebas de aceptación
1. Carrito con 2 productos de A y 1 de B → un pago con splits A/B (vector E) → 2 sub-pedidos AWAITING_ACCEPTANCE.
2. A acepta, B no responde en 15 min → B REJECTED y reembolso de su split; Order PARTIALLY_FULFILLED → COMPLETED cuando A entrega.
3. Pago fallido → reservas liberadas y stock disponible igual al inicial.
4. Checkout repetido con la misma key → un solo pedido.

## 12. Plan
F15.6 dominio + migraciones → F15.7 carrito + quote → F15.8 checkout saga + consumidores de pagos → F15.9 aceptación/SLA + reembolsos + integración con logística y fiscal → F15.10 pantallas Flutter (marketplace, carrito, checkout, mis pedidos, pedidos del comercio).

## 13. Riesgos
Saga distribuida: cubrir cada paso con pruebas L4 de fallo (toxiproxy) en F29.
