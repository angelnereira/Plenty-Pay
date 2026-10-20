# Cadenas de reacción entre servicios (auditoría 2026-10-20)

Cada operación de negocio dispara una cadena: llamadas síncronas (gRPC, dentro de la operación) y
eventos (outbox → NATS, consumidores idempotentes, ADR 0012). Este documento cruza lo que definen
los SPEC y `docs/standards/events-and-messaging.md` §7 con lo que **existe y corre en producción**,
para que ningún paso quede como simulación. Se actualiza en el mismo cambio que cierre un eslabón.

## 1. Estado de los contenedores en la máquina de producción (2026-10-20, tarde)

| Contenedor | Código | Desplegado | Nota |
|---|---|---|---|
| identity, security, infra-management, api-gateway, web, event-bus | sí | sí | identity con el modelo de acceso (ADR 0018) |
| ledger | sí (F10) | **sí** desde 2026-10-20 | relay a `PP_LEDGER` publicando; I7 = 0 verificado en producción |
| payments-core | sí (F11.1–F11.7, F11.6 en L2) | **sí** desde 2026-10-20 | wallet (T3), recargas sandbox (T1), cobros por riel sandbox (T2), UNKNOWN, reembolsos por split (T7, migración 0003 aplicada); relay a `PP_PAYMENTS`; proyección de `TenantStatusChanged` |
| settlement, fiscal-invoicing, payroll, notifications, analytics-bi | parcial | no | — |
| catalog, inventory, pos, orders | sí (F15.1–F15.9, F16.1–F16.3, F17.1–F17.5) | pendiente (`stubs-reset.sh`) | productos, vitrina y búsqueda, existencias y reservas, caja y pedidos con outbox a `PP_COMMERCE`; pos y orders consumen `PP_PAYMENTS`; catalog consume `PP_IDENTITY` y `inventory.stock.changed` |
| logistics, geolocation | esqueleto | no | F14, F18 |

## 1.1 Reglas de atomicidad (aplican a todo contenedor que mueve dinero, stock o estado)

1. **Un hecho, una transacción local.** El cambio de estado y su fila de outbox se escriben en la
   MISMA transacción de base de datos. Si falla una, no ocurre ninguna. Nunca hay escritura doble a
   la base y al bus (ADR 0012).
2. **Ninguna transacción de base abarca una llamada a otro servicio o a un riel** (payments-core R6):
   se persiste el estado intermedio, se llama y se persiste el resultado. Un estado intermedio tiene
   dueño (turno con `next_check_at`) y un job que lo retoma.
3. **Exactamente una vez entre servicios por clave determinista**, no por suerte: `hold:<payment_id>`,
   `pay:<payment_id>`, `topup:<payment_id>`, `refund:<refund_id>` (domain-model §5.2). El ledger
   devuelve el asiento original si la clave ya existe con el mismo contenido.
4. **Consumidores idempotentes**: registran `event_id` en `processed_events` en la misma transacción
   que su efecto, y confirman (ack) solo después. Un evento duplicado no tiene efecto.
5. **Lo ambiguo no se adivina**: una respuesta ambigua es UNKNOWN y se resuelve consultando la
   fuente (riel o ledger), con backoff, o a mano con evidencia (domain-model §6.3).
6. **Nada se borra para corregir**: reverso, nota de crédito o evento de corrección. La base lo
   impide (sin DELETE para los roles de servicio; triggers de inmutabilidad).
7. **Una cadena se da por cerrada solo con una prueba que la recorra**: L2 con servicios reales y
   efímeros, y la evidencia en producción en `docs/roadmap/status.md`.

## 2. Cadenas definidas por los SPEC

