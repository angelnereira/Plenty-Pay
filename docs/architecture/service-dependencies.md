# Mapa de contenedores y dependencias

Fuente de verdad de **qué contenedores existen, qué puertos usan, a quién pueden llamar y cómo degradan**. `network-contracts/consumers.txt`, `docker-compose.yml`, las `NetworkPolicy` de Kubernetes y la validación mTLS se derivan de este documento. Cambiarlo exige ADR si agrega/quita un contenedor o una arista de llamada.

## 1. Inventario (23 unidades de despliegue)

| # | Carpeta | Tipo | Tecnología | Puerto principal | Responsabilidad (una frase) | Fase |
|---|---|---|---|---|---|---|
| 1 | `api-gateway` | servicio | Go | 8080 (HTTPS/JSON + WS) | Única puerta del cliente: autentica, autoriza por ruta, traduce JSON↔gRPC, tiempo real, webhooks | 9 |
| 2 | `web` | servicio | Go (estático) | 8081 | Sirve la app Flutter Web, páginas públicas (seguimiento, enlaces de pago), archivos de deep links | 22 |
| 3 | `identity` | servicio | Go | 50060 | Usuarios, negocios (tenants), sesiones, roles, permisos, step-up, passkeys | 8 |
| 4 | `ledger` | servicio | **Rust** | 50061 | Libro mayor de doble entrada: cuentas, asientos, saldos, holds | 10 |
| 5 | `payments-core` | servicio | **Rust** | 50062 | Intents, pagos, intentos por riel, comisiones, reembolsos, terminales, webhooks de rieles | 11 |
| 6 | `settlement` | servicio | **Rust** | 50063 | Lotes de liquidación a comercios, conciliación con rieles/bancos | 12 |
| 7 | `fiscal-invoicing` | servicio | Go | 50064 | Facturación electrónica DGI vía PAC, notas, folios, CUFE/QR | 13 |
| 8 | `catalog` | servicio | Go | 50065 | Productos, variantes, precios, listados del marketplace, búsqueda | 15 |
| 9 | `inventory` | servicio | Go | 50066 | Existencias por bodega, lotes, movimientos, reservas, compras, pronóstico de quiebre | 16 |
| 10 | `pos` | servicio | Go | 50067 | Cajas, sesiones de caja, ventas multi-pago, sincronización offline, display del cliente | 17 |
| 11 | `logistics` | servicio | Go | 50068 | Entregas, asignación de repartidores, prueba de entrega, seguimiento público | 18 |
| 12 | `geolocation` | servicio | Go | 50069 | Ubicaciones en vivo, geocercas, distancias/ETAs, geocodificación | 14 |
| 13 | `payroll` | servicio | Go | 50070 | Empleados, turnos, asistencia (biometría/QR/NFC), cálculo y pago de nómina | 19 |
| 14 | `notifications` | servicio | Go | 50071 | Correo (Resend/SMTP), push, SMS, WhatsApp (Jelou), bandeja in-app, plantillas | 20 |
| 15 | `analytics-bi` | servicio | Go | 50072 | Proyecciones de eventos, métricas de negocio, dashboards, anomalías, pronósticos, NL→consulta | 21 |
| 16 | `security` | servicio + OpenBao | Go | 50073 (+8200 OpenBao interno) | Secretos, cifrado por propósito, auditoría encadenada, bloqueo por abuso, certificados mTLS | 5 |
| 17 | `infra-management` | servicio | Go | 50074 | Feature flags, configuración de cliente, límites de tasa, mantenimiento, estado de contenedores | 5 |
| 18 | `orders` | servicio | Go | 50075 | Carrito y pedidos del marketplace multi-comercio, sub-pedidos por comercio (ADR 0017) | 15 |
| 19 | `observability` | plataforma | OSS (Prometheus, Grafana, Loki, Tempo, OTel Collector, Alertmanager) | 9090/3000/3100/3200/4317 | Métricas, logs, trazas, alertas, dashboards | 4 |
| 20 | `postgres-db` | datos | PostgreSQL 16 + PgBouncer | 5432 / 6432 | Base relacional: un esquema y rol por contenedor | 6 |
| 21 | `nosql-db` | datos | ScyllaDB | 9042 | Atributos variables de catálogo, series de ubicación, eventos analíticos de alto volumen | 7 |
| 22 | `event-bus` | datos | NATS JetStream | 4222 (8222 monitor) | Eventos de dominio (outbox), KV para flags/límites | 7 |
| 23 | `object-storage` | datos | Garage (S3-compatible) | 3900 (3903 admin) | Imágenes, PDFs/XML fiscales, respaldos, exportaciones | 7 |

