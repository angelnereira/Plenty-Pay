# PlentyPay — Arquitectura de Contenedores, SOLID y Distribución Tecnológica

> **Documento de contexto (serie 00–04).** Recoge el análisis y el razonamiento previos a las decisiones vigentes. Donde contradiga un ADR (`docs/adr/`), `docs/domain/domain-model.md`, `docs/standards/` o un `SPEC.md`, **prevalecen esos** (ADR 0010). En particular: el stack definitivo es solo Rust + Go + Flutter (ADR 0001) — cualquier mención a TypeScript/Next.js/Prisma aquí es histórica.

> Continúa de los documentos 02 y 03. Este documento responde una pregunta
> específica: **de los ~10 a 20 contenedores que compondrán PlentyPay, cuál
> es la responsabilidad de cada uno, en qué lenguaje/tecnología conviene
> escribirlo, y por qué** — de forma que el conjunto sea modular, agnóstico
> de proveedor, y evolucione de Docker Compose a Kubernetes sin fricción.

## 1. El principio rector: SOLID aplicado a contenedores, no solo a clases

En una aplicación monolítica, SOLID se aplica dentro de una clase o un
módulo. Aquí se aplica un nivel arriba: **la unidad que tiene una
responsabilidad, que se puede sustituir, y que expone una interfaz mínima ya
no es una clase — es un contenedor.**

| Principio | Qué significa a nivel de contenedor | Cómo se ve en PlentyPay |
|---|---|---|
| **S — Responsabilidad única** | Un contenedor tiene exactamente un motivo para cambiar, y solo uno. | `ledger-service` cambia si cambia la lógica contable. Nunca cambia porque Yappy modificó su API. |
| **O — Abierto/cerrado** | Se extiende el sistema agregando un contenedor nuevo, no modificando uno existente. | Agregar Nequi como riel de pago = desplegar `rail-adapter-nequi` nuevo. Cero cambios en `payments-orchestrator`. |
| **L — Sustitución de Liskov** | Cualquier contenedor que implemente un contrato es intercambiable donde ese contrato se espera. | Los cinco `rail-adapter-*` son intercambiables entre sí desde el punto de vista de `payments-orchestrator`: todos hablan el mismo contrato gRPC. |
| **I — Segregación de interfaces** | Un contenedor expone solo lo que sus consumidores necesitan — nunca una interfaz "todo incluido". | `identity-service` expone autenticación y permisos; no expone ni una sola operación de catálogo o inventario. |
| **D — Inversión de dependencias** | Los contenedores dependen de contratos (proto/gRPC) abstractos, nunca de la implementación concreta de otro contenedor. | `bff-gateway` depende de "un servicio que resuelve intenciones de pago" (la definición `.proto`), no de que ese servicio esté escrito en Rust, Go o lo que sea. |

La consecuencia práctica más importante de esto: **el lenguaje de
programación de cada contenedor es un detalle de implementación, invisible
para el resto del sistema.** Eso es lo que permite construir con Rust, Go y
TypeScript en el mismo sistema sin que sea una arquitectura "mixta y
frágil" — es exactamente lo que hace posible reemplazar, escalar o migrar
un contenedor sin tocar los demás.

## 2. Inventario de contenedores (objetivo: ~18, pequeños)

Organizados por capa. **"Hoy" es el estado real de este repositorio;
"Objetivo" es hacia dónde apunta esta arquitectura** — no es necesario llegar
ahí de un salto; es la referencia para decidir el próximo contenedor a
extraer cuando haga falta.

### Capa de borde

| # | Contenedor | Responsabilidad única | Tecnología | Hoy |
|---|---|---|---|---|
| 1 | `edge-proxy` | Terminación TLS, ruteo, traducción gRPC-Web para el cliente Flutter Web | Envoy (infraestructura, no código propio) | Pendiente (documento 02 §5) |
| 2 | `bff-gateway` | Agrega/orquesta llamadas para el cliente Flutter en menos viajes de red; valida el token de sesión antes de reenviar la llamada | **Go** | Pendiente — hoy Flutter llama directo a las rutas del monolito |

### Identidad

| # | Contenedor | Responsabilidad única | Tecnología | Hoy |
|---|---|---|---|---|
| 3 | `identity-service` | Autenticación, emisión de JWT/sesión, WebAuthn/passkeys, verificación de permisos | **Go** | Vive dentro del monolito (NextAuth) |

### Payment Core y Ledger — el núcleo crítico