| Operación | Pasos síncronos | Eventos y consumidores | Estado |
|---|---|---|---|
| Venta de caja (pos.Checkout) | catalog (precio, al armar la venta) → efectivo en caja / billetera: el cliente paga el QR de la venta (payments-core T3 con `reference = {sale, id}`) → pos consume `PaymentCaptured` → en UNA transacción: PAID, recibo, efectivo esperado, tareas de stock y `SalePaid` → worker → inventory.AdjustStock SALE `sale:<venta>:<línea>` (si cae: diferido con backoff) | `pos.sale.paid` → analytics-bi, notifications, fiscal-invoicing (no desplegados) | **código y L2 (2026-10-20)**; despliegue pendiente. Saldo del cliente −, `MERCHANT_PAYABLE` +, venta en el historial, existencias −, todo con claves deterministas |
| Devolución de caja | payments.RefundPayment o salida de caja → inventory RETURN → nota de crédito | `pos.sale.refunded` → analytics-bi | no existe |
| Pedido del mercado (orders.Checkout) | catalog (recotiza) → pedido y sub-pedidos en una transacción → inventory.ReserveStock por comercio `order:<sub_order>` (TTL) → payments-core.CreatePaymentIntent `order:<order>` con un split por comercio → el comprador confirma (T3) → orders consume `PaymentCaptured` → en UNA transacción: PAID, sub-pedidos esperando aceptación con plazo, tareas COMMIT, carrito vaciado de lo comprado y `OrderPaid` → worker → inventory.CommitReservation `commit:<res>:<producto>`. Rechazo o plazo vencido → tareas REFUND (`suborder-reject:<sub>`, T7 solo de ese split) y RETURN (`return:<sub>:<producto>`); cobro tardío sobre pedido cancelado → `late-payment-refund:<sub>` | `orders.order.paid`, `orders.sub_order.status_changed` → notifications, analytics-bi, fiscal-invoicing (no desplegados); `payments.refund.succeeded` | **código y L2 (2026-10-20)**; despliegue pendiente. Saldo del comprador −, `MERCHANT_PAYABLE` + por comercio, existencias − al confirmar, historial de pedidos y de cobros; un rechazo devuelve dinero y existencias con claves deterministas |
| Pago con billetera / compra | payments-core → ledger.CreateHold + CaptureHold (T3, hold y asiento en una transacción del ledger) | `ledger.transaction.posted` y `ledger.hold.status_changed` → settlement, analytics-bi; `payments.payment.captured` → orders, pos, notifications | **en producción (2026-10-20)**. Saldo del pagador −, `MERCHANT_PAYABLE` +, comisión e ITBMS a plataforma, extracto de los dos lados, lista de cobros del comercio. Consumidores aún no desplegados; realtime `payment.status` pendiente (F20/F23.4: la app consulta el intent) |
| Recarga de wallet (T1) | payments-core → riel (sandbox) → captura local + outbox → worker → ledger.PostTransaction `topup:<id>` | `payments.payment.captured`, `ledger.transaction.posted` | **en producción (2026-10-20)**. Riel ambiguo → UNKNOWN → job de consulta → CAPTURED, un solo asiento |
| Cobro por riel externo (T2) | payments-core → riel (sandbox) → captura + outbox → worker → ledger `pay:<id>` (RAIL_RECEIVABLE, neto, comisión, ITBMS, comisión del riel) | ídem | en producción (sandbox) |
| Producto creado o editado | — | `catalog.product.changed` → orders (instantáneas), analytics-bi | no existe |
| Movimiento de stock | — | `inventory.stock.changed` → catalog (`in_stock`, ≤ 30 s, consumidor `catalog-stock`); `inventory.stock.low` → notifications | **código y L2** (catalog); notifications pendiente |
| Alta/cambio de capacidades, sucursales, roles, membresías | identity (transacción + outbox) | `identity.capabilities.changed` → gateway, pos, catalog, inventory, logistics, payroll; `identity.branch.changed` → pos, fiscal, catalog, inventory, logistics, analytics; `identity.membership.changed` → gateway, payroll | **publicados**; sin consumidores desplegados |
| Revisión de negocio | identity | `identity.tenant.status_changed` → payments-core (proyección R2, durable, ack acotado), catalog, notifications | **payments-core consume en producción** (2026-10-20); catalog y notifications pendientes |

## 3. Huecos de diseño encontrados (a corregir en los documentos antes del código, ADR 0010)

1. **Las solicitudes de correo de identity no llegan a nadie.** Invitaciones, reset de contraseña y
   aviso de bloqueo escriben `pp.identity.notification.requested.v1` en el outbox, pero el subject
   no está en el catálogo de §7, el relay no tiene publicador para él (queda pendiente para
   siempre) y notifications no está desplegado. Hoy **ninguna invitación ni reset se entrega**.
   Corrección: agregar el mensaje `notifications.SendRequest` (pendiente de F20.2), su fila en §7 y
   el publicador en el relay de identity; desplegar notifications.
2. **Un producto nuevo no avisa a inventario.** `catalog.product.changed` solo lo consumen orders y
   analytics-bi. El formulario de producto pide «existencia mínima», que vive en inventory (alertas
   y reorden): sin consumidor, ese dato no llega. Corrección propuesta: inventory consume
   `catalog.product.changed` para registrar la variante rastreable y su mínimo.
3. **La factura de una venta no está en el catálogo de eventos.** `event-bus/nats.conf` ya permite a
   fiscal-invoicing suscribirse a `pp.pos.sale.paid.v1` y `pp.orders.order.paid.v1`, pero §7 no lo
   lista como consumidor. Corrección: agregarlo a §7 (fiscal-invoicing SPEC lo describe como
   asíncrono).
4. **Las capacidades apagadas no se aplican fuera de identity.** El gateway propaga
   `x-pp-capabilities`, pero ningún servicio de negocio desplegado lo verifica todavía (R21: cada
   servicio responde `CAPABILITY_DISABLED`). Se cubre al construir cada contenedor (plan de
   adopción, paso 5).

## 4. Datos de demostración en la app (no deben verse en producción)

Actualización 2026-10-20: billetera, pagos, cobros y puntos de cobro usan datos reales; los módulos
sin servicio ya no se abren. Quedan subpantallas de ejemplo dentro de Cuenta, Negocio y Plataforma
(lista en `docs/roadmap/status.md`, F11).


Pantallas con datos literales en el código (2026-10-20): analytics (4), Mi negocio S-ADM-04 a 07
(4), finanzas (4), fiscal (2), inventario (2), logística (5), pedidos (1), nómina (4), plataforma
(6), caja (1), billetera (1). Mi negocio, Equipo, Roles, Módulos y Aceptar invitación se
reconstruyeron sobre identity el 2026-10-20. Regla: una pantalla sin servicio desplegado muestra su
estado vacío o «disponible pronto», nunca datos inventados (AGENTS.md §2.11–12).

## 5. Orden de cierre

Sigue el roadmap (sin adelantar fases): F10 ledger y F11 payments-core (la cadena «compra → saldo →
registro»), F20.2 solicitudes de correo (hueco 1), F15 catalog/orders, F16 inventory (huecos 2 y 3),
F17 pos. Cada contenedor entra a `docker-compose.yml`, consume sus eventos con `processed_events` y
se despliega en producción solo con autorización explícita del dueño.
