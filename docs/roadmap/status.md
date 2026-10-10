# Estado del roadmap

Fuente de verdad del avance **con evidencia**. Reglas (AGENTS.md §2.11 y §3): solo se marca ✅ lo ejecutado al nivel exigido, con el comando/fecha en *Evidencia*. 📝 = en curso o parcial (decir qué falta). 📋 = pendiente. ⛔ = bloqueado (citar la pregunta de `docs/open-questions.md`).

**Fase en curso**: F01/F02 (cierre de gobierno y cliente base). **Siguiente paso recomendado para un agente**: F02.4 (en paralelo F02.2; F01.7 espera la licencia, Q-17).

## Limitaciones del entorno donde se generó este repositorio
Go se compiló contra clones de dependencias (el proxy de módulos no era alcanzable); Rust 1.97 disponible pero sin código Rust aún; Docker sin acceso a Docker Hub (imágenes no construidas); sin SDK de Flutter (código Dart no compilado); sin OpenTofu. Todo lo marcado ✅ se ejecutó realmente; lo demás no.

## Verificación al ensamblar el repositorio en la máquina de desarrollo (2026-10-10)
Go 1.26.0, Rust 1.99.0, Flutter 3.47.6, Docker 29.9 + Compose v5.5, Node 22. Ejecutado realmente:

| Verificación | Resultado |
|---|---|
| `./scripts/check-isolation.sh` | OK |
| `./scripts/check-docs.sh` (23 contenedores) | OK |
| `identity` y `api-gateway`: `go mod tidy` (se commitea `go.sum`, antes ausente), `go vet ./...`, `go test -race ./...` | OK |
| `./scripts/e2e-identity-gateway.sh` | 14/14 |
| `scripts/ledger-tests`: `npm test` | 27/27 |
| `flutter_app`: `flutter pub get` (se commitea `pubspec.lock`), `flutter analyze`, `flutter test` | sin issues; 4/4 |
| `docker compose build` + `up`: registro, login y `/v1/me/permissions` por `localhost:8080` | OK (CUSTOMER → wallet, marketplace) |

| `./scripts/sync-protos.sh --check` (protoc 29.3, protoc-gen-go 1.35.2, protoc-gen-go-grpc 1.5.1) | OK tras regenerar: el código entregado difería en un comentario de `identity_grpc.pb.go` |
| `gitleaks detect -c .gitleaks.toml` (historial completo) | sin hallazgos (se agregaron al allowlist dos contraseñas ficticias de `identity/internal/server/server_test.go`) |

**No ejecutado aquí** (faltan las herramientas): `golangci-lint`, `tofu`. `buf` 1.73 está instalado pero aún sin configuración (F03.3). Builds de plataforma: ver F02.3.

## Contratos pendientes de agregar (aditivos, F03.2)
`payments.PostMemoEntry` (T8/T9 para pos), `analytics.AskQuestion`, `analytics.AlertTriggered` (+ subject `pp.analytics.alert.triggered.v1`), `identity.NotificationRequested` (+ subject `pp.identity.notification.requested.v1`).

## F01 — Fundamentos y gobierno del repositorio

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F01.1 AGENTS.md, README, ARCHITECTURE, ENGINEERING | ✅ | Documentos en raíz, 2026-10-10 |
| F01.2 ADRs 0001–0017 + índice + plantillas | ✅ | docs/adr/README.md lista 0001–0017 |
| F01.3 Estándares transversales y por lenguaje | ✅ | docs/standards/ (9 archivos) |
| F01.4 Modelo de dominio con vectores verificados | ✅ | Vectores recalculados con aritmética entera (Python) 2026-10-10 |
| F01.5 SPEC.md + README.md en los 23 contenedores | ✅ | check-docs.sh |
| F01.6 Scripts de verificación: aislamiento, documentación, contratos | ✅ | check-isolation.sh, check-docs.sh, sync-protos.sh --check en verde 2026-10-10 |
| F01.7 Higiene: `.gitignore`, `.editorconfig`, licencia, plantilla de PR, CODEOWNERS por carpeta, configuración gitleaks | 📝 | Hechos: .gitignore, .editorconfig, plantilla de PR, CODEOWNERS, .gitleaks.toml; gitleaks sin hallazgos sobre el historial (2026-10-10). Falta: LICENSE (Q-17) y activar gitleaks en CI (F02.2) |
| F01.8 Catálogo de pantallas y sistema de diseño | ✅ | docs/ux/screen-catalog.md, docs/design-system.md |

