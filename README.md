<div align="center">

<img src="flutter_app/web/icons/Icon-192.png" alt="PlentyPay" width="96" height="96">

# PlentyPay

**Vende. Cobra. Entrega. Factura. Entiende tus números.**<br>
Una sola plataforma de comercio y pagos para Panamá — del mostrador al marketplace.

![Versión](https://img.shields.io/badge/app-v0.17.0-D32D2F?style=for-the-badge)
![Rust](https://img.shields.io/badge/Rust-n%C3%BAcleo%20de%20dinero-000000?style=for-the-badge&logo=rust&logoColor=white)
![Go](https://img.shields.io/badge/Go-servicios-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![Flutter](https://img.shields.io/badge/Flutter-una%20sola%20app-02569B?style=for-the-badge&logo=flutter&logoColor=white)
![Sandbox](https://img.shields.io/badge/pagos-sandbox%20%C2%B7%20sin%20dinero%20real-F59E0B?style=for-the-badge)

[Producto](00-PLENTYPAY-BLUEPRINT-FUNCIONAL.md) · [Arquitectura](ARCHITECTURE.md) · [Hoja de ruta](05-HOJA-DE-RUTA-30-FASES.md) · [Estado con evidencia](docs/roadmap/status.md) · [Decisiones (ADR)](docs/adr/README.md)

*Creado y dirigido por [Angel Nereira](https://github.com/angelnereira)*

</div>

---

## Qué es

Un negocio vende, cobra en cualquier forma de pago, controla inventario, entrega, paga a su equipo y factura ante la DGI. Una persona paga, recibe dinero y compra en un marketplace compartido. Todo en **una app** (Android, iOS, Linux, Windows, macOS y Web) sobre **23 contenedores** aislados, con el dinero en un núcleo **Rust** de doble entrada. Descripción de producto sin tecnicismos: [`00-PLENTYPAY-BLUEPRINT-FUNCIONAL.md`](00-PLENTYPAY-BLUEPRINT-FUNCIONAL.md).

| | |
|---|---|
| **Dinero exacto** | Enteros en centavos, doble entrada, holds y reversos; nunca `float`. |
| **Gobernado por documentos** | ADR → dominio → norma → SPEC → código (ADR 0010). |
| **Cumplimiento por diseño** | Reglas `N-…` de Panamá y estándares ISO; ningún valor legal en el código. |
| **Observable** | Logs estructurados, trazas W3C y `request_id` en cada fallo. |
| **Sin proveedor de nube** | Todo código abierto; Compose hoy, Kubernetes + OpenTofu como objetivo. |

> **Estado (2026-10-24, app v0.17.0)**: en producción corren **13 servicios de aplicación** — identity, api-gateway, ledger, payments-core, settlement (Rust), fiscal-invoicing, catalog, inventory, pos, orders, security, infra-management y web — sobre la pila de datos y observabilidad completa, con la app Flutter conectada a ellos. Los rieles de pago externos y el PAC están en **sandbox/simulador: nada mueve dinero real**. **Sin servidor** (solo especificados, sus módulos muestran «Disponible próximamente»): logistics, geolocation, payroll, notifications y analytics-bi. Evidencia por paso: [`docs/roadmap/status.md`](docs/roadmap/status.md) · continuidad: [`docs/roadmap/continuity.md`](docs/roadmap/continuity.md) · auditoría: [`docs/audits/2026-10-21-comercio-estado-real.md`](docs/audits/2026-10-21-comercio-estado-real.md).

Leyenda: ✅ implementado y verificado · 📝 implementado en parte (se indica qué falta) · 📋 solo especificado (SPEC + contrato, sin servidor).

## 1. Arquitectura

```
 Cliente único Flutter (Android · iOS · Linux · Windows · macOS · Web) — módulos según permisos
        │ HTTPS/JSON + WebSocket /v1/realtime (ADR 0015)        ▲ bundle Flutter Web
        ▼                                                       │
   api-gateway :8080  ──────────────────────────────────────►  web :8081
        │ gRPC (metadatos x-pp-tenant / x-pp-actor / traceparent; ADR 0003, 0011)
        ▼
 ┌─ Go ────────────────────────────────────────────────────────────────────────┐
 │ identity · catalog ⇄ inventory · orders · pos · fiscal-invoicing · security │
 │ infra-management                                                             │
 ├─ Rust (núcleo de dinero) ────────────────────────────────────────────────────┤
 │ payments-core ─► ledger ◄─ settlement                                        │
 └──────────────────────────────────────────────────────────────────────────────┘
        │ SQL (esquema + rol + RLS por contenedor)      │ outbox → NATS JetStream
        ▼                                               ▼
 postgres-db (PgBouncer) · nosql-db (ScyllaDB) · event-bus (NATS) · object-storage (Garage S3)
        ▲ métricas · logs · trazas de todos
 observability: OTel Collector → Prometheus · Loki · Tempo · Alertmanager · Grafana
```

Principios (no se negocian; detalle en [`ARCHITECTURE.md`](ARCHITECTURE.md) y los ADR):
- **Una carpeta = un contenedor aislado**; solo `network-contracts/` es compartida (ADR 0002/0016). Se verifica con `scripts/check-isolation.sh`.
- **Entre contenedores solo gRPC** contra un `.proto`; **Flutter solo habla con `api-gateway`** por HTTPS/JSON + WebSocket.
- **Dinero = enteros en centavos y doble entrada**: solo `ledger` escribe asientos, solo `payments-core` orquesta cobros y habla con rieles (`UNKNOWN` no es ni éxito ni fallo), solo `settlement` liquida al comercio. El dinero nunca se mueve por eventos.
- **Tenant y actor salen del token validado** (metadatos), nunca del cuerpo; todo query filtra por tenant y RLS es la segunda barrera.
- **Eventos solo por outbox** con consumidores idempotentes; mutaciones reintentables con `Idempotency-Key`.
- **Ningún valor legal en el código**: tasas, topes y plazos se leen de parámetros `legal.pa.*` vigentes en la fecha del hecho.
- **Observabilidad desde el primer RPC**: logger JSON estructurado, errores con pila registrados una sola vez en el borde, trazas W3C y `request_id` hacia el cliente sin detalle interno.

### Flujos implementados
| Flujo | Recorrido real hoy |
|---|---|
| Registro / login | app → gateway `/v1/auth/*` → identity (consentimientos N-DAT-02, `reason` estable, sesiones con refresh único) → `/v1/me/permissions` → módulos habilitados |
| Venta en caja | pos.CreateSale (precios y tasas de catalog) → Checkout: efectivo con vuelto o saldo PlentyPay (payments-core → ledger) → descuento de stock en inventory → recibo; opcional estacionar/retomar, devolver y anular |
| Compra en marketplace | orders.Checkout → inventory.ReserveStock ×N → payments-core (un cobro con splits por comercio) → sub-pedidos → aceptación con plazo → listo → completado; rechazo = reembolso + devolución de existencias |
| Pago / transferencia | pay-link o QR de terminal → payments-core.CreatePaymentIntent → Confirm (step-up sobre el umbral) → ledger Hold/Capture → evento `PaymentCaptured` → WebSocket `payment.status` |
| Facturación | fiscal-invoicing.IssueInvoice (folios sin huecos) → worker al PAC (simulador o HKA seleccionable, ADR 0022) → notas de crédito/débito |
| Liquidación | settlement (calendario) → lote desde el extracto de `MERCHANT_PAYABLE` → pago a billetera o banco confirmado → asiento en ledger → `BatchPaid` |

## 2. Distribución de servicios y estado

| Contenedor | Tecnología | Puerto gRPC | Estado | Qué hace hoy |
|---|---|---|---|---|
| [api-gateway](api-gateway/SPEC.md) | Go | 8080 (HTTP) | ✅ | ~120 rutas `/v1` (auth, me, business, catalog, inventory, pos, cart/orders, marketplace, fiscal, wallet/payments, terminals, settlement, platform), validación de token y permiso por ruta, `Idempotency-Key`, rate limit, WebSocket `/v1/realtime`, subida de imágenes a S3 (ADR 0021), OpenAPI |
| [web](web/SPEC.md) | Go | 8081 (HTTP) | ✅ | Sirve el bundle Flutter Web con CSP estricta, HSTS, caché inmutable y fallback SPA; página de mantenimiento si falta el bundle |
| [identity](identity/SPEC.md) | Go | 50060 | ✅ | Usuarios, consentimientos, sesiones, recuperación de contraseña, tenants, perfiles de negocio y capacidades, sucursales, membresías con alcance, roles y plantillas, invitaciones, confirmación fuerte (PIN y WebAuthn, ADR 0020); 11 migraciones con RLS |
| [ledger](ledger/SPEC.md) | Rust | 50061 | ✅ | Libro de doble entrada: `PostTransaction`, holds (crear/capturar/liberar), reversos, saldos, extractos, cadena de hash; L2 25/25 |
| [payments-core](payments-core/SPEC.md) | Rust | 50062 | 📝 | Intents, confirmación, cancelación, reembolsos, terminales y QR públicos, políticas de comisión, cotización de tarifas, código personal para recibir (F11.10), webhooks de rieles, resolución de `UNKNOWN`; rieles en sandbox |
| [settlement](settlement/SPEC.md) | Rust | 50063 | 📝 | Calendario y destino de pago cifrado con step-up, lotes, payout a billetera o banco, resumen, jobs, conciliación y excepciones. Falta la conciliación con extractos reales (F12.5–F12.6) |
| [fiscal-invoicing](fiscal-invoicing/SPEC.md) | Go | 50064 | 📝 | Perfil fiscal, folios, contribuyentes, factura con worker al PAC, notas de crédito/débito, política documental. Falta PDF/XML, reporte de ITBMS y envío real a HKA |
| [catalog](catalog/SPEC.md) | Go | 50065 | 📝 | Productos, categorías, tasas legales, códigos de barras, lotes, vitrina, publicación y búsqueda en el marketplace |
| [inventory](inventory/SPEC.md) | Go | 50066 | 📝 | Bodegas por sucursal, existencias, ajustes, transferencias, reservas con TTL, proveedores, órdenes de compra y recepción (con lotes e incidencias), sugerencias de reorden, lotes FEFO, existencia bloqueada, avisos de vencimiento |
| [pos](pos/SPEC.md) | Go | 50067 | 📝 | Sesiones de caja por sucursal, ventas, efectivo y billetera, estacionar/retomar, devoluciones, anulaciones, movimientos de caja, conteo por denominación y reporte Z, ajustes |
| [orders](orders/SPEC.md) | Go | 50075 | 📝 | Carrito, cotización, checkout con saga y un cobro con splits, aceptación con plazo, rechazo con reembolso, código de retiro. Sin entrega a domicilio ni factura aún |
| [security](security/SPEC.md) | Go + OpenBao | 50073 | ✅ | Secretos con ACL, transit (cifrado), auditoría encadenada, bloqueos; OpenBao 2.2.0 |
| [infra-management](infra-management/SPEC.md) | Go | 50074 | ✅ | Feature flags, configuración dinámica con JSON Schema, modo mantenimiento, cliente de configuración |
| [logistics](logistics/SPEC.md) | Go | 50068 | 📋 | Entregas y repartidores (F18) |
| [geolocation](geolocation/SPEC.md) | Go | 50069 | 📋 | Geocercas y ubicación (F14) |
| [payroll](payroll/SPEC.md) | Go | 50070 | 📋 | Nómina y marcajes (F19) |
| [notifications](notifications/SPEC.md) | Go | 50071 | 📋 | Correo, SMS, push y plantillas (F20) — destraba facturas por correo e invitaciones entregadas |
| [analytics-bi](analytics-bi/SPEC.md) | Go | 50072 | 📋 | Reportes, alertas y pregunta en lenguaje natural (F21) |
| [postgres-db](postgres-db/SPEC.md) | PostgreSQL 16 + PostGIS | 5432 / 6432 | ✅ | 16 esquemas y roles aislados, PgBouncer en modo transacción, exporter y alertas, respaldos base y PITR (RPO ≤ 5 min) |
| [nosql-db](nosql-db/SPEC.md) | ScyllaDB 6.2 | 9042 | ✅ | Keyspaces y roles aislados, TTL, métricas, snapshots |
| [event-bus](event-bus/SPEC.md) | NATS 2.10 + JetStream | 4222 | ✅ | 11 streams y 3 buckets KV como código, permisos por servicio, DLQ y alertas |
| [object-storage](object-storage/SPEC.md) | Garage v2.4.1 (S3) | 3900 | ✅ | 6 buckets, llave por contenedor, cuotas, URLs prefirmadas |
| [observability](observability/SPEC.md) | OTel, Prometheus, Loki, Tempo, Alloy, Alertmanager, Grafana | 4317 / 9090 / 3000 | ✅ | Pila completa con 7 dashboards |
| [flutter_app](flutter_app/README.md) | Flutter | — | 📝 | Cliente único (ver §4). Compila web, Android y Linux; iOS/macOS/Windows sin verificar |
| [network-contracts](network-contracts/README.md) | Protobuf | — | ✅ | 18 archivos `.proto` (≈ 231 RPC), `buf lint` y `buf breaking` en CI, código Go/Rust generado por `sync-protos.sh` |

Matriz de dependencias, capas de arranque y degradación: [`docs/architecture/service-dependencies.md`](docs/architecture/service-dependencies.md). Estado ampliado: [`ARCHITECTURE.md`](ARCHITECTURE.md) §2.

## 3. Stack (ADR 0001)
| Capa | Tecnología |
|---|---|
| Núcleo de dinero (ledger, payments-core, settlement) | **Rust** (tokio, tonic, sqlx) |
| Resto de servicios (identity, gateway, catalog, inventory, pos, orders, fiscal, security, infra-management, web) | **Go** (gRPC, pgx) |
| Todas las interfaces | **Flutter/Dart** — una sola app (dio, flutter_secure_storage, mobile_scanner, qr_flutter, i18n `es_PA`/`en`) |
| Entre contenedores | gRPC (`network-contracts/`) + eventos NATS JetStream con outbox |
| App ↔ backend | HTTPS/JSON + WebSocket vía `api-gateway` |
| Datos | PostgreSQL 16 (+PostGIS) con PgBouncer, ScyllaDB, NATS, Garage (S3) |
| Plataforma | OpenBao, OpenTelemetry, Prometheus, Loki, Tempo, Grafana, Docker Compose → Kubernetes, OpenTofu |
| Herramientas de desarrollo (no se despliegan) | Node en `scripts/ledger-tests`, scripts de carga en `scripts/load`, `buf`, gitleaks |
Todo de código abierto; sin dependencia de un proveedor de nube.

## 4. Características por módulo

La app es **una sola**: el shell muestra los módulos que habilitan los permisos del usuario (`/v1/me/permissions`) y los marcados «live» en el registro. Los demás abren «Disponible próximamente».

### 4.1 Cuenta y acceso (identity + gateway) — ✅
- Registro con aceptaciones por finalidad (edad, términos, tratamiento de datos, marketing), versionadas y fechadas (N-DAT-02).
- Login, refresh único con rotación, cierre de sesión, sesiones activas, recuperación y cambio de contraseña.
- Confirmación fuerte (**step-up**) con PIN y WebAuthn para operaciones sensibles.
- Perfil de negocio y **capacidades** (qué módulos aplica a ese negocio), sucursales, equipo con membresías de alcance (negocio / sucursal), roles personalizados y plantillas, invitaciones (crear, reenviar, revocar, aceptar). Anti-escalada de privilegios A1–A3 (ADR 0018).
- Revisión de negocios por la plataforma (aprobar/rechazar).

### 4.2 Billetera y pagos (payments-core + ledger + gateway) — 📝
- Saldo y estado de cuenta, recarga (sandbox), pagar escaneando QR, enviar y recibir con código personal, pay-links.
- Confirmación con step-up sobre el umbral, resultado y recibo; estado en vivo por WebSocket.
- Reembolsos, políticas de comisión por comercio, cotización de tarifas, terminales QR y su activación.
- Resolución manual de pagos en estado `UNKNOWN` (plataforma).
- Ledger: doble entrada, holds, reversos, cadena de hash, RLS. **Sandbox**: ningún riel externo mueve dinero real.

### 4.3 Catálogo (catalog) — 📝
- Alta, edición y archivo de productos con imágenes (subidas por el gateway a S3), categorías, SKU y códigos de barras con lector (cámara o HID).
- Tasas legales de ITBMS desde parámetros, importación masiva, lotes y vencimientos.
- Vitrina del comercio, publicación en el marketplace y búsqueda.

### 4.4 Inventario (inventory) — 📝
- Bodegas por sucursal, existencias por bodega, ajustes y transferencias con movimientos auditables.
- Reservas con TTL para pedidos del marketplace; descuento automático al vender en caja.
- Proveedores y órdenes de compra (borrador → enviada → recibida/cerrada), recepción con lotes, dañados e incidencias, sugerencias de reorden.
- Lotes con FEFO, existencia bloqueada, aviso de vencimiento, ajustes de inventario configurables.

### 4.5 Punto de venta (pos) — 📝
- Apertura y cierre de caja por sucursal, conteo por billetes y monedas, **reporte Z**, entradas y salidas de efectivo.
- Venta con escáner, efectivo con vuelto o saldo PlentyPay, recibo y pantalla del cliente.
- Estacionar y retomar ventas, historial, devolución (con confirmación fuerte), anulación, ajustes de caja.
- Pendientes: cambio de turno (F17.13), nota de crédito en devoluciones (F13.5).

### 4.6 Marketplace y pedidos (orders + catalog + inventory) — 📝
- Descubrir productos y vitrinas, carrito por comercio, cotización y checkout con un solo cobro y reparto entre comercios.
- Vista del comprador (mis pedidos, cancelar) y del comercio (aceptar, rechazar, marcar listo, completar con código de retiro).
- Pendiente: entrega a domicilio (logistics) y factura por pedido.

### 4.7 Facturación (fiscal-invoicing) — 📝
- Perfil fiscal, contribuyentes, folios sin huecos, factura electrónica con cola y reintento hacia el PAC (simulador o HKA), notas de crédito y débito.
- Pendiente: PDF/XML, reporte de ITBMS, envío real a HKA.

### 4.8 Finanzas del comercio (settlement + payments-core) — 📝
- Resumen de saldos, calendario y destino de pago (cifrado, con step-up), lotes de liquidación y su estado, listado de pagos, reporte tributario y terminales.
- Plataforma: confirmar o fallar pagos de lotes, conciliación y excepciones.

### 4.9 Plataforma y administración — ✅/📝
- Revisión de negocios y usuarios, cola de cumplimiento, solicitudes sobre datos personales, parámetros legales, consola de feature flags, estado de servicios y pagos desconocidos.
- Auditoría, plantillas de notificación y privacidad por negocio (pantallas con servicio pendiente donde aplique).

### 4.10 Sin servidor aún
logistics, payroll, analytics-bi, notifications y geolocation tienen SPEC, contrato `.proto` y esquema inicial de migración, y pantallas esqueleto en la app; su módulo se muestra como «Disponible próximamente».

## 5. Funciones expuestas (API de la app)
`api-gateway` expone ~120 rutas bajo `/v1`, agrupadas así (cada una declara permiso, idempotencia y RPC destino en `api-gateway/internal/routes/`; la lista viva se publica en OpenAPI):

| Grupo | Rutas (resumen) |
|---|---|
| auth | `login`, `register`, `refresh`, `password/forgot`, `password/reset` |
| me | perfil, permisos, contraseña, PIN de step-up, sesiones |
| business | perfil, capacidades, sucursales, equipo y membresías, invitaciones, roles |
| catalog | productos (CRUD, importar), categorías, tasas, vitrina, publicación |
| inventory | bodegas, existencias, ajustes, transferencias, proveedores, órdenes de compra y recepción, reorden, movimientos, lotes, ajustes |
| pos | sesiones y cierre, movimientos de efectivo, ventas, checkout, estacionar, retomar, devolución, anulación, ajustes |
| cart / orders / merchant / marketplace | carrito, cotización, pedidos, sub-pedidos del comercio, búsqueda y producto público |
| fiscal | perfil, proveedores PAC, folios, facturas, notas, contribuyentes |
| wallet / payments / terminals / refunds / fee-policies / pay-links | saldo, estado de cuenta, recarga, código de recibo, intents, cotización, pagos, terminales, reembolsos |
| settlement / platform | resumen, calendario, lotes; revisión de negocios, lotes y pagos desconocidos |
| realtime | WebSocket `/v1/realtime` (estado de pagos, cierre remoto de sesión) |

## 6. Datos
- **PostgreSQL 16**: un esquema y un rol por contenedor (16 esquemas), RLS por `tenant_id`, acceso vía PgBouncer. Migraciones numeradas por contenedor (`<c>/migrations/NNNN_*.up/.down.sql`; identity 11, inventory 7, pos 7, catalog 3, payments-core 4, fiscal 2, ledger 2, orders 1, settlement 1). Producción: respaldo `pg_dump` antes de migrar.
- **Dinero**: enteros en centavos, moneda ISO 4217, redondeo y repartos según `docs/domain/domain-model.md` §4. Fechas ISO 8601 UTC, teléfonos E.164, GTIN normalizado; la presentación convierte a formato local (mes en texto).
- **Eventos**: NATS JetStream, 11 streams y 3 buckets KV; outbox por servicio y consumidores idempotentes.
- **ScyllaDB**: series y datos de alto volumen (keyspaces aislados, TTL). **Garage (S3)**: imágenes de catálogo y documentos.
- **Secretos**: solo `security`/OpenBao; nada sensible en logs ni telemetría.

## 7. Despliegue
- **Producción actual**: un servidor con Docker Compose (`docker-compose.yml`); redes `edge` (publicado solo 8080 y 8081), `services` e `data` (internas) y `pac-egress` (salida a internet solo de fiscal-invoicing hacia el PAC). Contenedores endurecidos (usuario no root, FS de solo lectura, healthchecks, imágenes por digest). Acceso externo por Cloudflare Tunnel; la app descubre la URL vigente en `server.json` de GitHub Pages (ADR 0019).
- **Desplegar un servicio**: `docker compose build <c> && docker compose run --rm --no-deps <c> migrate && docker compose up -d --no-deps <c>`. No reiniciar `tunnel` sin necesidad.
- **Publicar la app** tras cada push a `main`: `./scripts/publish-release.sh <patch|minor|major> <notas.md>` (web, Linux, APK con la misma firma, GitHub Pages y release con checksums). Binarios en `output/`.
- **CI** (`.github/workflows/ci.yml`, scripts en `scripts/ci/`): repo-checks (aislamiento, docs, contratos), build+test de lo afectado (Go, Rust, Flutter), imágenes y `buf`.
- **Objetivo**: Kubernetes híbrido (k3s HA propio + DR en nube) con OpenTofu, Argo CD y CloudNativePG; escala de 500 000 usuarios diarios y picos de 2 000 pagos/s (F29). Hoy hay solo manifiestos base en `k8s/` y `infra/` (F26–F27 pendientes). Detalle: [`docs/standards/delivery-pipeline.md`](docs/standards/delivery-pipeline.md).

## 8. Responsabilidades (quién es dueño de qué)
| Responsabilidad | Dueño único |
|---|---|
| Libro contable | `ledger` |
| Orquestar cobros y hablar con rieles | `payments-core` |
| Liquidar al comercio | `settlement` |
| Identidad, permisos, sucursales, step-up | `identity` |
| Secretos de terceros y cifrado | `security` |
| Banderas y configuración dinámica | `infra-management` |
| Precios, productos, tasas legales | `catalog` |
| Existencias y compras | `inventory` |
| Caja y ventas presenciales | `pos` |
| Carrito y pedidos del marketplace | `orders` |
| Documentos fiscales ante el PAC | `fiscal-invoicing` |
| Único punto de entrada de la app | `api-gateway` |
| Enviar mensajes | `notifications` (📋) |

## 9. Estructura del repositorio
```
<contenedor>/          23 unidades de despliegue — una carpeta = un contenedor (ADR 0002/0016)
network-contracts/     contratos .proto (única carpeta compartida)
flutter_app/           cliente único Flutter → binarios en output/
output/                binarios de release
infra/ · k8s/          OpenTofu y manifiestos Kubernetes base
docs/                  documentación que gobierna
scripts/               verificaciones, CI, release, pruebas de carga y utilidades de desarrollo
_legacy-typescript-reference/   sistema de origen, solo consulta (no se despliega)
00–05-*.md             serie de documentos de producto, contexto y hoja de ruta
```

## 10. Cómo se gobierna este repositorio
**La documentación manda sobre el código** (ADR 0010). Antes de escribir una línea, lee [`AGENTS.md`](AGENTS.md) — es el contrato de trabajo para personas y agentes de código.

| Documento | Para qué |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Orden de lectura, reglas inviolables, ciclo de trabajo por paso |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Vista de conjunto, estado de cada contenedor, flujos |
| [`ENGINEERING.md`](ENGINEERING.md) | Cómo se construye, verifica y entrega |
| [`05-HOJA-DE-RUTA-30-FASES.md`](05-HOJA-DE-RUTA-30-FASES.md) | 30 fases, 224 pasos con criterio de aceptación |
| [`docs/roadmap/status.md`](docs/roadmap/status.md) | Qué está hecho, con evidencia |
| [`docs/roadmap/continuity.md`](docs/roadmap/continuity.md) | Entrada para retomar el trabajo: siguiente paso, archivos y comandos |
| [`docs/roadmap/commerce-plan.md`](docs/roadmap/commerce-plan.md) | Fichas ejecutables de los pasos comerciales abiertos |
| [`docs/adr/`](docs/adr/README.md) | 23 decisiones de arquitectura (0001–0023) |
| [`docs/glossary.md`](docs/glossary.md) | Glosario universal: todos los nombres (tipos, enums, permisos, `reason`, eventos, variables) y su fuente de verdad |
| [`docs/domain/domain-model.md`](docs/domain/domain-model.md) | Reglas de dinero, ledger, estados (con vectores de prueba) |
| [`docs/standards/`](docs/standards) | gRPC, datos, eventos, seguridad, observabilidad, pruebas, Go, Rust, Flutter, entrega |
| [`docs/architecture/service-dependencies.md`](docs/architecture/service-dependencies.md) | 23 contenedores, puertos, quién llama a quién, degradación |
| [`docs/architecture/rpc-coverage.md`](docs/architecture/rpc-coverage.md) | Cobertura de los 231 RPC contra cada SPEC §4 y los hallazgos de contrato (F03.1) |
| [`docs/architecture/event-chains.md`](docs/architecture/event-chains.md) | Cadenas de reacción entre servicios: qué está construido y desplegado, huecos de diseño y orden de cierre (2026-10-20) |
| [`docs/ux/screen-catalog.md`](docs/ux/screen-catalog.md) · [`docs/design-system.md`](docs/design-system.md) · [`docs/gravital-experience-ui.md`](docs/gravital-experience-ui.md) | Pantallas por módulo/rol, tokens base y regla estricta de diseño Flutter (`gravital-experience-ui`) |
| [`docs/ux/functional-spec/`](docs/ux/functional-spec/README.md) | Requisitos funcionales y ficha de cada pantalla: elementos, textos, validaciones, flujos y conexiones entre módulos |
| [`docs/compliance/regulatory-framework.md`](docs/compliance/regulatory-framework.md) | Normas de Panamá y estándares internacionales convertidos en reglas de negocio `N-…`, con fuentes y nivel de verificación |
| [`docs/compliance/international-standards.md`](docs/compliance/international-standards.md) | Estándares internacionales (ISO 4217, ISO 8601, GS1, PCI DSS, EMV QR, WCAG, NIST, RFC 9457) convertidos en reglas `N-STD-…` |
| [`docs/open-questions.md`](docs/open-questions.md) | Lo que requiere decisión de negocio/legal/proveedor |
| `<contenedor>/SPEC.md` | Especificación ejecutable de cada contenedor |

## 11. Arranque rápido (lo que hoy funciona)
```bash
cp identity/.env.example identity/.env          # poner dos secretos distintos de ≥ 32 caracteres
cp api-gateway/.env.example api-gateway/.env
docker compose up --build                        # identity + api-gateway en http://localhost:8080

# N-DAT-02: el registro exige las aceptaciones de S-GEN-03 (una por finalidad, con la versión del texto)
curl -s -X POST localhost:8080/v1/auth/register -H 'Content-Type: application/json' -d '{
  "full_name":"Ana","email":"ana@example.com","password":"una-clave-muy-larga",
  "consents":[
    {"purpose":"AGE_CONFIRMATION","text_version":"2026-10-12","granted":true},
    {"purpose":"TERMS","text_version":"2026-10-12","granted":true},
    {"purpose":"PRIVACY_DATA_PROCESSING","text_version":"2026-10-12","granted":true},
    {"purpose":"MARKETING","text_version":"2026-10-12","granted":false}]}'
```
Verificaciones (CI las corre en cada PR):
```bash
./scripts/check-isolation.sh && ./scripts/check-docs.sh && ./scripts/sync-protos.sh --check
(cd identity && go test -race ./...) && (cd api-gateway && go test -race ./...)
./scripts/e2e-identity-gateway.sh
(cd scripts/ledger-tests && npm install && npm test)   # especificación ejecutable del ledger
```
App: ver [`flutter_app/README.md`](flutter_app/README.md).

---

## Autoría

<table>
<tr>
<td width="96" align="center"><img src="flutter_app/web/icons/Icon-192.png" width="72" alt="PlentyPay"></td>
<td>

**Angel Nereira** — autor, arquitecto y responsable del producto.<br>
Concibió PlentyPay y tomó sus decisiones de arquitectura, de dominio y de cumplimiento (ver los [ADR](docs/adr/README.md)); la implementación se desarrolla con asistencia de Claude Code bajo esas decisiones y deja constancia en cada commit.

[GitHub · @angelnereira](https://github.com/angelnereira) · [contact@angelnereira.com](mailto:contact@angelnereira.com)

</td>
</tr>
</table>

© 2026 Angel Nereira. Todos los derechos reservados hasta que se defina la licencia (pregunta abierta Q-17 en [`docs/open-questions.md`](docs/open-questions.md)).

<div align="center"><sub>PlentyPay · hecho en Panamá 🇵🇦 · pagos en sandbox: nada mueve dinero real</sub></div>
