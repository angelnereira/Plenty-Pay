# Ola 2 · El hecho se documenta y se avisa

**Qué cierra**: cada venta genera su documento fiscal (con el PAC simulado mientras Q-11 siga abierta), cada hecho relevante llega a quien debe enterarse y el inventario se verifica solo. Etapas: P0, P3, P6 · M8 ([`../lifecycles.md`](../lifecycles.md)). Procedimiento común: [`README.md`](README.md) §2; contenedor nuevo: §3.

| # | Paso | Contenedores | Nivel | Precedencia | Bloqueo |
|---|---|---|---|---|---|
| 1 | [F20.1–F20.2](#f201f202--servicio-notifications-y-correo) Servicio notifications y correo | notifications | L2 | F08, F09 ✅ | proveedor de correo: modo log sin credenciales |
| 2 | [F20.3](#f203--bandeja-in-app-y-stream) Bandeja in-app y stream | notifications, gateway, app | L4 | F20.2 | — |
| 3 | [F20.4](#f204--push-y-dispositivos) Push y dispositivos | notifications, app | L4 | F20.2 | credenciales FCM: modo log sin ellas |
| 4 | [F20.5](#f205--reglas-de-suscripción-consumidores) Reglas de suscripción | notifications | L2 | F20.2 | — |
| 5 | [F20.6](#f206--preferencias-y-supresiones) Preferencias y supresiones | notifications, app | L2 | F20.5 | — |
| 6 | [Hueco 1](#hueco-1--solicitudes-de-correo-de-identity) Solicitudes de correo de identity | identity, notifications | L2 | F20.2 | — |
| 7 | [F20.8](#f208--pantallas-de-notificaciones) Pantallas de notificaciones | flutter_app | L4 | F20.3 | — |
| 8 | [F15.13](#f1513--aviso-de-pedido-entrante) Aviso de pedido entrante | notifications, app | L4 | F20.3, F20.4 | — |
| 9 | [F20.7](#f207--whatsapp-y-sms) WhatsApp y SMS | notifications | L4 | F20.5 | Q-14 (modo log mientras tanto) |
| 10 | [F13.3](#f133--perfil-fiscal-l2-con-security) Perfil fiscal (L2 con security) | fiscal-invoicing, security | L2 | — | — |
| 11 | [F13.5](#f135--factura-desde-la-venta) Factura desde la venta | pos, orders, fiscal-invoicing, app | L4 | F13.3 | PAC real ⛔ Q-11 (simulador mientras tanto) |
| 12 | [F13.6](#f136--pdf-y-xml-con-qr) PDF y XML con QR | fiscal-invoicing, app | L4 | F13.5 | — |
| 13 | [F13.9](#f139--pantallas-fiscales-y-reporte-mensual-de-itbms) Pantallas fiscales y reporte de ITBMS | flutter_app, fiscal-invoicing | L4 | F13.6 | — |
| 14 | [F16.14](#f1614--inventory-consume-catalogproductchanged) inventory consume `catalog.product.changed` | inventory, catalog | L2 | F15.1 parcial suficiente | — |
| 15 | [F16.16](#f1616--verificación-diaria-de-invariantes-de-inventario) Verificación diaria de inventario | inventory, observability | L2 | F16.10 ✅ | — |

---

### F20.1–F20.2 · Servicio notifications y correo
Ciclo transversal · Nivel L2 · Estado 📝 (dominio y remitentes con L1, sin servicio).
- **Precedencia**: F08, F09 ✅.
- **Leer antes**: `notifications/SPEC.md` §3–§7 (tablas, RPCs, R1–R7), `notifications/internal/domain/*.go`, `network-contracts/proto/notifications.proto`, [`README.md`](README.md) §3 (crear el servidor).
- **Resultado observable**: el contenedor `notifications` corre en producción; `Send` encola, resuelve plantilla y contactos, y entrega por correo (o lo registra en modo log si no hay credenciales, R7) una sola vez por `dedupe_key`.
- **Contrato**: sin cambios (los RPC existen).
- **Datos**: convertir `notifications/migrations/0001_initial.sql` al formato `0001_initial.up.sql`/`.down.sql` (nunca se aplicó en producción) con RLS en `inbox`, `devices`, `preferences` por usuario y tenant, `messages` particionada por mes o, si se difiere la partición, documentarlo como desviación en el README (igual que hizo inventory con `movements`).
- **Código** (crear): `main.go`, `Dockerfile`, `internal/config` (`PP_EMAIL_PROVIDER=resend|log`, `PP_RESEND_API_KEY` desde security o variable de entorno, nunca en el repo), `internal/observability`, `internal/store` (messages, templates, inbox, devices, preferences, suppressions, processed_events), `internal/service` (Send: dedupe → plantilla → contactos con `identity.GetUserContacts` → preferencias → supresión → encolar), `internal/worker` (envía fuera de la transacción con backoff R3: 1 min, 5 min, 30 min, 2 h, luego FAILED), `internal/server`. Reutilizar `internal/domain` existente.
- **Infra**: rol `notifications_svc` en `postgres-db/init` (verificar), usuario NATS que suscribe los subjects de R2, servicio en `docker-compose.yml`, backend en el gateway.
- **Pruebas**: L2 `TestR1_SameDedupeKeyIsOneMessage` (3 envíos → 1 fila, 1 llamada al remitente falso), `TestR3_BackoffThenFailed`, `TestR5_SuppressedAddressGetsNoEmail`, `TestR7_LogModeWithoutCredentials`; pánico, traza y fuga de datos (el correo nunca aparece completo en logs: `TestObs_EmailIsMaskedInLogs`).
- **Desplegar**: primer despliegue del contenedor: `docker compose build notifications && docker compose run --rm --no-deps notifications migrate && docker compose up -d --no-deps notifications`; reconstruir el gateway si se agregó el backend.
- **L4**: `Send` de prueba desde un `grpcurl` dentro de la red (o un RPC de plataforma) → fila SENT o «sandbox» en modo log.
- **Docs al cerrar**: `ARCHITECTURE.md` §2 (notifications desplegado), `docs/architecture/service-dependencies.md`, `event-chains.md` §1, README, status F20.1/F20.2.
- **Terminado cuando**: «Variables validadas» y «Modo log sin credenciales» (05) con el servicio desplegado.

### F20.3 · Bandeja in-app y stream
Nivel L4 · Estado 📝 (`ListInbox`, `MarkRead` en dominio).
- **Resultado observable**: un hecho (p. ej. `PaymentCaptured`) aparece en la bandeja del usuario y llega en vivo por WebSocket sin refrescar.
- **Código**: `StreamInbox` (gRPC server-stream) alimentado por NATS `pp.notifications.inbox.<user>` o por consulta con cursor; el gateway lo expone por su WebSocket (`api-gateway/internal/realtime`, topic `inbox`).
- **App**: S-GEN-08 (`flutter_app/lib/features/notifications/` o donde esté `InboxScreen`) deja de tener datos fijos; insignia de no leídos en el inicio.
- **Pruebas**: L2 `TestF20_3_InboxIsPerUser`, `TestF20_3_MarkReadRejectsForeignItem`; gateway `TestRealtime_InboxTopicRequiresOwnUser`; widget de 4 estados.
- **Terminado cuando**: «Topic inbox» (05) con L4 en el Pixel.

### F20.4 · Push y dispositivos
Nivel L4 · Estado 📝 (`RegisterDevice` en dominio).
- **Resultado observable**: el teléfono registra su token al iniciar sesión y recibe un push de prueba (o queda en modo log si no hay credenciales de FCM).
- **Código**: `PushSender` FCM HTTP v1 (credencial de cuenta de servicio desde security, nunca en el repo), modo log por defecto. App: registrar token con `firebase_messaging` solo si el proyecto ya tiene Firebase configurado; si no, dejar el registro detrás de una bandera y documentarlo (no inventar configuración).
- **Pruebas**: L2 `TestF20_4_TokenBelongsToLastUser`; L1 del cuerpo de FCM sin datos sensibles (R6).
- **Terminado cuando**: «Token por dispositivo» (05) y push recibido en el Pixel (o modo log documentado si falta la credencial, con la pregunta al dueño).

### F20.5 · Reglas de suscripción (consumidores)
Nivel L2 · Estado 📝 (tabla R2 en código).
- **Resultado observable**: cada evento de la tabla R2 genera los mensajes de sus destinatarios y canales, una vez aunque llegue repetido.
- **Código**: consumidor durable por subject (`pp.payments.payment.captured.v1`, `pp.orders.order.paid.v1`, `pp.inventory.stock.low.v1`, …) con `processed_events`; cada regla arma `dedupe_key` `<evento>:<id>:<user>:<canal>`. Solo se suscriben los productores **desplegados**; los demás quedan en la tabla con un test que lo explica.
- **Pruebas**: L2 con NATS efímero `TestNotifications_SameEventThreeTimesIsOneEmail` (aceptación del SPEC §11).
- **Terminado cuando**: «Tabla R2 completa» (05) para los productores desplegados.

### F20.6 · Preferencias y supresiones
Nivel L2 · Estado 📝.
- **Resultado observable**: el usuario apaga el push de mercadeo; los de seguridad y pagos siguen llegando al menos en la bandeja.
- **Pruebas**: L2 `TestR5_TransactionalInAppCannotBeDisabled`, `TestF20_6_HardBounceSuppressesNextEmail` (aceptación SPEC §11).
- **App**: S-GEN-07 conectada (hoy con datos fijos).
- **Terminado cuando**: «R5; seguridad no desactivable» (05).

### Hueco 1 · Solicitudes de correo de identity
Fuente: `docs/architecture/event-chains.md` §3 hueco 1 · Nivel L2.
- **Problema**: invitaciones, reset de contraseña y aviso de bloqueo se escriben en el outbox de identity como `pp.identity.notification.requested.v1`, pero no tienen publicador ni consumidor: **ningún correo de invitación ni reset se entrega**.
- **Contrato**: agregar el subject y su mensaje al catálogo de eventos (§7 de `events.proto`/`docs`); el payload embebe `notifications.SendRequest` (pendiente en F03.2: «identity.NotificationRequested»).
- **Código**: publicador en el relay de identity (`identity/internal/events`), consumidor en notifications que llama a su propio `Send` con `dedupe_key` = `event_id`.
- **Pruebas**: L2 `TestHueco1_InvitationEmailIsDeliveredOnce`.
- **Terminado cuando**: una invitación creada en la app produce un correo (o su registro en modo log) una sola vez; F08.8 (c) y F03.2 se actualizan.

### F20.8 · Pantallas de notificaciones
Nivel L4 · Estado 📝.
- **Resultado observable**: bandeja, preferencias y plantillas del comercio funcionan con datos reales y la bandeja se actualiza en vivo.
- **Terminado cuando**: «Widget tests» (05) + L4 del stream en el Pixel.

### F15.13 · Aviso de pedido entrante
Ficha de diseño: [commerce-plan F15.13](../commerce-plan.md#f1513--aviso-de-pedido-entrante-en-tiempo-real) · Ciclo P5 · Nivel L4 · Estado 📋.
- **Precedencia**: F20.3, F20.4.
- **Resultado observable**: el comercio recibe «Nuevo pedido» en < 5 s (bandeja en vivo + push), solo quien tiene `orders:manage`.
- **Código**: regla R2 `OrderPaid` → comercios del pedido (`merchant.new_order`), destinatarios = miembros con `orders:manage` (consultar a identity); sin datos del comprador en el texto (N-DAT).
- **Pruebas**: L2 `TestF15_13_OnlyOrdersManagersAreNotified`; L4 midiendo el tiempo evento → aviso.
- **Terminado cuando**: «Aviso en < 5 s solo a quien tiene `orders:manage`» (05).

### F20.7 · WhatsApp y SMS
Nivel L4 · Estado 📝 · **Bloqueo**: Q-14 (proveedor y credenciales). Mientras tanto, modo log (R7) y la pantalla de plataforma lo dice. No se implementa contra un proveedor sin credenciales reales.

### F13.3 · Perfil fiscal (L2 con security)
Nivel L2 · Estado 📝 (perfil y credenciales a `security.PutSecret` con step-up hechos).
- **Qué falta**: la prueba L2 contra **security real** (hoy con doble). Agregar a `fiscal-invoicing/test/test_l2.sh` el arranque de security efímero (copiar el patrón de `payments-core/src/test_l2.sh`, que levanta ledger, identity e infra-management efímeros).
- **Pruebas**: `TestL2_F13_3_CredentialNeverInFiscalDB` (después de configurar, ninguna columna de `fiscal` contiene el token; `security.GetSecret` lo devuelve).
- **Terminado cuando**: «Credencial nunca en BD fiscal» (05) en L2 real.

### F13.5 · Factura desde la venta
Ficha de diseño: [commerce-plan F13.5](../commerce-plan.md#f135--cierre-factura-desde-la-venta) · Ciclo P6 · M8 · Nivel L4 · Estado 📝 (servidor con L2 12/12; falta que pos y orders la pidan).
- **Decisión vigente**: pos y orders piden la factura con **tareas durables** (patrón `stock_tasks` de pos) que llaman `fiscal.IssueInvoice`; fiscal-invoicing **no** consume `sale.paid`/`order.paid`. Esto resuelve el hueco 3 de `event-chains.md`: corrige allí la fila (fiscal no figura como consumidor) en el mismo cambio. Cambiar a consumidor en fiscal exigiría un ADR.
- **Precedencia**: F13.3.
- **Leer antes**: `fiscal-invoicing/SPEC.md` R1–R10, aceptación 1, 2 y 4; preferencia de documento en `PosSettings.checkout_preference` y `auto_threshold_minor` (F17.11); S-POS-04/05.
- **Resultado observable**: una venta de caja pagada genera su factura aceptada por el simulador (o recibo interno si la preferencia lo dice); el recibo muestra «Comprobante en proceso de autorización» hasta `InvoiceAccepted`; un sub-pedido del mercado aceptado genera la suya.
- **Contrato**: `Sale.invoice_id` existe; agregar `Sale.invoice_status` (string `PENDING|ACCEPTED|REJECTED|INTERNAL_RECEIPT`) y el equivalente en `SubOrder` si no existen.
- **Datos**: pos `00NN_invoice_tasks` y orders `0002_invoice_tasks`: `invoice_tasks(id, tenant_id, source_type, source_id UNIQUE, status, attempts, next_at, last_error, created_at)`; la fila nace **en la misma transacción** que marca la venta PAID.
- **Código**: pos `internal/service` worker de tareas (lease + backoff, igual que `stock_tasks`), cliente `fiscal.IssueInvoice` con `source = pos_sale:<id>` e `idempotency_key = invoice:<sale>`; consumidor de `pp.fiscal.invoice.accepted.v1`/`rejected` para actualizar `invoice_status` (o consulta al reintentar). orders igual por sub-pedido. Devolución (F17.9): tarea de **nota de crédito** `credit_note:<refund>` contra la factura de la venta (R7 de fiscal).
- **App**: S-POS-05 muestra el estado del documento; «Mis pedidos» igual.
- **Pruebas**: L2 pos `TestL2_F13_5_PaidSaleCreatesOneInvoiceTask`, `TestL2_F13_5_TaskRetriesUntilFiscalAccepts`; fiscal aceptación 2 (timeout × 3 → una factura, sin huecos) ya existe; L2 cruzado con fiscal efímero; aceptación 4 (umbral → recibo interno o fiscal).
- **Desplegar**: respaldo de `pos` y `orders`, migrate, pos + orders + (fiscal si cambió) + gateway.
- **L4**: venta de 1.07 en caja → en la base, `fiscal.invoices` con `source` de la venta y estado ACCEPTED (CUFE `DEMO-…`); devolución → nota de crédito.
- **Trampas conocidas**: N-FIS: una venta cobrada pero no certificada **no** se presenta como factura emitida.
- **Terminado cuando**: «Prueba de aceptación 2» (05) + venta pagada → factura aceptada por el simulador en producción.

### F13.6 · PDF y XML con QR
Nivel L4 · Estado 📝 (reabierto: solo dominio).
- **Resultado observable**: el cliente descarga el PDF con el QR de verificación desde el recibo o «Mis pedidos»; el XML firmado se guarda inmutable.
- **Código**: generar PDF (Go, sin servicios externos) con el QR de la DGI devuelto por el PAC/simulador; guardar PDF y XML en `pp-fiscal` (llave `fiscal_svc`, `scripts/init-buckets.sh`) con clave `<tenant>/<año>/<mes>/<cufe>.{pdf,xml}`; `GetInvoiceDocument` devuelve URL prefirmada de corta duración.
- **Pruebas**: L2 `TestSPEC11_1_InvoiceWithQRStoredInObjectStorage` contra Garage efímero (o el bucket de pruebas), aceptación 1 completa.
- **Trampas conocidas**: Garage no permite «escribir sin borrar» por llave (F07.9): documenta la retención como pendiente de F13/F28.
- **Terminado cuando**: «Prueba de aceptación 1» (05).

### F13.9 · Pantallas fiscales y reporte mensual de ITBMS
Nivel L4 · Estado 📝.
- **Qué falta**: L4 en el Pixel de S-FIN-07/08/09 con documentos reales del simulador; **reporte mensual de ITBMS** del comercio (N-FIS-11): débito por tasa, exento y notas del período que cuadra con las facturas aceptadas. Si el reporte necesita un RPC nuevo (`GetTaxReport(period)`), agrégalo de forma aditiva en `fiscal_invoicing.proto` y su ruta en el gateway.
- **Pruebas**: L2 `TestN_FIS_11_MonthlyReportMatchesAcceptedInvoices`.
- **Terminado cuando**: «Widget tests 4 estados» (05) + reporte de ITBMS que cuadra.

### F16.14 · inventory consume `catalog.product.changed`
Ficha corta: [`../lifecycles.md`](../lifecycles.md) §5 · Ciclo P0 · Nivel L2 · Estado 📋 (paso nuevo, hueco 2).
- **Precedencia**: el evento `catalog.product.changed` ya lo publica catalog (verificar en `catalog/internal/events`).
- **Resultado observable**: al crear un producto con «existencia mínima» 5, inventory tiene su punto de reorden en ≤ 30 s; editar el mínimo lo actualiza; archivar no borra existencias.
- **Contrato**: el evento debe llevar `reorder_point_milli` (o el campo del formulario) y `tracks_lots`: agrégalos de forma aditiva al mensaje del evento si faltan.
- **Datos**: ninguna tabla nueva; `processed_events` de inventory (verificar que exista; si no, crearla en la siguiente migración).
- **Código**: `inventory/internal/events` consumidor durable `inventory-catalog` (patrón del consumidor `catalog-stock` de catalog); aplica `SetReorderPoint` en la bodega por defecto; usuario NATS de inventory con permiso de suscripción a `pp.catalog.product.changed.v1` (`event-bus/nats.conf`).
- **Pruebas**: L2 con NATS efímero `TestF16_14_ProductChangedSetsReorderPointOnce` (evento duplicado → un efecto).
- **Docs al cerrar**: `event-chains.md` (hueco 2 resuelto), `inventory/SPEC.md` §6 (consume), status.
- **Terminado cuando**: el criterio de la ficha corta.

### F16.16 · Verificación diaria de invariantes de inventario
Ficha corta: [`../lifecycles.md`](../lifecycles.md) §5 · Ciclo P3 · M9 · Nivel L2 · Estado 📋 (paso nuevo).
- **Resultado observable**: un job diario recalcula, por (bodega, producto): `on_hand` = Σ movimientos físicos, bloqueado = Σ BLOCK/UNBLOCK, Σ lotes = existencia (si el producto tiene lotes), y publica `pp_inventory_invariant_violations_total`; una diferencia dispara alerta.
- **Código**: `inventory/main.go` goroutine diaria (02:00 de Panamá) con rol `SYSTEM`; reutilizar `SumOfMovements` y `SumOfBlocks` de `internal/store/store.go`; registrar cada violación con bodega y producto (sin datos personales); regla de alerta en Prometheus (`observability/`).
- **Pruebas**: L2 `TestF16_16_HealthyDatabaseHasNoViolations`, `TestF16_16_SeededDifferenceIsDetected` (sembrar con el rol de migración una diferencia en una base efímera).
- **Terminado cuando**: el criterio de la ficha corta.
