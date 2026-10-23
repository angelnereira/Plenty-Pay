# Hoja de ruta — 30 fases

Cada fase deja algo **operable en producción por sí mismo** (con feature flags para lo incompleto) y se descompone en 5–10 pasos con **precedencia estricta** dentro de la fase (`F<nn>.<m>` no empieza hasta cerrar `F<nn>.<m-1>`, salvo que el paso diga "paralelo"). Entre fases manda la columna *Depende de*. El estado real de cada paso vive en [`docs/roadmap/status.md`](docs/roadmap/status.md); la matriz fase × contenedor en [`docs/roadmap/phase-matrix.md`](docs/roadmap/phase-matrix.md).

**Principio "UI primero"**: la app Flutter nace en la Fase 2 (sistema de diseño, login real, navegación dinámica, binarios en `output/`) y **cada fase de módulo termina con sus pantallas** según `docs/ux/screen-catalog.md`. Las fases 22–25 no crean la app: la endurecen (offline, NFC, hardware, tiendas).

Niveles de verificación L0–L5: `docs/standards/testing-strategy.md` §1. Definición de Hecho por paso y por fase: §7–§8 del mismo documento.

## Resumen

| Fase | Nombre | Depende de | Entregable operable |
|---|---|---|---|
| F01 | Fundamentos y gobierno del repositorio | — | Cualquier agente puede tomar un paso del roadmap con solo leer `AGENTS.md`; CI rechaza violaciones de aislamiento y documentación. |
| F02 | Entorno local, CI y cliente Flutter base (UI primero) | F01 | Un usuario puede instalar la app (APK/escritorio/web), registrarse, iniciar sesión contra identity real y ver solo los módulos que su rol permite (con pantallas 'próximamente' por fase). |
| F03 | Contratos gRPC completos | F01 | Contratos v1 congelados para las fases 8–21; cualquier cambio posterior es aditivo y verificado en CI. |
| F04 | Observabilidad | F02 | Grafana muestra RED de identity y gateway; una alerta sintética llega a su destino. |
| F05 | Seguridad base y gestión de plataforma | F04 | identity y gateway leen secretos de OpenBao, hablan por mTLS, y la plataforma puede pausar módulos con flags. |
| F06 | PostgreSQL de producción | F04 | Base lista para servicios con RPO ≤ 5 min demostrado. |
| F07 | NoSQL, bus de eventos y almacenamiento de objetos | F06 | Un servicio de prueba publica por outbox y otro consume; objetos subidos por URL prefirmada. |
| F08 | identity completo | F05, F06, F07 | Personas y negocios se registran y administran su equipo desde la app; el negocio queda en revisión. |
| F09 | api-gateway completo | F08 | Toda ruta nueva se agrega declarando una fila; la app recibe eventos en tiempo real. |
| F10 | ledger | F06, F07 | Los saldos de la plataforma existen con garantías bancarias; consultables por API. |
| F11 | payments-core y billetera | F10, F08, F09 | Personas recargan (sandbox), transfieren y pagan a comercios desde la app; comercios cobran con QR. |
| F12 | Liquidación y conciliación | F11 | Comercios ven su saldo por liquidar y sus lotes; plataforma concilia y resuelve excepciones. |
| F13 | Facturación electrónica DGI | F05, F07 | Cada venta puede generar factura fiscal o recibo interno según la preferencia del comercio. |
| F14 | Geolocalización | F06, F07 | Comercios definen geocercas de sucursal/zona; la app de repartidor reporta ubicación en turno. |
| F15 | Catálogo, marketplace y pedidos multi-comercio | F11, F13 | Un cliente compra en dos comercios con un pago; cada comercio acepta y despacha su parte. |
| F16 | Inventario | F15 | Comercios controlan stock por bodega, reciben compras y reciben alertas de quiebre. |
| F17 | Punto de venta | F16, F13, F11 | Una tienda opera su día completo en PlentyPay: apertura, ventas mixtas, devoluciones y cierre con arqueo. |
| F18 | Logística y entregas | F14, F15 | Pedidos del marketplace se entregan con seguimiento en vivo para el cliente sin cuenta. |
| F19 | Equipo, asistencia y nómina | F11, F14, F05 | Un comercio paga su quincena desde PlentyPay con comprobantes para cada empleado. |
| F20 | Notificaciones multicanal | F08, F09 | Cada hecho de negocio relevante llega al destinatario correcto por su canal preferido. |
| F21 | Inteligencia de negocio | F15, F17, F20 | El dueño entiende su negocio desde el teléfono y recibe alertas de anomalías. |
| F22 | Cliente: offline, enlaces profundos y distribución | F17, F19 | La app funciona con red intermitente, abre enlaces de pago/seguimiento y se actualiza de forma controlada. |
| F23 | Cliente: pagos presenciales QR/NFC y billeteras del dispositivo | F11, F22 | Pagar acercando el teléfono o escaneando, con confirmación biométrica, en Android e iOS. |
| F24 | Cliente: hardware de mostrador | F17 | Una caja en Windows/Linux imprime, abre cajón, muestra display al cliente y lee códigos. |
| F25 | Cliente: accesibilidad, rendimiento y publicación en tiendas | F22, F23, F24 | App publicada en Play Store, App Store, Microsoft Store/instalador, paquetes Linux y web. |
| F26 | Infraestructura como código multi-proveedor | F07 | Un comando crea staging en el proveedor elegido con el mismo contrato de módulo. |
| F27 | Kubernetes | F26 | Staging completo corriendo en Kubernetes con despliegues por Argo CD. |
| F28 | Seguridad avanzada y cumplimiento | F27 | Informe de pentest sin hallazgos críticos abiertos y checklist regulatorio completo. |
| F29 | Carga, resiliencia y caos | F27 | Evidencia de 500 000 usuarios diarios con picos de 2 000 pagos/s y degradación según la matriz. |
| F30 | Lanzamiento a producción | F25, F28, F29 | PlentyPay en producción con soporte, runbooks, on-call y todas las capacidades del blueprint funcional activas o explícitamente pospuestas por regulación. |

## F01 — Fundamentos y gobierno del repositorio

- **Objetivo**: Dejar el repositorio gobernado por documentación: reglas, estándares, contratos de trabajo y verificaciones automáticas.
- **Entregable operable en producción**: Cualquier agente puede tomar un paso del roadmap con solo leer `AGENTS.md`; CI rechaza violaciones de aislamiento y documentación.
- **Contenedores**: docs, scripts, todos (READMEs/SPECs)
- **Depende de**: —

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F01.1 | AGENTS.md, README, ARCHITECTURE, ENGINEERING | raíz | Documentos existen, enlazados entre sí, sin contradicciones con ADRs | L0 |
| F01.2 | ADRs 0001–0017 + índice + plantillas | docs/adr, docs/templates | Índice lista los 17; `check-docs.sh` valida formato | L0 |
| F01.3 | Estándares transversales y por lenguaje | docs/standards | 9 estándares publicados y referenciados desde AGENTS.md | L0 |
| F01.4 | Modelo de dominio con vectores verificados | docs/domain | Vectores A–E y R1–R3 recalculados con aritmética entera de referencia | L1 |
| F01.5 | SPEC.md + README.md en los 23 contenedores | todos | `check-docs.sh` encuentra ambos archivos en cada contenedor de `service-dependencies.md` | L0 |
| F01.6 | Scripts de verificación: aislamiento, documentación, contratos | scripts | `check-isolation.sh`, `check-docs.sh`, `sync-protos.sh --check` en verde | L0 |
| F01.7 | Higiene: `.gitignore`, `.editorconfig`, licencia, plantilla de PR, CODEOWNERS por carpeta, configuración gitleaks | raíz | gitleaks sin hallazgos; PR template con checklist DoD | L0 |
| F01.8 | Catálogo de pantallas y sistema de diseño | docs/ux, docs/design-system.md | Cada módulo del registro tiene sus pantallas listadas por rol con permiso | L0 |