## F02 — Entorno local, CI y cliente Flutter base (UI primero)

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F02.1 `docker-compose.yml` con redes edge/services/data, healthchecks y `.env.example` por contenedor | ✅ | 2026-10-10: `docker compose up --build -d --wait` deja identity y api-gateway `healthy` (healthcheck `/app healthcheck` → `:9100/healthz/ready`, gateway con `depends_on: service_healthy`); solo 8080 publicado (9100 y 50060 no alcanzables desde el host); registro y login 200 por el gateway; E2E 14/14. `web` (8081) se agrega en F02.8 |
| F02.2 Pipeline CI (scripts en `scripts/ci/`): repo-checks, build-test Go/Rust/Flutter afectado, imagen | 📋 |  |
| F02.3 `flutter create` multiplataforma sobre el esqueleto existente; flavors dev/staging/prod; i18n es_PA/en | ✅ | 2026-10-10, Flutter 3.47.6: `flutter create` para android/ios/linux/windows/macos/web; flavors por dart-define (`AppConfig`: staging y prod rechazan http, con prueba); i18n ARB `es_PA`/`en`. `flutter analyze` sin issues; `flutter test` 19/19. Además compilan `flutter build web`, `flutter build apk --debug` y `flutter build linux --release` (la app arranca). Identificador de la app: `app.plentypay.pay`. No verificado: iOS/macOS/Windows (requieren su sistema). Pendiente para F23.2: entitlement NDEF de iOS |
| F02.4 Tokens y componentes del design system (PPButton, PPTextField, MoneyText, AsyncView, StatusChip, AppShell) con golden tests claro/oscuro | 📝 | Tokens en app_theme.dart; faltan componentes y goldens |
| F02.5 Sesión segura (secure storage), ApiClient (dio) con refresh único, request-id e Idempotency-Key | 📝 | ApiClient con http y refresh único; migrar a dio + idempotencia |
| F02.6 Login, registro, recuperar contraseña (UI) y shell con navegación dinámica según `enabled_modules` | 📝 | Login + shell dinámico escritos; sin integration_test |
| F02.7 Builds de release a `output/` (APK split-per-abi, Linux, Windows, Web; iOS/macOS en runner macOS) | 📋 |  |
| F02.8 Contenedor `web` sirviendo el bundle Flutter Web | 📋 |  |

## F03 — Contratos gRPC completos

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F03.1 Revisión RPC por RPC de los 18 `.proto` contra cada SPEC §4 (nombres, permisos documentados, idempotency_key) | 📝 | 18 .proto compilan juntos (protoc 29.3, 231+ RPC); falta tabla de cobertura |
| F03.2 Agregar RPC/mensajes pendientes declarados en SPECs (`payments.PostMemoEntry`, `analytics.AskQuestion`, `analytics.AlertTriggered`, `identity.NotificationRequested`) | 📋 |  |
| F03.3 Configurar `buf lint` + `buf breaking` contra `main` | 📋 |  |
| F03.4 Generación Go/Rust por `sync-protos.sh` para todas las filas activas de `consumers.txt` | ✅ | sync-protos.sh --check verde para filas activas |
| F03.5 Documentar códigos `reason` por RPC (catálogo en `grpc-conventions.md` anexo) | 📋 |  |

## F04 — Observabilidad

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F04.1 OTel Collector + Prometheus con scrape de `:9100` | 📋 |  |
| F04.2 Loki + recolector de logs de Docker | 📋 |  |
| F04.3 Tempo + propagación `traceparent` gateway→identity | 📋 |  |
| F04.4 Grafana con 7 dashboards como código | 📋 |  |
| F04.5 Alertmanager + reglas críticas/warning con runbook_url | 📋 |  |
| F04.6 Instrumentar identity y gateway según estándar (logs JSON, métricas obligatorias, puerto admin) | 📋 |  |

## F05 — Seguridad base y gestión de plataforma

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F05.1 OpenBao en compose (modo dev solo local; política de unseal documentada) | 📋 |  |
| F05.2 Servicio security: GetSecret/PutSecret con ACL por SAN | 📋 |  |
| F05.3 Encrypt/Decrypt por propósito con AAD | 📋 |  |
| F05.4 Auditoría encadenada + consumidor `pp.audit.>` + VerifyAuditChain | 📋 |  |
| F05.5 ReportSecurityEvent / IsBlocked con reglas R5 | 📋 |  |
| F05.6 PKI SPIFFE + mTLS en identity y gateway; step-up en identity (Issue/Verify/Consume) | 📋 |  |
| F05.7 infra-management: flags + NATS KV | 📋 |  |
| F05.8 Config con JSON Schema + valores iniciales (límites, umbrales, feriados) | 📋 |  |
| F05.9 GetClientConfig + modo mantenimiento + pantalla de consola de flags en Flutter (módulo platform) | 📋 |  |