Puerto admin **`:9100`** en todos los servicios propios (`/healthz/live`, `/healthz/ready`, `/metrics`), nunca publicado. Cliente: `flutter_app/` (no es contenedor; sus builds van a `output/` y la versión web la sirve `web`).

## 2. Diagrama lógico
```
                        Flutter (Android · iOS · Linux · Windows · macOS · Web)
                                        │ HTTPS/JSON + WebSocket
                         ┌──────────────┴──────────────┐
                         │          api-gateway        │◄── webhooks de rieles / PAC
                         └──────────────┬──────────────┘
                                        │ gRPC (mTLS)
   ┌──────────┬───────────┬─────────────┼──────────────┬───────────┬──────────┬──────────┐
identity   catalog ⇄ inventory      orders          pos        logistics   payroll   analytics-bi
   │          │            │      │  │  │  │      │ │ │ │       │            │ │ │
   │          └────────────┴──────┘  │  │  └──────┘ │ │ │    geolocation     │ │ └─(consume eventos)
   │                                 │  └───────────┼─┘ │                    │ │
   │                         payments-core ◄────────┘   │                    │ │
   │                          │   │    │                │                    │ │
   │                       ledger │  infra-management   │                    │ │
   │                          ▲   │                     │                    │ │
   │                    settlement└──► security ◄── fiscal-invoicing ◄───────┘ │
   │                                                                          │
 notifications ◄──────────────── (eventos de todos) ───────────────────────────┘
   datos: postgres-db · nosql-db · event-bus · object-storage   |   observability recibe de todos
```

## 3. Matriz de llamadas gRPC permitidas (síncronas)
Toda arista no listada está **prohibida** (NetworkPolicy + validación del SAN mTLS). La tabla dice quién llama (fila) y a quién.

| Llamador | Puede llamar a | Para qué |
|---|---|---|
| api-gateway | identity, payments-core, ledger (solo lectura), settlement, fiscal-invoicing, catalog, inventory, orders, pos, logistics, geolocation, payroll, notifications, analytics-bi, infra-management, security (solo `AppendAuditEvent`, `IsBlocked`) | traducir peticiones del cliente |
| payments-core | ledger, identity, security, infra-management | asientos y holds; estado del tenant; secretos de rieles; flags/límites |
| settlement | ledger, payments-core, identity, security | saldos y asientos de liquidación; pagos del periodo; destino de pago (cifrado) |
| orders | catalog, inventory, payments-core, logistics, fiscal-invoicing, identity | precios/instantáneas, reservas, cobro, entrega, factura, datos del comprador |
| pos | catalog, inventory, payments-core, logistics, fiscal-invoicing | precios, descuento de stock, cobro, entrega a domicilio, factura |
| logistics | geolocation, identity | ubicaciones/ETA/geocercas; datos del repartidor |
| payroll | payments-core, security, geolocation, identity | pago de nómina; cifrado de datos sensibles; validar marcaje en geocerca |
| notifications | identity | contactos y preferencias del destinatario |
| fiscal-invoicing | security | credenciales del PAC por tenant; firma |
| catalog | inventory | disponibilidad para listados (`in_stock`) — lectura |
| inventory | catalog | validar SKU/variante — lectura |
| analytics-bi | — (solo consume eventos y lee réplicas propias) | |
| identity, ledger, security, infra-management, geolocation, web | — (hojas) | |

**Ciclo `catalog ⇄ inventory`**: permitido únicamente con RPC de **solo lectura** y deadline ≤ 500 ms, sin llamadas encadenadas (un RPC de catalog que llamó a inventory nunca dispara una llamada de vuelta). Cualquier otro ciclo está prohibido. **Máximo 4 saltos síncronos** desde el gateway (p. ej. gateway → orders → payments-core → ledger).

## 4. Dependencias de datos