## F02 — Entorno local, CI y cliente Flutter base (UI primero)

- **Objetivo**: Levantar el sistema mínimo local y la app Flutter con sistema de diseño, login real y navegación dinámica por permisos, compilando para todas las plataformas.
- **Entregable operable en producción**: Un usuario puede instalar la app (APK/escritorio/web), registrarse, iniciar sesión contra identity real y ver solo los módulos que su rol permite (con pantallas 'próximamente' por fase).
- **Contenedores**: flutter_app, output, web, api-gateway, identity, docker-compose
- **Depende de**: F01

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F02.1 | `docker-compose.yml` con redes edge/services/data, healthchecks y `.env.example` por contenedor | raíz | `docker compose up --build` deja identity y api-gateway healthy; solo 8080/8081 publicados | L4 |
| F02.2 | Pipeline CI (scripts en `scripts/ci/`): repo-checks, build-test Go/Rust/Flutter afectado, imagen | scripts/ci | Un PR que rompe aislamiento falla en CI | L0 |
| F02.3 | `flutter create` multiplataforma sobre el esqueleto existente; flavors dev/staging/prod; i18n es_PA/en | flutter_app | `flutter analyze` sin warnings; `flutter test` verde; prod rechaza http | L1 |
| F02.4 | Tokens y componentes del design system (PPButton, PPTextField, MoneyText, AsyncView, StatusChip, AppShell) con golden tests claro/oscuro | flutter_app | Goldens aprobados; hex idénticos a `docs/design-system.md` (check-docs) | L1 |
| F02.5 | Sesión segura (secure storage), ApiClient (dio) con refresh único, request-id e Idempotency-Key | flutter_app | Pruebas: 401→refresh→reintento; refresh fallido → login | L1 |
| F02.6 | Login, registro, recuperar contraseña (UI) y shell con navegación dinámica según `enabled_modules` | flutter_app | integration_test contra compose: CUSTOMER ve wallet+marketplace; OWNER ve 11 módulos | L4 |
| F02.7 | Builds de release a `output/` (APK split-per-abi, Linux, Windows, Web; iOS/macOS en runner macOS) | flutter_app, output | Artefactos con checksums SHA-256 en `output/`; APK ≤ 40 MB por ABI | L4 |
| F02.8 | Contenedor `web` sirviendo el bundle Flutter Web | web | `http://localhost:8081` abre la app y hace login vía gateway | L4 |

## F03 — Contratos gRPC completos

- **Objetivo**: Tener todos los `.proto` revisados contra los SPEC, con lint, generación y compatibilidad verificadas.
- **Entregable operable en producción**: Contratos v1 congelados para las fases 8–21; cualquier cambio posterior es aditivo y verificado en CI.
- **Contenedores**: network-contracts
- **Depende de**: F01

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F03.1 | Revisión RPC por RPC de los 18 `.proto` contra cada SPEC §4 (nombres, permisos documentados, idempotency_key) | network-contracts | Tabla de cobertura SPEC↔proto sin huecos en `network-contracts/README.md` | L0 |
| F03.2 | Agregar RPC/mensajes pendientes declarados en SPECs (`payments.PostMemoEntry`, `analytics.AskQuestion`, `analytics.AlertTriggered`, `identity.NotificationRequested`) | network-contracts | Compilan juntos con protoc; cambios solo aditivos | L0 |
| F03.3 | Configurar `buf lint` + `buf breaking` contra `main` | network-contracts, scripts/ci | PR que renumera un campo falla | L0 |
| F03.4 | Generación Go/Rust por `sync-protos.sh` para todas las filas activas de `consumers.txt` | scripts | `--check` verde | L0 |
| F03.5 | Documentar códigos `reason` por RPC (catálogo en `grpc-conventions.md` anexo) | docs/standards | Cada reason usado en SPECs aparece en el catálogo | L0 |

## F04 — Observabilidad

- **Objetivo**: Pila de métricas, logs, trazas y alertas operando antes de cualquier servicio de dinero.
- **Entregable operable en producción**: Grafana muestra RED de identity y gateway; una alerta sintética llega a su destino.
- **Contenedores**: observability, identity, api-gateway
- **Depende de**: F02

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F04.1 | OTel Collector + Prometheus con scrape de `:9100` | observability | Métricas de identity visibles | L4 |
| F04.2 | Loki + recolector de logs de Docker | observability | Búsqueda por `request_id` devuelve logs de gateway e identity | L4 |
| F04.3 | Tempo + propagación `traceparent` gateway→identity | observability, api-gateway, identity | Una traza con 2 spans por login | L4 |
| F04.4 | Grafana con 7 dashboards como código | observability | Dashboards aprovisionados al arrancar | L4 |
| F04.5 | Alertmanager + reglas críticas/warning con runbook_url | observability | `amtool check-config`; alerta inyectada llega | L4 |
| F04.6 | Instrumentar identity y gateway según estándar (logs JSON, métricas obligatorias, puerto admin) | identity, api-gateway | Campos obligatorios presentes; sin PII en logs (prueba) | L2 |

## F05 — Seguridad base y gestión de plataforma

- **Objetivo**: Secretos fuera del código, cifrado por propósito, auditoría inmutable, mTLS entre servicios y feature flags.
- **Entregable operable en producción**: identity y gateway leen secretos de OpenBao, hablan por mTLS, y la plataforma puede pausar módulos con flags.
- **Contenedores**: security, infra-management, identity, api-gateway
- **Depende de**: F04

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F05.1 | OpenBao en compose (modo dev solo local; política de unseal documentada) | security | Healthy; secretos KV de prueba | L2 |
| F05.2 | Servicio security: GetSecret/PutSecret con ACL por SAN | security | Contenedor no listado → PERMISSION_DENIED | L2 |
| F05.3 | Encrypt/Decrypt por propósito con AAD | security | AAD distinto falla; rotación mantiene descifrado | L2 |
| F05.4 | Auditoría encadenada + consumidor `pp.audit.>` + VerifyAuditChain | security | Alterar una fila rompe la cadena (prueba) | L2 |
| F05.5 | ReportSecurityEvent / IsBlocked con reglas R5 | security | 20 fallos de login por IP → bloqueo | L2 |
| F05.6 | PKI SPIFFE + mTLS en identity y gateway; step-up en identity (Issue/Verify/Consume) | security, identity, api-gateway | Llamada sin certificado → UNAUTHENTICATED; token step-up de un solo uso, emitido solo tras verificar en el servidor una passkey o el PIN (identity R25–R28, R32; ADR 0020) | L4 |
| F05.7 | infra-management: flags + NATS KV | infra-management | Cambio de flag visible en servicio en ≤ 5 s | L2 |
| F05.8 | Config con JSON Schema + valores iniciales (límites, umbrales, feriados) | infra-management | Valor inválido rechazado | L2 |
| F05.9 | GetClientConfig + modo mantenimiento + pantalla de consola de flags en Flutter (módulo platform) | infra-management, flutter_app | App fuerza actualización si versión < mínima | L4 |