## F06 — PostgreSQL de producción

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F06.1 Imagen PostgreSQL 16 + PostGIS + init de esquemas y roles | 📋 |  |
| F06.2 PgBouncer en modo transacción | 📋 |  |
| F06.3 postgres_exporter + alertas (réplica, disco, conexiones) | 📋 |  |
| F06.4 Respaldos base + WAL a object-storage (o directorio local en compose) | 📋 |  |
| F06.5 Prueba de restauración PITR documentada en runbook | 📋 |  |

## F07 — NoSQL, bus de eventos y almacenamiento de objetos

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F07.1 ScyllaDB nodo + healthcheck | 📋 |  |
| F07.2 Roles y keyspaces por dueño | 📋 |  |
| F07.3 Monitoreo y procedimiento de backup | 📋 |  |
| F07.4 NATS + JetStream persistente | 📋 |  |
| F07.5 Streams y KV como código | 📋 |  |
| F07.6 Cuentas y permisos por servicio (nkeys en prod) | 📋 |  |
| F07.7 Exporter + alertas de lag y DLQ | 📋 |  |
| F07.8 Garage nodo + layout | 📋 |  |
| F07.9 Buckets y llaves por contenedor como script | 📋 |  |
| F07.10 URLs prefirmadas de referencia documentadas (PUT/GET con tipo y tamaño) | 📋 |  |

## F08 — identity completo

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F08.1 Núcleo en memoria: Register/Login/Validate/Permissions/Refresh + catálogo de permisos y módulos | ✅ | go test -race (server + permisos) y E2E 14/14, 2026-10-10 |
| F08.2 PostgreSQL + migraciones + estructura del estándar Go | 📋 |  |
| F08.3 Sesiones con rotación de refresh y detección de reuso | 📋 |  |
| F08.4 Bloqueo progresivo | 📋 |  |
| F08.5 Tenants: CreateBusiness/ReviewBusiness/GetTenant + outbox `TenantStatusChanged` | 📋 |  |
| F08.6 Roles personalizados + invitaciones de staff | 📋 |  |
| F08.7 Recuperación y cambio de contraseña | 📋 |  |
| F08.8 Pantallas Flutter: perfil, sesiones, alta de negocio (KYB), equipo, roles, invitaciones, revisión de negocios (plataforma) | 📋 |  |

## F09 — api-gateway completo

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F09.1 Núcleo auth (login/register/refresh/me/permissions) | ✅ | 10 pruebas de handlers + E2E 14/14, 2026-10-10 |
| F09.2 Interceptor de metadatos `x-pp-*` y descarte de cabeceras entrantes | 📋 |  |
| F09.3 Tabla declarativa de rutas + traductor JSON↔proto | 📋 |  |
| F09.4 Errores con ErrorInfo/reason estables | 📋 |  |
| F09.5 WebSocket `/v1/realtime` con topics session e inbox | 📋 |  |
| F09.6 Rate limits con NATS KV | 📋 |  |
| F09.7 OpenAPI generado desde la tabla de rutas | 📋 |  |

## F10 — ledger

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F10.1 Proyecto Rust + dominio Money/plantillas con proptest | 📋 |  |
| F10.2 Migraciones + triggers + port de los 27 casos de referencia | 📋 |  |
| F10.3 PostTransaction y ReverseTransaction | 📋 |  |
| F10.4 Saldos y extractos | 📋 |  |
| F10.5 Holds + expiración | 📋 |  |
| F10.6 Outbox + eventos | 📋 |  |
| F10.7 Job I7 + métricas + alertas | 📋 |  |
| F10.8 Carga básica | 📋 |  |

## F11 — payments-core y billetera

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F11.1 Proyecto + dominio: máquinas de estado y fee engine con vectores | 📋 |  |
| F11.2 Migraciones | 📋 |  |
| F11.3 Intents y pagos wallet con holds | 📋 |  |
| F11.4 Worker de asiento + outbox | 📋 |  |
| F11.5 Terminales + ResolveTerminal | 📋 |  |
| F11.6 Reembolsos (T7) con step-up | 📋 |  |
| F11.7 Adaptador sandbox genérico + job UNKNOWN | 📋 |  |
| F11.8 Webhooks con verificación de firma | 📋 |  |
| F11.9 Pantallas Flutter: billetera, recargar, enviar, cobrar/pagar con QR, detalle y estado 'confirmando', terminales del comercio | 📋 |  |