| # | Contenedor | Responsabilidad única | Tecnología | Hoy |
|---|---|---|---|---|
| 4 | `payments-orchestrator` | `PaymentIntent` → `Payment` → `PaymentAttempt`; idempotencia; nunca toca el ledger directo | **Rust + sqlx** (hoy: TypeScript — ver §7) | ✅ Construido en TypeScript |
| 5 | `ledger-service` | Doble entrada contable (`LedgerAccount`/`Transaction`/`Entry`), invariantes DEBIT=CREDIT, inmutabilidad | **Rust + sqlx** (hoy: TypeScript — ver §7) | ✅ Construido en TypeScript |
| 6 | `settlement-service` | Lotes de liquidación a comercios, reconciliación programada | **Go** | Pendiente |
| 7 | `wallet-cache-service` | Saldo de lectura rápida (disponible/retenido) — cachea al ledger, nunca es la fuente de verdad | Puede vivir dentro de `ledger-service` hasta que el volumen de lecturas lo justifique como contenedor propio | ✅ (dentro de `ledger-service`) |

### Adaptadores de riel de pago — uno por integración externa

| # | Contenedor | Tecnología |
|---|---|---|
| 8 | `rail-adapter-yappy` | **Go** |
| 9 | `rail-adapter-telered` | **Go** |
| 10 | `rail-adapter-cardnetwork` (PSP tarjetas/Apple Pay/Google Pay) | **Go** |

Cada uno es deliberadamente diminuto: implementa un solo contrato (crear
cobro, confirmar, reembolsar, verificar webhook) contra una sola API externa.
Agregar Nequi o Kuara después es un contenedor #11, #12 — nunca una
modificación a los que ya existen. Hoy viven como tres clases dentro de
`payments-orchestrator` (ver documento 03 §4) — separarlas en contenedores
propios es la extracción más simple y de mayor valor cuando llegue el
momento, precisamente porque el contrato ya existe y ya se respeta.

### Comercio

| # | Contenedor | Responsabilidad única | Tecnología | Hoy |
|---|---|---|---|---|
| 11 | `catalog-service` | Catálogo por comercio + listados de marketplace + búsqueda | **Go + sqlc** | Vive en el monolito |
| 12 | `inventory-service` | Existencias, lotes, reorder point, órdenes de compra | **Go + sqlc** | Vive en el monolito |
| 13 | `invoicing-fiscal-service` | Integración HKA/DGI, XMLDSig, folios | **TypeScript** (no reescribir — ver §7) | ✅ Construido |
| 14 | `pos-service` | Sesiones de caja, carritos, checkout offline-first | **TypeScript** | Vive en el monolito |
| 15 | `logistics-service` | Asignación de entregas, tracking en tiempo real, escaneo por checkpoint | **Go** | Vive en el monolito |
| 16 | `payroll-attendance-service` | Turnos, marcaje biométrico, nómina | **TypeScript** (integración de reconocimiento facial ya construida) | Vive en el monolito |

### Plataforma / transversal

| # | Contenedor | Responsabilidad única | Tecnología | Hoy |
|---|---|---|---|---|
| 17 | `notification-service` | Envío de correo (Resend), push, WhatsApp/Jelou — un solo punto de salida para toda notificación | **Go** | Vive en el monolito |
| 18 | `bi-analytics-service` | Agregaciones programadas, alertas, forecasting | **Go**, o SQL programado directo en PostgreSQL (vistas materializadas) | Vive en el monolito |
| — | `mcp-server` | Adaptador de protocolo MCP → gRPC/REST | **TypeScript** | ✅ Construido |
| — | `support-assistant-service` | Asistente conversacional (integración con IA generativa) | **TypeScript** | Vive en el monolito |
| — | `commerce-core` (monolito de transición) | Todo lo de arriba que aún no se extrajo, como un único contenedor cohesivo | **TypeScript** | ✅ Construido — es `web/` |

Ese último renglón importa tanto como los demás: **el monolito contenerizado
es, en sí mismo, un contenedor válido dentro de esta arquitectura** — no es
"deuda técnica temporal" en el sentido peyorativo, es la aplicación honesta
del principio de Responsabilidad Única a un ritmo de extracción realista
(documento 02 §3, patrón *strangler fig*). El número final de contenedores
importa menos que el hecho de que cada uno, cuando exista, tenga un límite
claro.

## 3. Cómo se reparte la tecnología, y por qué