## F06 — PostgreSQL de producción

- **Objetivo**: Base relacional con esquemas/roles por contenedor, pool, monitoreo y respaldos probados.
- **Entregable operable en producción**: Base lista para servicios con RPO ≤ 5 min demostrado.
- **Contenedores**: postgres-db
- **Depende de**: F04

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F06.1 | Imagen PostgreSQL 16 + PostGIS + init de esquemas y roles | postgres-db | Rol de un servicio no lee otro esquema (prueba) | L2 |
| F06.2 | PgBouncer en modo transacción | postgres-db | Servicios conectan por 6432 | L2 |
| F06.3 | postgres_exporter + alertas (réplica, disco, conexiones) | postgres-db, observability | Panel en dashboard Plataforma | L4 |
| F06.4 | Respaldos base + WAL a object-storage (o directorio local en compose) | postgres-db | Respaldo diario generado | L2 |
| F06.5 | Prueba de restauración PITR documentada en runbook | postgres-db, docs/runbooks | Restauración a un punto en el tiempo verificada | L4 |

## F07 — NoSQL, bus de eventos y almacenamiento de objetos

- **Objetivo**: ScyllaDB, NATS JetStream y Garage operando con permisos por dueño.
- **Entregable operable en producción**: Un servicio de prueba publica por outbox y otro consume; objetos subidos por URL prefirmada.
- **Contenedores**: nosql-db, event-bus, object-storage
- **Depende de**: F06

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F07.1 | ScyllaDB nodo + healthcheck | nosql-db | CQL responde | L2 |
| F07.2 | Roles y keyspaces por dueño | nosql-db | Rol de geo no escribe en analytics | L2 |
| F07.3 | Monitoreo y procedimiento de backup | nosql-db, observability | Métricas en dashboard | L4 |
| F07.4 | NATS + JetStream persistente | event-bus | Stream sobrevive reinicio | L2 |
| F07.5 | Streams y KV como código | event-bus | Job aplica definiciones idempotentemente | L2 |
| F07.6 | Cuentas y permisos por servicio (nkeys en prod) | event-bus | Servicio no publica fuera de su dominio | L2 |
| F07.7 | Exporter + alertas de lag y DLQ | event-bus, observability | Alerta de DLQ inyectada | L4 |
| F07.8 | Garage nodo + layout | object-storage | API S3 responde | L2 |
| F07.9 | Buckets y llaves por contenedor como script | object-storage | Llave de catalog no lee pp-fiscal | L2 |
| F07.10 | URLs prefirmadas de referencia documentadas (PUT/GET con tipo y tamaño) | object-storage | Subida > tamaño máximo rechazada | L2 |

## F08 — identity completo

- **Objetivo**: Usuarios, sesiones seguras, negocios, roles personalizados e invitaciones en PostgreSQL.
- **Entregable operable en producción**: Personas y negocios se registran y administran su equipo desde la app; el negocio queda en revisión.
- **Contenedores**: identity, flutter_app
- **Depende de**: F05, F06, F07

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F08.1 | Núcleo en memoria: Register/Login/Validate/Permissions/Refresh + catálogo de permisos y módulos | identity | Pruebas R1–R6, R10, R12 | L1 |
| F08.2 | PostgreSQL + migraciones + estructura del estándar Go | identity | Pruebas L2 de store; RLS activo | L2 |
| F08.3 | Sesiones con rotación de refresh y detección de reuso | identity | R8, R9 con prueba | L2 |
| F08.4 | Bloqueo progresivo | identity | R5 | L2 |
| F08.5 | Tenants: CreateBusiness/ReviewBusiness/GetTenant + outbox `TenantStatusChanged` | identity | Evento publicado una vez por transición | L2 |
| F08.6 | Roles personalizados + invitaciones de staff, modelo de acceso, sucursales y capacidades | identity | R12, R13, R20–R24; invitaciones con alcance TENANT/BRANCHES, reglas A1–A3, resolución de membresía | L2 |
| F08.7 | Recuperación y cambio de contraseña | identity | R16 | L2 |
| F08.8 | Pantallas Flutter: perfil, sesiones, alta de negocio (KYB), equipo, roles, invitaciones, revisión de negocios (plataforma) | flutter_app | integration_test: dueño invita cajero y el cajero ve su menú | L4 |

## F09 — api-gateway completo

- **Objetivo**: Gateway declarativo con metadatos de contexto, traducción genérica, tiempo real, límites y OpenAPI.
- **Entregable operable en producción**: Toda ruta nueva se agrega declarando una fila; la app recibe eventos en tiempo real.
- **Contenedores**: api-gateway
- **Depende de**: F08

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F09.1 | Núcleo auth (login/register/refresh/me/permissions) | api-gateway | 10 pruebas + E2E 14 comprobaciones | L4 |
| F09.2 | Interceptor de metadatos `x-pp-*` y descarte de cabeceras entrantes | api-gateway | R5 con prueba | L1 |
| F09.3 | Tabla declarativa de rutas + traductor JSON↔proto | api-gateway | Golden tests por ruta | L3 |
| F09.4 | Errores con ErrorInfo/reason estables | api-gateway | Tabla de `grpc-conventions.md` §4 cubierta | L1 |
| F09.5 | WebSocket `/v1/realtime` con topics session e inbox | api-gateway | Cierre por SessionRevoked ≤ 5 s | L4 |
| F09.6 | Rate limits con NATS KV | api-gateway | 429 + Retry-After con 2 réplicas | L4 |
| F09.7 | OpenAPI generado desde la tabla de rutas | api-gateway | `/v1/openapi.json` válido (validador OpenAPI 3.1) | L3 |

## F10 — ledger

- **Objetivo**: Libro mayor de doble entrada en Rust con invariantes en código y en base de datos.
- **Entregable operable en producción**: Los saldos de la plataforma existen con garantías bancarias; consultables por API.
- **Contenedores**: ledger
- **Depende de**: F06, F07

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F10.1 | Proyecto Rust + dominio Money/plantillas con proptest | ledger | Propiedades I1, I2, montos; clippy -D warnings | L1 |
| F10.2 | Migraciones + triggers + port de los 27 casos de referencia | ledger | 27/27 contra PostgreSQL 16 | L2 |
| F10.3 | PostTransaction y ReverseTransaction | ledger | R1–R8 con prueba | L2 |
| F10.4 | Saldos y extractos | ledger | Saldo corrido coincide con recomputado | L2 |
| F10.5 | Holds + expiración | ledger | R9, R10 | L2 |
| F10.6 | Outbox + eventos | ledger | TransactionPosted exactamente una vez por transacción (consumidor de prueba) | L2 |
| F10.7 | Job I7 + métricas + alertas | ledger, observability | Inyectar descuadre dispara alerta crítica | L4 |
| F10.8 | Carga básica | ledger | 500 PostTransaction/s p99 ≤ 50 ms en compose | L5 |