## F12 — Liquidación y conciliación

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F12.1 Dominio + migraciones | 📋 |  |
| F12.2 Calendarios y destino cifrado con step-up | 📋 |  |
| F12.3 CreateBatch + items | 📋 |  |
| F12.4 Confirm/FailPayout + T6/T6b | 📋 |  |
| F12.5 Importación de extractos (CSV genérico) | 📋 |  |
| F12.6 Conciliación + T5 + excepciones | 📋 |  |
| F12.7 Jobs y alertas | 📋 |  |
| F12.8 Pantallas Flutter: finanzas del comercio (saldo, lotes, calendario) y consola de conciliación | 📋 |  |

## F13 — Facturación electrónica DGI

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F13.1 Dominio: totales e impuestos, políticas de documento | 📋 |  |
| F13.2 Migraciones + folios | 📋 |  |
| F13.3 Perfil fiscal + credenciales en security | 📋 |  |
| F13.4 PacClient + simulador | 📋 |  |
| F13.5 IssueInvoice + worker de envío | 📋 |  |
| F13.6 PDF/XML a object-storage con QR | 📋 |  |
| F13.7 Notas de crédito/débito | 📋 |  |
| F13.8 Facturación de comisiones de PlentyPay a comercios | 📋 |  |
| F13.9 Pantallas Flutter: perfil fiscal, facturas, notas, contribuyentes | 📋 |  |

## F14 — Geolocalización

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F14.1 Geocercas PostGIS | 📋 |  |
| F14.2 Ingesta + última posición con filtros de calidad | 📋 |  |
| F14.3 Trayectorias en Scylla con TTL | 📋 |  |
| F14.4 FindNearby / IsInside | 📋 |  |
| F14.5 Cruces de geocerca + eventos | 📋 |  |
| F14.6 WatchSubject | 📋 |  |
| F14.7 Pantalla Flutter: editor de geocercas sobre mapa (flutter_map) | 📋 |  |

## F15 — Catálogo, marketplace y pedidos multi-comercio

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F15.1 Productos y variantes | 📋 |  |
| F15.2 Categorías + imágenes con URL prefirmada | 📋 |  |
| F15.3 Importación masiva | 📋 |  |
| F15.4 Listados + storefront | 📋 |  |
| F15.5 Búsqueda del marketplace (+ atributos en Scylla) | 📋 |  |
| F15.6 orders: dominio + migraciones | 📋 |  |
| F15.7 Carrito + cotización | 📋 |  |
| F15.8 Checkout saga + consumidores de pagos | 📋 |  |
| F15.9 Aceptación/SLA + reembolsos + integración logística y fiscal | 📋 |  |
| F15.10 Pantallas Flutter: catálogo del comercio, vitrina, marketplace, carrito, checkout, mis pedidos, pedidos del comercio | 📋 |  |

## F16 — Inventario

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F16.1 Bodegas y niveles de stock | 📋 |  |
| F16.2 Movimientos y ajustes | 📋 |  |
| F16.3 Reservas con TTL | 📋 |  |
| F16.4 Transferencias y lotes FEFO | 📋 |  |
| F16.5 Proveedores, órdenes de compra y recepción | 📋 |  |
| F16.6 Velocidad de venta, StockLow y reorden | 📋 |  |
| F16.7 Pantallas Flutter: stock, movimientos, ajustes, transferencias, compras, recepción con escáner, sugerencias | 📋 |  |

## F17 — Punto de venta

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F17.1 Dominio: totales e impuestos incluidos | 📋 |  |
| F17.2 Migraciones | 📋 |  |
| F17.3 Cajas, sesiones y reporte Z | 📋 |  |
| F17.4 Ventas y estacionar | 📋 |  |
| F17.5 Checkout multi-tender | 📋 |  |
| F17.6 Crédito de la casa y puntos (`payments.PostMemoEntry`) | 📋 |  |
| F17.7 Sincronización offline | 📋 |  |
| F17.8 Stream de pantalla del cliente | 📋 |  |
| F17.9 Devoluciones y anulaciones | 📋 |  |
| F17.10 Pantallas Flutter del POS (venta en 2 paneles, cobro, cierre, devoluciones, display del cliente) | 📋 |  |