| Contenedor | PostgreSQL (esquema) | ScyllaDB | NATS | Object storage |
|---|---|---|---|---|
| identity | `identity` | — | publica | — |
| ledger | `ledger` | — | publica | — |
| payments-core | `payments` | — | publica/consume | — |
| settlement | `settlement` | — | publica/consume | reportes de conciliación |
| fiscal-invoicing | `fiscal` | — | publica | XML/PDF (retención 5 años) |
| catalog | `catalog` | atributos variables | publica/consume | imágenes |
| inventory | `inventory` | — | publica | — |
| orders | `orders` | — | publica/consume | — |
| pos | `pos` | — | publica/consume | recibos PDF |
| logistics | `logistics` | — | publica/consume | fotos de prueba de entrega |
| geolocation | `geo` | series de ubicación | publica | — |
| payroll | `payroll` | — | publica | comprobantes de pago |
| notifications | `notifications` | — | consume | adjuntos |
| analytics-bi | `analytics` (agregados) | eventos crudos | consume | exportaciones |
| security | `security` (auditoría) + OpenBao | — | consume (`pp.audit.>`) | — |
| infra-management | `infra` | — | KV (flags, límites) | — |
| api-gateway, web | — | — | consume (`pp.identity.session.revoked`) / — | — / bundle web |

## 5. Capas de arranque (orden de `depends_on` y de recuperación ante desastre)
- **L0**: postgres-db, nosql-db, event-bus, object-storage, observability
- **L1**: security, infra-management
- **L2**: identity, ledger, geolocation
- **L3**: payments-core, catalog, inventory, fiscal-invoicing, notifications, logistics
- **L4**: settlement, orders, pos, payroll, analytics-bi
- **L5**: api-gateway, web

Un contenedor solo depende (para estar *ready*) de capas inferiores. Las llamadas de L3→L3 (p. ej. catalog→inventory) son opcionales para *readiness*.

## 6. Matriz de degradación (qué pasa si X cae)

| Cae | Efecto | Comportamiento exigido |
|---|---|---|
| identity | no hay logins nuevos ni refresh | gateway valida access tokens vigentes localmente (JWKS, Fase 5); responde 503 `IDENTITY_UNAVAILABLE` a login |
| ledger | no se pueden asentar pagos | payments-core sigue autorizando con riel solo si puede retener; capturas quedan `CAPTURED` + `ledger_posting=PENDING` y un worker reintenta; alerta a 5 min |
| payments-core | no hay cobros electrónicos | POS permite efectivo y crédito de la casa; orders no confirma pedidos; UI muestra "pagos temporalmente no disponibles" |
| settlement | liquidaciones se retrasan | ningún efecto en cobros; lote se procesa al volver |
| fiscal-invoicing | facturas en cola | venta se completa; factura queda `PENDING` y se emite al volver (dentro del plazo legal; alerta si > 1 h) |
| catalog | no se edita catálogo; marketplace sin búsqueda | POS usa catálogo cacheado (offline); orders rechaza checkout nuevo |
| inventory | sin reservas | POS vende y registra movimiento diferido; orders rechaza checkout de productos con control de stock |
| orders | sin marketplace | resto intacto |
| pos | sin ventas en línea | app POS sigue en modo offline (§9 flutter-standards) |
| logistics / geolocation | sin seguimiento | pedidos se crean; asignación manual; seguimiento muestra último estado |
| payroll | sin marcaje en línea | marcaje offline en el dispositivo y sincronización posterior |
| notifications | mensajes demorados | eventos se acumulan en JetStream (retención 7 d) y se envían al volver |
| analytics-bi | dashboards desactualizados | nada operativo afectado |
| security | no hay secretos nuevos ni cifrado | servicios usan credenciales ya cargadas en memoria (TTL ≤ 1 h); operaciones que requieren `Encrypt/Decrypt` devuelven `UNAVAILABLE`; auditoría se acumula en outbox |
| infra-management | sin cambios de flags | servicios usan último valor cacheado (KV local) |
| event-bus | eventos no se publican | outbox crece (alerta > 60 s); nada se pierde |
| postgres-db | caída total de escrituras | failover automático (CloudNativePG) RTO < 1 min; Compose: indisponible |
| object-storage | sin imágenes/PDFs nuevos | PDFs se generan al volver; imágenes muestran placeholder |
| observability | ceguera | servicios siguen; exportadores descartan con buffer acotado |

## 7. Registro de cambios
Agregar un contenedor o arista: ADR + esta tabla + `consumers.txt` + `docker-compose.yml` + `ARCHITECTURE.md` §2 + NetworkPolicy en Fase 27.