## F11 — payments-core y billetera

- **Objetivo**: Cobros con wallet interna y rieles en sandbox, comisiones exactas, reembolsos y UNKNOWN.
- **Entregable operable en producción**: Personas recargan (sandbox), transfieren y pagan a comercios desde la app; comercios cobran con QR.
- **Contenedores**: payments-core, flutter_app
- **Depende de**: F10, F08, F09

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F11.1 | Proyecto + dominio: máquinas de estado y fee engine con vectores | payments-core | Vectores A–E, R1–R3 literales | L1 |
| F11.2 | Migraciones | payments-core | Índices únicos de §3 probados | L2 |
| F11.3 | Intents y pagos wallet con holds | payments-core | Prueba de aceptación 1 del SPEC | L4 |
| F11.4 | Worker de asiento + outbox | payments-core | CAPTURED sin asiento se reintenta; alerta a 5 min | L4 |
| F11.5 | Terminales + ResolveTerminal | payments-core | Nombre verificado; inactiva → error | L2 |
| F11.6 | Reembolsos (T7) con step-up | payments-core | Prueba de aceptación 4 | L4 |
| F11.7 | Adaptador sandbox genérico + job UNKNOWN | payments-core | Prueba de aceptación 2 | L4 |
| F11.8 | Webhooks con verificación de firma | payments-core, api-gateway | Duplicados sin efecto; firma inválida 401 | L4 |
| F11.9 | Pantallas Flutter: billetera, recargar, enviar, cobrar/pagar con QR, detalle y estado 'confirmando', terminales del comercio | flutter_app | integration_test: pago QR wallet de punta a punta | L4 |
| F11.10 | Transferencias entre personas (T4) y código personal para recibir (QR de S-WAL-04, rota cada 24 h; también identifica a la persona) | payments-core, identity, api-gateway, flutter_app | T4 balanceado, sin auto-transferencia, código vencido o ajeno rechazado, reintento sin duplicar | L4 |

Ficha ejecutable de F11.10 (25 campos): [`docs/roadmap/commerce-plan.md`](docs/roadmap/commerce-plan.md) §D.

## F12 — Liquidación y conciliación

- **Objetivo**: Pagar a los comercios lo que se les debe y conciliar contra extractos.
- **Entregable operable en producción**: Comercios ven su saldo por liquidar y sus lotes; plataforma concilia y resuelve excepciones.
- **Contenedores**: settlement, flutter_app
- **Depende de**: F11

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F12.1 | Dominio + migraciones | settlement | Modelo §3 | L2 |
| F12.2 | Calendarios y destino cifrado con step-up | settlement | R5 | L2 |
| F12.3 | CreateBatch + items | settlement | R1–R4, R6 | L2 |
| F12.4 | Confirm/FailPayout + T6/T6b | settlement | Prueba de aceptación 1 | L4 |
| F12.5 | Importación de extractos (CSV genérico) | settlement | Formato documentado en SPEC | L2 |
| F12.6 | Conciliación + T5 + excepciones | settlement | Prueba de aceptación 2 | L4 |
| F12.7 | Jobs y alertas | settlement, observability | Alertas de §9 | L4 |
| F12.8 | Pantallas Flutter: finanzas del comercio (saldo, lotes, calendario) y consola de conciliación | flutter_app | Widget tests 4 estados | L4 |

## F13 — Facturación electrónica DGI

- **Objetivo**: Emitir documentos fiscales válidos a través de un PAC con folios sin huecos.
- **Entregable operable en producción**: Cada venta puede generar factura fiscal o recibo interno según la preferencia del comercio.
- **Contenedores**: fiscal-invoicing, flutter_app
- **Depende de**: F05, F07

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F13.1 | Dominio: totales e impuestos, políticas de documento | fiscal-invoicing | R1 con vectores | L1 |
| F13.2 | Migraciones + folios | fiscal-invoicing | R2 con concurrencia | L2 |
| F13.3 | Perfil fiscal + credenciales en security | fiscal-invoicing, security | Credencial nunca en BD fiscal | L2 |
| F13.4 | PacClient + simulador | fiscal-invoicing | Aceptación/rechazo/timeout simulados | L2 |
| F13.5 | IssueInvoice + worker de envío | fiscal-invoicing | Prueba de aceptación 2 | L4 |
| F13.6 | PDF/XML a object-storage con QR | fiscal-invoicing | Prueba de aceptación 1 | L4 |
| F13.7 | Notas de crédito/débito | fiscal-invoicing | R7 | L2 |
| F13.8 | Facturación de comisiones de PlentyPay a comercios | fiscal-invoicing | Factura mensual por tenant con total = comisiones del ledger | L4 |
| F13.9 | Pantallas Flutter: perfil fiscal, facturas, notas, contribuyentes | flutter_app | Widget tests 4 estados | L4 |

Cierre comercial de F13.5 (factura pedida por pos y orders al vender): [`docs/roadmap/commerce-plan.md`](docs/roadmap/commerce-plan.md) §C «F13.5 · Cierre».

## F14 — Geolocalización

- **Objetivo**: Ubicaciones en vivo y geocercas como servicio base de logística y nómina.
- **Entregable operable en producción**: Comercios definen geocercas de sucursal/zona; la app de repartidor reporta ubicación en turno.
- **Contenedores**: geolocation, flutter_app
- **Depende de**: F06, F07

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F14.1 | Geocercas PostGIS | geolocation | Círculo y polígono | L2 |
| F14.2 | Ingesta + última posición con filtros de calidad | geolocation | R4 y descartes | L2 |
| F14.3 | Trayectorias en Scylla con TTL | geolocation | R2 | L2 |
| F14.4 | FindNearby / IsInside | geolocation | Coincide con haversine de referencia | L2 |
| F14.5 | Cruces de geocerca + eventos | geolocation | R3 con histéresis | L2 |
| F14.6 | WatchSubject | geolocation | Stream recibe pings | L3 |
| F14.7 | Pantalla Flutter: editor de geocercas sobre mapa (flutter_map) | flutter_app | Widget test | L1 |

## F15 — Catálogo, marketplace y pedidos multi-comercio