## F18 — Logística y entregas

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F18.1 Transportistas y repartidores | 📋 |  |
| F18.2 Entregas y estados | 📋 |  |
| F18.3 Asignación manual y por cercanía | 📋 |  |
| F18.4 Prueba de entrega (código, foto, firma) | 📋 |  |
| F18.5 Seguimiento público + stream | 📋 |  |
| F18.6 Integración con orders + página pública de seguimiento en `web` | 📋 |  |
| F18.7 Pantallas Flutter: despacho (comercio) y app de repartidor (ruta, escaneo, prueba) | 📋 |  |

## F19 — Equipo, asistencia y nómina

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F19.1 Empleados con datos cifrados | 📋 |  |
| F19.2 Turnos y horarios | 📋 |  |
| F19.3 Marcaje PIN/QR dinámico/NFC + geocerca | 📋 |  |
| F19.4 Biometría en dispositivo + modo quiosco | 📋 |  |
| F19.5 Cálculo de nómina | 📋 |  |
| F19.6 Aprobación y pago (T10) | 📋 |  |
| F19.7 Comprobantes PDF | 📋 |  |
| F19.8 Pantallas Flutter: empleados, horarios, marcaje, quiosco, corridas de nómina, mis comprobantes | 📋 |  |

## F20 — Notificaciones multicanal

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F20.1 Plantillas + render | 📋 |  |
| F20.2 Correo (Resend/SMTP) | 📋 |  |
| F20.3 Bandeja in-app + stream | 📋 |  |
| F20.4 Push + dispositivos | 📋 |  |
| F20.5 Reglas de suscripción (consumidores) | 📋 |  |
| F20.6 Preferencias y supresiones | 📋 |  |
| F20.7 WhatsApp (Jelou) y SMS | 📋 |  |
| F20.8 Pantallas Flutter: bandeja, preferencias, plantillas del comercio | 📋 |  |

## F21 — Inteligencia de negocio

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F21.1 Ingesta de eventos crudos (Scylla) | 📋 |  |
| F21.2 Agregados de ventas y productos | 📋 |  |
| F21.3 Catálogo de métricas + QueryMetric | 📋 |  |
| F21.4 Dashboards | 📋 |  |
| F21.5 ABC + RFM | 📋 |  |
| F21.6 Alertas y anomalías | 📋 |  |
| F21.7 Pronóstico | 📋 |  |
| F21.8 Preguntas en lenguaje natural | 📋 |  |
| F21.9 Exportes | 📋 |  |
| F21.10 Pantallas Flutter: inicio con KPIs, dashboards, preguntar, alertas, segmentos, exportes | 📋 |  |

## F22 — Cliente: offline, enlaces profundos y distribución

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F22.1 Outbox local drift genérico (ventas, marcajes) con cifrado en móvil | 📋 |  |
| F22.2 Caché de catálogo/precios versionada | 📋 |  |
| F22.3 Deep links (App Links/Universal Links) + `.well-known` en web | 📋 |  |
| F22.4 Actualización forzada por versión mínima | 📋 |  |
| F22.5 Firma de builds y canales (interno/beta) por plataforma | 📋 |  |
| F22.6 Telemetría de errores del cliente sin PII (a observability vía gateway) | 📋 |  |

## F23 — Cliente: pagos presenciales QR/NFC y billeteras del dispositivo

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F23.1 Escáner QR con validación de host/regex | 📋 |  |
| F23.2 NFC NDEF lectura (Android/iOS) y escritura de tags de terminal | 📋 |  |
| F23.3 Biometría local + step-up integrado | 📋 |  |
| F23.4 Pantalla 'confirmando' (UNKNOWN) + notificación final | 📋 |  |
| F23.5 Enlaces de pago `/t/<code>` en web | 📋 |  |
| F23.6 Apple Pay / Google Pay vía PSP (si Q-03 resuelta; si no, oculto por flag) | 📋 |  |
| F23.7 Recibos compartibles PDF | 📋 |  |

## F24 — Cliente: hardware de mostrador

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F24.1 Impresión de recibos 80 mm (sistema y ESC/POS por red) | 📋 |  |
| F24.2 Apertura de cajón vía impresora | 📋 |  |
| F24.3 Lectores de código de barras (teclado HID) y cámara | 📋 |  |
| F24.4 Pantalla del cliente en segundo monitor / tablet emparejada | 📋 |  |
| F24.5 Modo quiosco (pantalla completa bloqueada) para POS y marcaje | 📋 |  |

