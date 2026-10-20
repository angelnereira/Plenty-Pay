# Cadenas de reacción entre servicios (auditoría 2026-10-20)

Cada operación de negocio dispara una cadena: llamadas síncronas (gRPC, dentro de la operación) y
eventos (outbox → NATS, consumidores idempotentes, ADR 0012). Este documento cruza lo que definen
los SPEC y `docs/standards/events-and-messaging.md` §7 con lo que **existe y corre en producción**,
para que ningún paso quede como simulación. Se actualiza en el mismo cambio que cierre un eslabón.

## 1. Estado de los contenedores en la máquina de producción

| Contenedor | Código | Desplegado | Nota |
|---|---|---|---|
| identity, security, infra-management, api-gateway, web | sí | sí | identity con el modelo de acceso (ADR 0018) desde 2026-10-19 |
| ledger (Rust, ~4 900 líneas), payments-core (Rust, ~10 300) | parcial | **no** (sin servicio en `docker-compose.yml`) | F10/F11 en curso |
| settlement, fiscal-invoicing, payroll, notifications, analytics-bi | parcial (≤ 1 500 líneas) | no | — |
| catalog, inventory, orders, pos, logistics, geolocation | esqueleto (~150 líneas) | no | F14–F18 |

Consecuencia: en la app solo funcionan contra el servidor cuenta, registro, negocio, equipo, roles,
módulos y revisión de negocios. El resto de módulos muestra estados vacíos o **datos fijos de
demostración** (34 pantallas con datos literales; ver §4). Ninguna cadena de comercio (venta,
compra, inventario, cobro) ocurre todavía en producción.

## 2. Cadenas definidas por los SPEC

| Operación | Pasos síncronos | Eventos y consumidores | Estado |
|---|---|---|---|
| Venta de caja (pos.CompleteSale) | catalog (precio) → payments-core (cobro) → inventory.AdjustStock SALE (si cae: movimiento diferido en outbox de pos) | `pos.sale.paid` → analytics-bi, notifications; fiscal-invoicing emite la factura | no existe |
| Devolución de caja | payments.RefundPayment o salida de caja → inventory RETURN → nota de crédito | `pos.sale.refunded` → analytics-bi | no existe |
| Pedido del mercado (orders.Checkout) | catalog → inventory.ReserveStock (TTL) → payments-core.CreatePaymentIntent con splits | `payments.payment.captured` → orders (Commit de reservas), pos, notifications, analytics-bi; `orders.order.paid` → notifications, analytics-bi | no existe |
| Pago con billetera / compra | payments-core → ledger.CreateHold/CaptureHold/PostTransaction (asiento balanceado, saldo) | `ledger.transaction.posted` → settlement, analytics-bi; `payments.payment.captured` → orders/pos | código parcial, no desplegado |
| Producto creado o editado | — | `catalog.product.changed` → orders (instantáneas), analytics-bi | no existe |
| Movimiento de stock | — | `inventory.stock.changed` → catalog (`in_stock`, ≤ 30 s); `inventory.stock.low` → notifications | no existe |
| Alta/cambio de capacidades, sucursales, roles, membresías | identity (transacción + outbox) | `identity.capabilities.changed` → gateway, pos, catalog, inventory, logistics, payroll; `identity.branch.changed` → pos, fiscal, catalog, inventory, logistics, analytics; `identity.membership.changed` → gateway, payroll | **publicados**; sin consumidores desplegados |
| Revisión de negocio | identity | `identity.tenant.status_changed` → payments-core, catalog, notifications | publicado; sin consumidores |

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