- **Objetivo**: Catálogo por comercio, vitrina pública y compra en varios comercios con un solo pago.
- **Entregable operable en producción**: Un cliente compra en dos comercios con un pago; cada comercio acepta y despacha su parte.
- **Contenedores**: catalog, orders, flutter_app
- **Depende de**: F11, F13

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F15.1 | Productos y variantes | catalog | R1–R3 | L2 |
| F15.2 | Categorías + imágenes con URL prefirmada | catalog | R6 | L2 |
| F15.3 | Importación masiva | catalog | Prueba de aceptación (10 000 filas) | L2 |
| F15.4 | Listados + storefront | catalog | R4 | L2 |
| F15.5 | Búsqueda del marketplace (+ atributos en Scylla) | catalog | R7 | L2 |
| F15.6 | orders: dominio + migraciones | orders | Estados §8.10 | L1 |
| F15.7 | Carrito + cotización | orders | Límites del carrito | L2 |
| F15.8 | Checkout saga + consumidores de pagos | orders | Pruebas de aceptación 1, 3, 4 | L4 |
| F15.9 | Aceptación/SLA + reembolsos + integración logística y fiscal | orders | Prueba de aceptación 2 | L4 |
| F15.10 | Pantallas Flutter: catálogo del comercio, vitrina, marketplace, carrito, checkout, mis pedidos, pedidos del comercio | flutter_app | integration_test: compra multi-comercio | L4 |
| F15.11 | Ficha de producto por categoría (plantillas por vertical, validación condicional en el servidor) | catalog, flutter_app | Alta rápida con lo mínimo; campo obligatorio de la plantilla validado en el servidor | L2 |
| F15.12 | Historial de cambios del producto | catalog | Cada cambio deja su fila inmutable en la misma transacción | L2 |
| F15.13 | Aviso de pedido entrante en tiempo real (depende de F20.3/F20.4) | notifications, flutter_app | Aviso en < 5 s solo a quien tiene `orders:manage` | L4 |

Fichas ejecutables de los pasos abiertos de F15 (25 campos): [`docs/roadmap/commerce-plan.md`](docs/roadmap/commerce-plan.md) §A y §G.

## F16 — Inventario

- **Objetivo**: Existencias exactas con reservas, compras y sugerencias de reorden.
- **Entregable operable en producción**: Comercios controlan stock por bodega, reciben compras y reciben alertas de quiebre.
- **Contenedores**: inventory, flutter_app
- **Depende de**: F15

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F16.1 | Bodegas y niveles de stock | inventory | Modelo §3 | L2 |
| F16.2 | Movimientos y ajustes | inventory | R1, R2 | L2 |
| F16.3 | Reservas con TTL | inventory | Prueba de concurrencia del SPEC | L2 |
| F16.4 | Transferencias y lotes FEFO | inventory | R5 | L2 |
| F16.5 | Proveedores, órdenes de compra y recepción | inventory | §8.12 | L2 |
| F16.6 | Velocidad de venta, StockLow y reorden | inventory | R6 contra cálculo de referencia | L2 |
| F16.7 | Pantallas Flutter: stock, movimientos, ajustes, transferencias, compras, recepción con escáner, sugerencias | flutter_app | Widget tests 4 estados | L4 |
| F16.8 | Lotes y vencimiento en la recepción de compras (depende de F16.4) | inventory, flutter_app | `LOT_REQUIRED` y `LOT_EXPIRED` en la recepción; Σ lotes = existencias | L2 |
| F16.9 | Sucursal en bodegas y `BRANCH_OUT_OF_SCOPE` (ADR 0018) | inventory | Vectores V3/V7 aplicados a bodegas | L2 |
| F16.10 | Existencias bloqueadas o dañadas y alertas de vencimiento (depende de F16.4) | inventory, flutter_app | disponible = on_hand − reservado − bloqueado con vectores | L2 |
| F16.11 | Escáner en inventario (cámara y lector HID, antirrebote) | flutter_app | Doble lectura cuenta una vez; L4 en dispositivo físico | L4 |
| F16.12 | Incidencias y diferencias de recepción; cerrar orden con faltante (depende de F16.10) | inventory, flutter_app | Lo dañado no queda disponible | L2 |
| F16.13 | Historial de compras y costo de adquisición (costo de lo vendido ⛔ Q-52) | inventory, flutter_app | Coincide con las recepciones | L2 |
| F16.14 | inventory consume `catalog.product.changed` (hueco 2 de `event-chains.md`) | inventory, catalog | El punto de reorden llega a inventory en ≤ 30 s, una vez aunque el evento se repita | L2 |
| F16.15 | Devolución al proveedor (depende de F16.12) | inventory, flutter_app | Nunca más de lo recibido de la orden; R1 y bloqueado = Σ siguen cuadrando | L2 |
| F16.16 | Verificación diaria de invariantes de inventario | inventory, observability | Base sana → 0 violaciones; una diferencia sembrada se detecta y alerta | L2 |
| F16.17 | Cuentas por pagar a proveedores, opcional por comercio (Q-55 resuelta) | inventory, flutter_app | Módulo apagado no cambia nada; saldo del proveedor = Σ deudas − Σ pagos, sin pagar dos veces | L2 |

Fichas ejecutables (25 campos): [`docs/roadmap/commerce-plan.md`](docs/roadmap/commerce-plan.md) §A y §B. Fichas de ejecución de F16.14–F16.16: [`docs/roadmap/execution/`](docs/roadmap/execution/README.md).

## F17 — Punto de venta

- **Objetivo**: Mostrador completo multi-pago, offline y con pantalla del cliente.
- **Entregable operable en producción**: Una tienda opera su día completo en PlentyPay: apertura, ventas mixtas, devoluciones y cierre con arqueo.
- **Contenedores**: pos, flutter_app
- **Depende de**: F16, F13, F11

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F17.1 | Dominio: totales e impuestos incluidos | pos | R2 con vectores | L1 |
| F17.2 | Migraciones | pos | Una sesión abierta por caja | L2 |
| F17.3 | Cajas, sesiones y reporte Z | pos | R1 y cierre | L2 |
| F17.4 | Ventas y estacionar | pos | §8.9 | L2 |
| F17.5 | Checkout multi-tender | pos | Prueba de aceptación 1 | L4 |
| F17.6 | Crédito de la casa y puntos (`payments.PostMemoEntry`) | pos, payments-core | T8/T9 balanceados | L4 |
| F17.7 | Sincronización offline | pos | Prueba de aceptación 2 | L4 |
| F17.8 | Stream de pantalla del cliente | pos, api-gateway | Display emparejado recibe líneas en < 500 ms | L4 |
| F17.9 | Devoluciones y anulaciones | pos | Prueba de aceptación 4 | L4 |
| F17.10 | Pantallas Flutter del POS (venta en 2 paneles, cobro, cierre, devoluciones, display del cliente) | flutter_app | integration_test: venta mixta efectivo+wallet | L4 |
| F17.11 | Configuración de caja (`GetPosSettings`/`UpdatePosSettings`, S-POS-11) | pos, flutter_app | Un cambio rige en la venta siguiente | L2 |
| F17.12 | Sucursal en cajas y ventas; `BRANCH_OUT_OF_SCOPE` (depende de F16.9) | pos | Cajero con alcance a una sucursal no abre cajas de otra | L2 |
| F17.13 | Cambio de turno y cierre forzado de sesiones abandonadas (supuesto Q-51) | pos, flutter_app | Relevo sin perder ventas ni efectivo; cierre forzado con confirmación fuerte | L2 |
| F17.14 | Correcciones posteriores a la venta: cada tipo por el mecanismo de su dominio | flutter_app, pos | Ninguna corrección edita una venta pagada | L1 |
| F17.15 | Programa de lealtad: reglas versionadas por comercio (activación ⛔ Q-45) | pos, identity (permisos `loyalty:*`) | Programa desactivado por defecto; versión en cada asiento | L2 |
| F17.16 | Acumulación y reversión de puntos (T8 vía `payments.PostMemoEntry`, depende de F17.6) | pos, payments-core | Saldo de puntos = Σ asientos | L4 |
| F17.17 | Canje de puntos en el cobro | pos, payments-core, flutter_app | `INSUFFICIENT_POINTS`; nunca saldo negativo | L4 |
| F17.18 | Cupones y tarjetas de regalo | pos, payments-core | ⛔ Q-48 | — |
| F17.19 | Propinas | pos, fiscal-invoicing | ⛔ Q-21 | — |
| F17.20 | Devolución al lote original (nota abierta de F17.9) | pos, inventory | Vender de un lote y devolver con reingreso deja ese lote con lo devuelto | L2 |