| Tecnología | Dónde vive | Por qué ahí y no en otro lado |
|---|---|---|
| **Rust + sqlx** | `payments-orchestrator`, `ledger-service` | Son los dos contenedores donde un error de tipos o una consulta SQL mal escrita mueve dinero real. `sqlx` verifica cada consulta contra el esquema real **en tiempo de compilación** — una columna que no existe, o un tipo que no coincide, es un error de compilación, no un bug en producción a las 2 a.m. Rust, sin recolector de basura, da latencia predecible bajo carga — importante cuando cientos de miles de cobros pasan por el mismo camino. |
| **Go** | Gateway, identidad, adaptadores de riel, catálogo/inventario, logística, notificaciones, BI | Es el "tejido conectivo" de la plataforma: servicios de red con alta concurrencia (goroutines manejan miles de conexiones simultáneas sin el costo de un hilo por conexión), compilan a un binario único sin dependencias, arrancan en milisegundos — ideal para contenedores pequeños que escalan por réplica. Es también, con diferencia, el lenguaje con el soporte de gRPC más maduro fuera de TypeScript. |
| **sqlc** (el "sqlx de Go") | Los servicios Go que hablan con PostgreSQL (`catalog-service`, `inventory-service`) | Mismo principio que `sqlx`: genera código Go type-safe a partir de SQL real, verificado contra el esquema — nunca una consulta con nombre de columna mal escrito descubierta en producción. |
| **TypeScript + Prisma (ORM)** | `commerce-core` (facturación/DGI, POS, payroll, soporte), `mcp-server` | Son los módulos con más lógica de negocio, más cambios de producto por semana, y menos sensibilidad a microsegundos de latencia — exactamente donde la productividad de un ORM completo (migraciones, tipos generados, relaciones) vale más que el control de bajo nivel de `sqlx`/`sqlc`. La integración HKA/DGI, en particular, ya está construida, certificada y funcionando: reescribirla en otro lenguaje sin una razón de rendimiento real sería puro riesgo sin beneficio. |
| **gRPC** | Contrato de comunicación entre TODOS los contenedores anteriores | Es lo que hace posible mezclar Rust, Go y TypeScript sin que sea un problema: cada lenguaje tiene una implementación gRPC madura, y el contrato (`.proto`) es el mismo sin importar quién lo implemente. |
| **PostgreSQL** | Almacén de datos de todos los servicios | Un único motor de base de datos, con esquemas separados por servicio a medida que se extraen (documento 02 §6) — nunca una base de datos distinta por lenguaje; eso rompería la trazabilidad que pide la sección 5. |
| **Flutter** | La única capa de cliente — Android, iOS, Windows, macOS | Ya definido en el documento 02 ("Modelo de arquitectura"): un código fuente, cuatro binarios instalables. |
| **Resend** | Invocado desde `notification-service` (o, hoy, desde `commerce-core`) | Un solo punto de salida de correo — nunca cada servicio llamando a Resend por su cuenta, para que las plantillas, el remitente y los límites de envío se controlen en un solo lugar. |
| **Linux** | Imagen base de cada contenedor (Alpine para Go/TypeScript; `distroless`/`scratch` para binarios Rust, que no necesitan ni un intérprete) | Es la única capa de sistema operativo en todo el diseño — no hay contenedores Windows en el servidor (Windows como plataforma solo existe del lado del cliente Flutter, sección 2 del documento 02). |

## 4. Datos perfectamente conectados: trazabilidad y analítica a gran escala