## F25 — Cliente: accesibilidad, rendimiento y publicación en tiendas

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F25.1 Auditoría de accesibilidad WCAG AA (lectores de pantalla, escala 200 %) | 📋 |  |
| F25.2 Rendimiento: arranque < 2.5 s, listas 60 fps, tamaños de bundle | 📋 |  |
| F25.3 Carga diferida por módulo en web | 📋 |  |
| F25.4 Textos legales, privacidad y consentimientos en la app | 📋 |  |
| F25.5 Fichas y envío a tiendas; paquetes Linux (deb/AppImage) y Windows (MSIX) | 📋 |  |

## F26 — Infraestructura como código multi-proveedor

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F26.1 Estructura `infra/opentofu` + backend de estado S3 con bloqueo | 📋 |  |
| F26.2 Módulo `cluster-self-hosted` (k3s HA) | 📋 |  |
| F26.3 Módulo `cluster-gcp` (o el proveedor de DR elegido primero) | 📋 |  |
| F26.4 Módulos `cluster-aws` y `cluster-azure` | 📋 |  |
| F26.5 Módulo `cluster-railway` con limitaciones documentadas | 📋 |  |
| F26.6 Módulo `platform` (operadores, Argo CD, cert-manager, ingress, External Secrets) | 📋 |  |
| F26.7 DNS, certificados y entornos staging/prod-primary/prod-dr | 📋 |  |

## F27 — Kubernetes

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F27.1 Kustomize base por contenedor desde el bloque Compose | 📋 |  |
| F27.2 Seguridad de pods, ServiceAccounts, NetworkPolicy desde la matriz de llamadas | 📋 |  |
| F27.3 CloudNativePG, Scylla Operator, NATS, Garage en clúster | 📋 |  |
| F27.4 HPA, PDB, topology spread | 📋 |  |
| F27.5 Argo CD + overlays staging/prod + jobs de migración PreSync | 📋 |  |
| F27.6 Argo Rollouts canary para ledger y payments-core | 📋 |  |
| F27.7 infra-management.ListServices sobre Kubernetes | 📋 |  |

## F28 — Seguridad avanzada y cumplimiento

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F28.1 EdDSA + JWKS y validación local en gateway | 📋 |  |
| F28.2 Passkeys | 📋 |  |
| F28.3 Pinning en prod, detección root/jailbreak, FLAG_SECURE | 📋 |  |
| F28.4 Unseal productivo de OpenBao, rotaciones automáticas | 📋 |  |
| F28.5 Escaneos SAST/DAST (gosec, cargo-audit, ZAP) en CI y corrección | 📋 |  |
| F28.6 Pentest externo y remediación | 📋 |  |
| F28.7 Cumplimiento SBP/DGI/PCI SAQ A/Ley 81 (matriz de controles) | 📋 |  |
| F28.8 SSO de Grafana y consolas internas con identity | 📋 |  |

## F29 — Carga, resiliencia y caos

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F29.1 Escenarios k6 (login, pago wallet, venta POS, checkout, consultas) | 📋 |  |
| F29.2 Datos sintéticos a escala (1 M usuarios, 10 k comercios) | 📋 |  |
| F29.3 Pruebas de carga y ajuste (pools, índices, réplicas) | 📋 |  |
| F29.4 Caos: caída de cada contenedor según matriz de degradación | 📋 |  |
| F29.5 Fallos de red y latencia con toxiproxy/chaos-mesh en sagas | 📋 |  |
| F29.6 Recuperación ante desastre: failover a nube DR | 📋 |  |

## F30 — Lanzamiento a producción

| Paso | Estado | Evidencia / qué falta |
|---|---|---|
| F30.1 Runbooks completos (`delivery-pipeline.md` §9) y simulacro de incidentes | 📋 |  |
| F30.2 On-call, escalamiento y canales de soporte (mesa de ayuda) | 📋 |  |
| F30.3 Credenciales reales de rieles y PAC (Q-02, Q-03, Q-11) y pruebas en vivo controladas | 📋 |  |
| F30.4 Piloto con comercios seleccionados y feature flags | 📋 |  |
| F30.5 Migración/alta asistida de comercios y materiales de entrenamiento | 📋 |  |
| F30.6 Apertura general y revisión post-lanzamiento | 📋 |  |