Fichas ejecutables (25 campos): [`docs/roadmap/commerce-plan.md`](docs/roadmap/commerce-plan.md) §C, §D y §H. F17.4 se cierra con estacionar/retomar (ficha detallada en ese documento).

## F18 — Logística y entregas

- **Objetivo**: Entregas con repartidores propios/externos, prueba de entrega y seguimiento público.
- **Entregable operable en producción**: Pedidos del marketplace se entregan con seguimiento en vivo para el cliente sin cuenta.
- **Contenedores**: logistics, web, flutter_app
- **Depende de**: F14, F15

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F18.1 | Transportistas y repartidores | logistics | Repartidor requiere permiso | L2 |
| F18.2 | Entregas y estados | logistics | §8.11 completo | L2 |
| F18.3 | Asignación manual y por cercanía | logistics | Elige al más cercano activo | L4 |
| F18.4 | Prueba de entrega (código, foto, firma) | logistics | R2 | L2 |
| F18.5 | Seguimiento público + stream | logistics, api-gateway | R5; sin datos personales | L4 |
| F18.6 | Integración con orders + página pública de seguimiento en `web` | logistics, orders, web | Sub-pedido COMPLETED al entregar | L4 |
| F18.7 | Pantallas Flutter: despacho (comercio) y app de repartidor (ruta, escaneo, prueba) | flutter_app | integration_test de entrega | L4 |
| F18.8 | Confirmación de entrega con QR de un solo uso (concreta el código de F18.4) | logistics, flutter_app | No confirma otra entrega, no se reutiliza y vence | L2 |

Fichas ejecutables (25 campos): [`docs/roadmap/commerce-plan.md`](docs/roadmap/commerce-plan.md) §F. F18.5 queda ⛔ por Q-49 y F14: sin mapa ni coordenadas simuladas.

## F19 — Equipo, asistencia y nómina

- **Objetivo**: Marcaje confiable y nómina pagada a wallets.
- **Entregable operable en producción**: Un comercio paga su quincena desde PlentyPay con comprobantes para cada empleado.
- **Contenedores**: payroll, flutter_app
- **Depende de**: F11, F14, F05

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F19.1 | Empleados con datos cifrados | payroll | Cédula nunca en claro | L2 |
| F19.2 | Turnos y horarios | payroll | Calendario | L2 |
| F19.3 | Marcaje PIN/QR dinámico/NFC + geocerca | payroll | R2–R4 | L4 |
| F19.4 | Biometría en dispositivo + modo quiosco | payroll, flutter_app | R1; quiosco offline | L4 |
| F19.5 | Cálculo de nómina | payroll | Hoja de referencia (Q-13 para valores legales) | L1 |
| F19.6 | Aprobación y pago (T10) | payroll, payments-core | R6 | L4 |
| F19.7 | Comprobantes PDF | payroll | R7 | L2 |
| F19.8 | Pantallas Flutter: empleados, horarios, marcaje, quiosco, corridas de nómina, mis comprobantes | flutter_app | integration_test de marcaje y pago | L4 |

## F20 — Notificaciones multicanal

- **Objetivo**: Mensajes confiables por correo, push, SMS, WhatsApp e in-app.
- **Entregable operable en producción**: Cada hecho de negocio relevante llega al destinatario correcto por su canal preferido.
- **Contenedores**: notifications, flutter_app
- **Depende de**: F08, F09

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F20.1 | Plantillas + render | notifications | Variables validadas | L1 |
| F20.2 | Correo (Resend/SMTP) | notifications | Modo log sin credenciales | L2 |
| F20.3 | Bandeja in-app + stream | notifications, api-gateway | Topic inbox | L4 |
| F20.4 | Push + dispositivos | notifications, flutter_app | Token por dispositivo | L4 |
| F20.5 | Reglas de suscripción (consumidores) | notifications | Tabla R2 completa | L2 |
| F20.6 | Preferencias y supresiones | notifications | R5; seguridad no desactivable | L2 |
| F20.7 | WhatsApp (Jelou) y SMS | notifications | Q-14 resuelta o modo log | L4 |
| F20.8 | Pantallas Flutter: bandeja, preferencias, plantillas del comercio | flutter_app | Widget tests | L4 |

## F21 — Inteligencia de negocio

- **Objetivo**: Métricas, dashboards, anomalías, pronósticos, segmentos y preguntas en lenguaje natural.
- **Entregable operable en producción**: El dueño entiende su negocio desde el teléfono y recibe alertas de anomalías.
- **Contenedores**: analytics-bi, flutter_app
- **Depende de**: F15, F17, F20

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F21.1 | Ingesta de eventos crudos (Scylla) | analytics-bi | Idempotente | L2 |
| F21.2 | Agregados de ventas y productos | analytics-bi | Coinciden con referencia | L2 |
| F21.3 | Catálogo de métricas + QueryMetric | analytics-bi | R2 | L2 |
| F21.4 | Dashboards | analytics-bi | CRUD | L2 |
| F21.5 | ABC + RFM | analytics-bi | R5 | L1 |
| F21.6 | Alertas y anomalías | analytics-bi, notifications | R3 | L4 |
| F21.7 | Pronóstico | analytics-bi | R4 | L1 |
| F21.8 | Preguntas en lenguaje natural | analytics-bi | R6; nunca SQL libre | L2 |
| F21.9 | Exportes | analytics-bi | CSV/XLSX | L2 |
| F21.10 | Pantallas Flutter: inicio con KPIs, dashboards, preguntar, alertas, segmentos, exportes | flutter_app | Widget tests + gráfico golden | L4 |

## F22 — Cliente: offline, enlaces profundos y distribución

- **Objetivo**: Robustecer la app para uso diario real en todas las plataformas.
- **Entregable operable en producción**: La app funciona con red intermitente, abre enlaces de pago/seguimiento y se actualiza de forma controlada.
- **Contenedores**: flutter_app, web
- **Depende de**: F17, F19

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F22.1 | Outbox local drift genérico (ventas, marcajes) con cifrado en móvil | flutter_app | Reintentos ordenados; sin duplicados | L4 |
| F22.2 | Caché de catálogo/precios versionada | flutter_app | Regla de 24 h | L1 |
| F22.3 | Deep links (App Links/Universal Links) + `.well-known` en web | flutter_app, web | `/t/`, `/track/`, `/invite/`, `/reset/` abren la pantalla correcta | L4 |
| F22.4 | Actualización forzada por versión mínima | flutter_app | Con GetClientConfig | L4 |
| F22.5 | Firma de builds y canales (interno/beta) por plataforma | flutter_app, scripts/ci | Artefactos firmados en output/ | L4 |
| F22.6 | Telemetría de errores del cliente sin PII (a observability vía gateway) | flutter_app, api-gateway | Error de prueba visible con request_id | L4 |