Esto es distinto de la réplica de lectura que ya describe el documento 02
§6 (esa resuelve "más carga de lectura"; esto resuelve "entender qué pasó,
a través de todos los servicios, sin tocar las bases de datos operativas").

**El principio**: ninguna consulta de analítica pesada debería correr jamás
contra la misma base de datos que procesa un cobro en este instante. La
forma moderna de resolver esto es *Change Data Capture* (CDC): cada cambio
en PostgreSQL (un `INSERT` en `ledger_entries`, un `UPDATE` de estado en
`payments`) se captura automáticamente desde el registro de escritura de la
base (WAL) — sin que ningún servicio tenga que "avisar" explícitamente que
algo cambió, y sin una sola consulta extra contra la base operativa.

**Las piezas concretas (100% open source):**

1. **Debezium** (Apache 2.0) lee el WAL de cada base PostgreSQL y publica
   cada cambio como un evento — quién cambió qué, con qué valor anterior y
   nuevo, y cuándo. Es el estándar de facto para CDC sobre Postgres.
2. Esos eventos se publican a **Kafka** (Apache 2.0) — aquí, a propósito,
   no al NATS JetStream del documento 02 §6: NATS es la elección correcta
   para mensajería operativa liviana (webhooks, notificaciones), pero el
   camino de integración de Debezium mejor probado y documentado es Kafka,
   y la integración de Kafka con motores analíticos (siguiente punto) es
   igualmente madura. Son dos herramientas para dos trabajos distintos, no
   redundancia — aunque, si el equipo es pequeño, es totalmente razonable
   empezar sin CDC (con exportes programados simples) y posponer Kafka hasta
   que el volumen de datos lo justifique.
3. **ClickHouse** (Apache 2.0) recibe ese flujo y es donde de verdad se hacen
   las preguntas grandes ("¿cómo cambió el comportamiento de pago de los
   comercios de Colón en los últimos 6 meses?") — es un motor columnar
   diseñado exactamente para agregar miles de millones de filas en
   segundos, algo para lo que PostgreSQL (un motor de filas, optimizado para
   transacciones) no está pensado.
4. **Trazabilidad**: como cada evento CDC lleva el cambio exacto y su
   momento, el historial completo de "qué pasó con este pago, en qué orden,
   modificado por quién" queda reconstruible sin depender de que cada
   servicio recuerde loguearlo por su cuenta — es trazabilidad **por
   diseño de la infraestructura**, no por disciplina de cada desarrollador.

Esta pieza es la de mayor esfuerzo operativo de todo el documento — es
razonable posponerla hasta que el volumen de datos real lo justifique, pero
el diseño de arriba (esquemas separados por servicio, IDs consistentes,
eventos con marca de tiempo) hay que respetarlo desde el primer contenedor
para que, cuando llegue el momento, conectar el CDC sea instalar Debezium,
no rediseñar el esquema.

## 5. El camino: Docker Compose hoy → Kubernetes a mediano/largo plazo

No son dos arquitecturas distintas — son el mismo diseño de contenedores en
dos orquestadores distintos. La tabla siguiente es la equivalencia exacta
(y ya está construida en este repo, en `infra/k8s/` y `docker-compose.yml`):

| Concepto | Docker Compose (hoy) | Kubernetes (mediano/largo plazo) |
|---|---|---|
| Unidad desplegable | `service:` en `docker-compose.yml` | `Deployment` |
| Réplicas para mantenimiento sin caída | `docker compose up --scale servicio=3` (manual) | `HorizontalPodAutoscaler` (automático, por CPU/carga) |
| Descubrimiento entre contenedores | Nombre del servicio como hostname (red interna de Compose) | `Service` de Kubernetes (mismo principio, DNS interno) |
| Actualizar sin caída | Recrear el contenedor (con réplicas, hay una ventana breve) | *Rolling update* nativo: Kubernetes espera a que la réplica nueva esté sana antes de apagar la vieja — cero caída real |
| Almacenamiento persistente | Volumen de Docker | `PersistentVolumeClaim` |
| Configuración/secretos | Archivo `.env` | `ConfigMap` / `Secret` |
| Migrar de proveedor | Copiar `docker-compose.yml` + `.env` a la nueva máquina | Cambiar el `kubeconfig` al nuevo clúster — las mismas imágenes, los mismos manifiestos `infra/k8s/*.yaml` |

**Por qué esto no ata a ningún proveedor**: cada contenedor es una imagen
Docker corriente, publicada a un registro (Harbor, self-hosted, o cualquier
registro compatible con OCI) y cada pieza de infraestructura (documento 02)
es OpenTofu — sin un solo servicio propietario de un proveedor específico en
el camino crítico. Migrar de un proveedor cloud a otro, o a un servidor
propio, es un ejercicio de "aplicar los mismos manifiestos contra un clúster
distinto", no una reescritura.

## 6. Cómo esto se conecta con lo que ya existe (honestidad)

Todo lo marcado "Hoy: ✅ Construido" en la sección 2 está en TypeScript, no
en Rust — porque en el momento de construirlo, la prioridad era tener el
Payment Core y el Ledger funcionando y verificados de punta a punta (ver
`MIGRATION_STATUS.md`: el ledger se probó contra PostgreSQL real). Este
documento describe el **destino**, no exige reescribir eso primero. La
migración a Rust de `payments-orchestrator` y `ledger-service` es exactamente
el tipo de extracción que esta arquitectura hace segura: como ambos ya
hablan gRPC hacia afuera, reescribir su interior en Rust es reemplazar el
contenedor sin que `bff-gateway`, `commerce-core` ni el cliente Flutter se
enteren — es la prueba de que el diseño funciona, no un paso pendiente que
lo invalide.
