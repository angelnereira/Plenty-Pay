# Eventos y mensajería (ADR 0012)

## 1. Qué es un evento y qué NO
- Un **evento** es un hecho **ya ocurrido** y comprometido en la base del productor ("el pago fue capturado"), nunca una orden.
- Sirven para **desacoplar efectos secundarios** (notificar, analizar, reaccionar), **no** para flujos que exigen consistencia inmediata ni para mover dinero: eso son llamadas gRPC idempotentes (`payments-core → ledger.PostTransaction`).
- Regla: *¿puede el emisor seguir correctamente sin saber si alguien reaccionó?* Sí → evento. No → gRPC.

## 2. Transporte
**NATS JetStream** (contenedor `event-bus/`). Los *streams* agrupan subjects por dominio y los define `event-bus/SPEC.md` §3 (fuente de verdad): `PP_IDENTITY`, `PP_PAYMENTS`, `PP_LEDGER`, `PP_SETTLEMENT`, `PP_FISCAL`, `PP_COMMERCE` (catalog, inventory, orders, pos), `PP_LOGISTICS` (logistics, geo), `PP_PAYROLL`, `PP_AUDIT`, `PP_ANALYTICS`.
- **Subject**: `pp.<dominio>.<entidad>.<hecho>.v<N>` en minúsculas (`pp.payments.payment.captured.v1`).
- Retención por stream (7 a 30 días, tabla de `event-bus/SPEC.md` §3); es transporte, **no** archivo (el histórico vive en la base del productor y en `analytics-bi`).
- Almacenamiento `file`, 3 réplicas en producción (1 en desarrollo), dedupe 2 min, `max_deliver=10` con backoff y DLQ `pp.dlq.<consumidor>`.

## 3. Sobre del evento
`plentypay.events.v1.EventEnvelope` serializado en protobuf con el payload tipado en `payload` (`Any`): `event_id` (UUIDv7, también `Nats-Msg-Id`), `event_type`, `schema_version`, `producer`, `tenant_id`, `aggregate_id`, `occurred_at`, `trace_id`. Orden garantizado **por `aggregate_id`**.

## 4. Publicación: outbox transaccional (obligatorio)
1. El productor escribe el cambio de estado **y** la fila de `outbox` en la **misma transacción**.
2. Un *relay* del propio contenedor lee `published_at IS NULL` en orden de `created_at`, publica a JetStream con `Nats-Msg-Id = id`, espera el *ack* y marca `published_at`. Si falla, reintenta.
3. **Prohibido** publicar directo a NATS desde un handler sin outbox.
4. Garantía: **al menos una vez**, orden por entidad, sin pérdida.

## 5. Consumo
- Consumidores **durables** (`<contenedor>-<evento>`), *pull*, ack explícito, `AckWait` 30 s.
- **Idempotencia obligatoria** con `processed_events` (`data-standards.md` §6): el efecto y el INSERT van en la misma transacción. Evento ya visto → ack sin efecto.
- Nunca asumir orden entre entidades o dominios distintos.
- Tras `max_deliver` → DLQ + alerta `pp_event_dlq_depth > 0`; reproceso manual con runbook.
- `schema_version` mayor al soportado → **ignorar con alerta**, nunca procesar a medias.

## 6. Versionado
Mismo régimen que `.proto` (solo aditivo). Cambio incompatible = nuevo `schema_version` y subject `…v2`; el productor publica **ambas** versiones al menos un ciclo de despliegue y retira la vieja con ADR.

## 7. Catálogo de eventos (productor → consumidores)
| Subject | Mensaje (`.proto`) | Productor | Consumidores |
|---|---|---|---|
| `pp.identity.tenant.status_changed.v1` | `identity.TenantStatusChanged` | identity | payments-core, catalog, notifications |
| `pp.identity.session.revoked.v1` | `identity.SessionRevoked` | identity | api-gateway (cierra WebSockets), notifications |
| `pp.audit.<contenedor>.recorded.v1` | `security.AuditRecorded` | **cualquier** contenedor (excepción documentada: subject por productor) | security (registro encadenado), analytics-bi (solo métricas agregadas) |
| `pp.payments.payment.captured.v1` | `payments.PaymentCaptured` | payments-core | pos, orders, notifications, analytics-bi |
| `pp.payments.payment.failed.v1` | `payments.PaymentFailed` | payments-core | pos, orders, notifications, analytics-bi |
| `pp.payments.payment.unknown.v1` | `payments.PaymentUnknown` | payments-core | pos, orders, notifications (plataforma) |
| `pp.payments.refund.succeeded.v1` | `payments.RefundSucceeded` | payments-core | pos, orders, notifications, analytics-bi |
| `pp.ledger.transaction.posted.v1` | `ledger.TransactionPosted` | ledger | analytics-bi, settlement |
| `pp.ledger.hold.status_changed.v1` | `ledger.HoldStatusChanged` | ledger | payments-core |
| `pp.settlement.batch.paid.v1` | `settlement.BatchPaid` | settlement | notifications, analytics-bi |
| `pp.settlement.reconciliation.exception_raised.v1` | `settlement.ReconciliationExceptionRaised` | settlement | notifications (plataforma), analytics-bi |
| `pp.fiscal.invoice.accepted.v1` / `.rejected.v1` | `fiscal.InvoiceAccepted` / `InvoiceRejected` | fiscal-invoicing | pos, orders, notifications, analytics-bi |
| `pp.fiscal.folio.low.v1` | `fiscal.FolioLow` | fiscal-invoicing | notifications |
| `pp.catalog.product.changed.v1` | `catalog.ProductChanged` | catalog | orders (instantáneas), analytics-bi |
| `pp.orders.order.paid.v1` | `orders.OrderPaid` | orders | notifications, analytics-bi |
| `pp.orders.sub_order.status_changed.v1` | `orders.SubOrderStatusChanged` | orders | notifications, analytics-bi |
| `pp.inventory.stock.low.v1` | `inventory.StockLow` | inventory | notifications, analytics-bi |
| `pp.inventory.stock.changed.v1` | `inventory.StockChanged` | inventory | catalog (`in_stock`), analytics-bi |
| `pp.pos.sale.paid.v1` | `pos.SalePaid` | pos | analytics-bi, notifications |
| `pp.pos.sale.refunded.v1` | `pos.SaleRefunded` | pos | analytics-bi |
| `pp.logistics.delivery.status_changed.v1` | `logistics.DeliveryStatusChanged` | logistics | orders, notifications, analytics-bi |
| `pp.geo.geofence.crossed.v1` | `geo.GeofenceCrossed` | geolocation | logistics, notifications |
| `pp.payroll.run.paid.v1` | `payroll.PayrollRunPaid` | payroll | notifications, analytics-bi |

Un productor nuevo agrega su fila aquí **y** el mensaje al `.proto` de su dominio en el mismo cambio.

## 8. Tiempo real hacia el cliente
Solo `api-gateway` expone tiempo real a Flutter: WebSocket `/v1/realtime` multiplexado (ADR 0015; protocolo en `api-gateway/SPEC.md` §5). Se suscribe a streams gRPC (`notifications.StreamInbox`, `logistics.StreamDelivery`, `pos.StreamCustomerDisplay`, `geolocation.WatchSubject`) y reenvía filtrando por tenant/usuario de la sesión. Flutter nunca habla con NATS.