## F23 — Cliente: pagos presenciales QR/NFC y billeteras del dispositivo

- **Objetivo**: Experiencia de pago presencial de nivel bancario.
- **Entregable operable en producción**: Pagar acercando el teléfono o escaneando, con confirmación biométrica, en Android e iOS.
- **Contenedores**: flutter_app, payments-core, web
- **Depende de**: F11, F22

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F23.1 | Escáner QR con validación de host/regex | flutter_app | Reglas de `flutter-standards.md` §10 | L1 |
| F23.2 | NFC NDEF lectura (Android/iOS) y escritura de tags de terminal | flutter_app | Probado en dispositivos físicos (lista en status) | L4 |
| F23.3 | Biometría local + step-up integrado | flutter_app, identity | Pago ≥ umbral exige step-up | L4 |
| F23.4 | Pantalla 'confirmando' (UNKNOWN) + notificación final | flutter_app | Nunca muestra 'falló' en UNKNOWN | L4 |
| F23.5 | Enlaces de pago `/t/<code>` en web | web | Abre app o tiendas | L4 |
| F23.6 | Apple Pay / Google Pay vía PSP (si Q-03 resuelta; si no, oculto por flag) | flutter_app, payments-core | Sandbox del PSP | L4 |
| F23.7 | Recibos compartibles PDF | flutter_app | Golden del recibo | L1 |
| F23.8 | Registro de capacidades del dispositivo (`lib/core/device/`) y pantalla S-GEN-23 | flutter_app | Cada capacidad responde soportada / configurada / permiso / activada / motivo; ningún permiso se pide al abrir la app; un widget test por estado (ADR 0020) | L1 |

## F24 — Cliente: hardware de mostrador

- **Objetivo**: POS de escritorio y quiosco listos para tienda física.
- **Entregable operable en producción**: Una caja en Windows/Linux imprime, abre cajón, muestra display al cliente y lee códigos.
- **Contenedores**: flutter_app, pos
- **Depende de**: F17

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F24.1 | Impresión de recibos 80 mm (sistema y ESC/POS por red) | flutter_app | Q-12 modelos de referencia | L4 |
| F24.2 | Apertura de cajón vía impresora | flutter_app | Solo con venta/movimiento | L4 |
| F24.3 | Lectores de código de barras (teclado HID) y cámara | flutter_app | Lookup en < 300 ms | L4 |
| F24.4 | Pantalla del cliente en segundo monitor / tablet emparejada | flutter_app, pos | Emparejamiento por código | L4 |
| F24.5 | Modo quiosco (pantalla completa bloqueada) para POS y marcaje | flutter_app | Salida solo con PIN de gerente | L4 |

## F25 — Cliente: accesibilidad, rendimiento y publicación en tiendas

- **Objetivo**: Calidad de producto final en todas las plataformas.
- **Entregable operable en producción**: App publicada en Play Store, App Store, Microsoft Store/instalador, paquetes Linux y web.
- **Contenedores**: flutter_app, output
- **Depende de**: F22, F23, F24

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F25.1 | Auditoría de accesibilidad WCAG AA (lectores de pantalla, escala 200 %) | flutter_app | Checklist sin bloqueantes | L4 |
| F25.2 | Rendimiento: arranque < 2.5 s, listas 60 fps, tamaños de bundle | flutter_app | Mediciones en dispositivos de referencia | L5 |
| F25.3 | Carga diferida por módulo en web | flutter_app | Bundle inicial ≤ 3 MB | L4 |
| F25.4 | Textos legales, privacidad y consentimientos en la app | flutter_app | Revisión legal (Q-08) | L0 |
| F25.5 | Fichas y envío a tiendas; paquetes Linux (deb/AppImage) y Windows (MSIX) | flutter_app, output | Builds aceptados por las tiendas | L4 |

## F26 — Infraestructura como código multi-proveedor

- **Objetivo**: Clústeres reproducibles en servidores propios y en al menos una nube.
- **Entregable operable en producción**: Un comando crea staging en el proveedor elegido con el mismo contrato de módulo.
- **Contenedores**: infra/opentofu
- **Depende de**: F07

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F26.1 | Estructura `infra/opentofu` + backend de estado S3 con bloqueo | infra | `tofu validate` en CI | L0 |
| F26.2 | Módulo `cluster-self-hosted` (k3s HA) | infra | Clúster de 3 nodos en VMs de prueba | L4 |
| F26.3 | Módulo `cluster-gcp` (o el proveedor de DR elegido primero) | infra | Mismo contrato de salidas | L4 |
| F26.4 | Módulos `cluster-aws` y `cluster-azure` | infra | `tofu plan` limpio con credenciales de prueba | L2 |
| F26.5 | Módulo `cluster-railway` con limitaciones documentadas | infra | Staging de demostración | L4 |
| F26.6 | Módulo `platform` (operadores, Argo CD, cert-manager, ingress, External Secrets) | infra | Aplicado sobre self-hosted y nube | L4 |
| F26.7 | DNS, certificados y entornos staging/prod-primary/prod-dr | infra | TLS válido en staging | L4 |

## F27 — Kubernetes

- **Objetivo**: Migrar de Compose a Kubernetes con GitOps y operadores de datos.
- **Entregable operable en producción**: Staging completo corriendo en Kubernetes con despliegues por Argo CD.
- **Contenedores**: infra/kubernetes, todos
- **Depende de**: F26

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F27.1 | Kustomize base por contenedor desde el bloque Compose | infra | `kubectl kustomize` válido para los 23 | L0 |
| F27.2 | Seguridad de pods, ServiceAccounts, NetworkPolicy desde la matriz de llamadas | infra | Llamada no permitida bloqueada | L4 |
| F27.3 | CloudNativePG, Scylla Operator, NATS, Garage en clúster | infra | Failover de PostgreSQL < 1 min | L5 |
| F27.4 | HPA, PDB, topology spread | infra | Drenar un nodo sin errores 5xx | L5 |
| F27.5 | Argo CD + overlays staging/prod + jobs de migración PreSync | infra | Despliegue por commit | L4 |
| F27.6 | Argo Rollouts canary para ledger y payments-core | infra | Rollback automático por métricas | L4 |
| F27.7 | infra-management.ListServices sobre Kubernetes | infra-management | Consola muestra versión y salud reales | L4 |

## F28 — Seguridad avanzada y cumplimiento

- **Objetivo**: Cerrar los requisitos regulatorios y de seguridad para operar con dinero real.
- **Entregable operable en producción**: Informe de pentest sin hallazgos críticos abiertos y checklist regulatorio completo.
- **Contenedores**: security, identity, api-gateway, payments-core, flutter_app
- **Depende de**: F27

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F28.1 | EdDSA + JWKS y validación local en gateway | identity, api-gateway | Gateway valida sin identity | L4 |
| F28.2 | Passkeys (sin depender de F28.1, ADR 0020) | identity, api-gateway, web, flutter_app | Login sin contraseña y confirmación fuerte con passkey; con `WEBAUTHN_RP_ID` vacío responde `PASSKEYS_UNAVAILABLE` (Q-39) | L4 |
| F28.3 | Pinning en prod, detección root/jailbreak, FLAG_SECURE | flutter_app | Pruebas en dispositivos | L4 |
| F28.4 | Unseal productivo de OpenBao, rotaciones automáticas | security | Runbook ejecutado | L4 |
| F28.5 | Escaneos SAST/DAST (gosec, cargo-audit, ZAP) en CI y corrección | todos | Sin CRITICAL/HIGH abiertos | L5 |
| F28.6 | Pentest externo y remediación | todos | Informe archivado | L5 |
| F28.7 | Cumplimiento SBP/DGI/PCI SAQ A/Ley 81 (matriz de controles) | docs | Matriz completa con evidencia (Q-01, Q-04, Q-08) | L0 |
| F28.8 | SSO de Grafana y consolas internas con identity | observability, identity | Acceso solo PLATFORM_ADMIN | L4 |

## F29 — Carga, resiliencia y caos

- **Objetivo**: Demostrar la escala objetivo y la degradación documentada.
- **Entregable operable en producción**: Evidencia de 500 000 usuarios diarios con picos de 2 000 pagos/s y degradación según la matriz.
- **Contenedores**: todos
- **Depende de**: F27

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F29.1 | Escenarios k6 (login, pago wallet, venta POS, checkout, consultas) | scripts/load | Scripts versionados | L5 |
| F29.2 | Datos sintéticos a escala (1 M usuarios, 10 k comercios) | scripts/load | Generador reproducible | L5 |
| F29.3 | Pruebas de carga y ajuste (pools, índices, réplicas) | todos | SLOs de `observability-standards.md` §5 cumplidos | L5 |
| F29.4 | Caos: caída de cada contenedor según matriz de degradación | todos | Comportamiento = `service-dependencies.md` §6 | L5 |
| F29.5 | Fallos de red y latencia con toxiproxy/chaos-mesh en sagas | orders, payments-core | Sin dobles cobros ni stock perdido | L5 |
| F29.6 | Recuperación ante desastre: failover a nube DR | infra | RPO ≤ 5 min, RTO ≤ 1 h medidos | L5 |

## F30 — Lanzamiento a producción

- **Objetivo**: Operar con clientes reales de forma sostenida.
- **Entregable operable en producción**: PlentyPay en producción con soporte, runbooks, on-call y todas las capacidades del blueprint funcional activas o explícitamente pospuestas por regulación.
- **Contenedores**: todos
- **Depende de**: F25, F28, F29

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F30.1 | Runbooks completos (`delivery-pipeline.md` §9) y simulacro de incidentes | docs/runbooks | Simulacro documentado | L4 |
| F30.2 | On-call, escalamiento y canales de soporte (mesa de ayuda) | operación | Rotación definida | L0 |
| F30.3 | Credenciales reales de rieles y PAC (Q-02, Q-03, Q-11) y pruebas en vivo controladas | payments-core, fiscal-invoicing | Transacciones reales de bajo monto conciliadas | L5 |
| F30.4 | Piloto con comercios seleccionados y feature flags | todos | 2 semanas sin incidentes críticos | L5 |
| F30.5 | Migración/alta asistida de comercios y materiales de entrenamiento | operación | Guías publicadas | L0 |
| F30.6 | Apertura general y revisión post-lanzamiento | todos | SLO 99.9 % durante 28 días | L5 |

## Qué cubre el final de la Fase 30 (trazabilidad con el blueprint funcional)
| Pilar del blueprint (`00-PLENTYPAY-BLUEPRINT-FUNCIONAL.md`) | Fases |
|---|---|
| 3.1 Ventas y cobros (POS, offline, display, recibos) | F17, F22, F24 |
| 3.2 Pagos y billetera (QR, NFC, tarjetas, wallets, ledger, UNKNOWN) | F10, F11, F12, F23 |
| 3.3 Catálogo, multi-tienda y marketplace | F15, F16 |
| 3.4 Facturación DGI | F13 |
| 3.5 Inventario y reorden | F16 |
| 3.6 Logística y seguimiento público | F14, F18 |
| 3.7 Equipo, turnos y nómina (biometría, quiosco) | F19, F24 |
| 3.8 Créditos y lealtad | F17 (T8/T9) |
| 3.9 Inteligencia de negocio (anomalías, pronóstico, preguntas) | F21 |
| 3.10 Soporte y asistente (mensajería) | F20, F30 (mesa de ayuda); asistente conversacional: F21.8 base + backlog post-lanzamiento |
| 3.11 Administración, roles y seguridad | F05, F08, F28 |
| 5. App única multiplataforma | F02, F22–F25 |
| 6. Seguridad y confianza (PCI, biometría, inmutabilidad) | F05, F10, F28 |
| 7. Escala (500 000+ usuarios/día) | F27, F29 |
| 3.12 Citas y servicios programados | F31 |

## F31 — Citas y servicios programados (`scheduling`)

- **Objetivo**: Sistema completo de gestión de turnos, citas, reservas y disponibilidad para profesionales y negocios de servicios.
- **Entregable operable en producción**: Negocios de belleza, salud/clínicas y servicios profesionales configuran agendas, recursos, profesionales, reservas con confirmación y recordatorios automatizados.
- **Contenedores**: scheduling, api-gateway, notifications, flutter_app
- **Depende de**: F08 (identidad y alcance por sucursal), F15 (catálogo de servicios), F19 (empleados), F20 (notificaciones)

| Paso | Qué | Dónde | Criterio de aceptación | Nivel |
|---|---|---|---|---|
| F31.1 | Contrato proto y núcleo en memoria de citas (`scheduling.proto`) | scheduling | Pruebas de reglas de negocio R1–R6 (bloqueos, solapamiento, buffer time) | L1 |
| F31.2 | Persistencia PostgreSQL, migraciones y RLS por tenant/sucursal | scheduling | Pruebas de store con aislamiento multi-sucursal; RLS activo | L2 |
| F31.3 | Motor de disponibilidad y reglas de agenda (horarios de empleados, excepciones, descansos) | scheduling | Pruebas de cálculo de slots con feriados y solapamientos | L2 |
| F31.4 | Integración con notificaciones outbox (confirmación de cita, recordatorio 24h/2h) | scheduling, notifications | Eventos outbox `pp.scheduling.appointment.*` publicados e idempotentes | L3 |
| F31.5 | Rutas HTTP/WebSocket en api-gateway con validación de capacidad `appointments.booking` | api-gateway | Endpoints de agenda protegidos por permisos y capacidades | L3 |
| F31.6 | Pantallas Flutter de agenda: calendario visual, reserva, check-in y configuración | flutter_app | Vistas adaptativas teléfono/tablet para agenda de citas con `gravital-experience-ui` | L4 |

