# Decisiones de Arquitectura (ADR)Formato corto: Contexto → Decisión → Consecuencias. Los cambios de decisión se agregan como ADRs nuevos, nunca editando silenciosamente el anterior (§24).

## ADR-0001 — Lenguajes de aplicación y origen del código

- **Contexto**: mandato §2 permite solo Flutter/Dart, Rust, Go y prohíbe TypeScript/JS/etc. Los docs 01/04 describen un sistema de origen en TypeScript (Next.js/Prisma) y afirman que `payments-orchestrator`, `ledger-service`, `commerce-core (web/)`, `mcp-server` están "✅ Construido en TypeScript… en este repo". Verificación filesystem: **no existe ningún código en este repo**.
- **Decisión**: no hay código que migrar; se construye desde cero directamente en el stack destino que el propio doc 04 §7 declara (Rust para `payments`/`ledger`, Go para el resto). El monolito TS de transición no se implementa (no existe). El sistema de origen es documentación de referencia, no código fuente. Lenguaje prohibido = cualquier TS/JS/Python/Java/Kotlin/Swift/C#/PHP/Ruby en el árbol de código de la aplicación.
- **Consecuencias**: doc 04 se corrige con banner; `mcp-server` queda fuera del alcance actual (documentar si se requiere más adelante); la "duplicación" TS→Rust que el doc anticipaba desaparece del plan.

## ADR-0002 — Representación del dinero y moneda

- **Contexto**: doc 03 §10.5 cuestiona el default `PAB` (economía panameña opera en USD); mandato §12 exige exactitud monetaria.
- **Decisión**: dinero = entero de unidades menores (`i64`/`BIGINT` centavos) **más código ISO-4217 explícito** en cada cuenta y cada transacción. Nada de `float`/`double`. Sin default implícito: el cliente siempre declara moneda. Soporte v1: `USD` y `PAB` (paridad 1:1 — par legal desde 1941; conversión cruzada 1:1 sin spread). Otras monedas: requiere justificación y fuente de tipos → no implementadas.
- **Consecuencias**: contratos proto usan `common.v1.Money`; BD usa `BIGINT` + `currency CHAR(3)`; sumas con aritmética checked (Rust) / int64 (Go); Dart usa `int` de 64 bits (VM nativo; **no** se compila target Web, donde int de JS rompería esto — coherente con prohibición de frontend web).

## ADR-0003 — Targets Flutter (resolución C-1)

- **Contexto**: docs 00/02/04 declaran Android/iPhone/Windows/macOS. Mandato §2/§6 declara Android/iOS/Windows/Linux.
- **Decisión**: mandato gana: **Android, iOS, Windows, Linux**. macOS queda diferido (no eliminado: misma base compila; se activará cuando exista host/toolchain y se actualizará este ADR y el doc 00 §5).
- **Consecuencias**: doc 00 §5 se anota con banner; matriz de builds por CI con runners nativos; limitación local arm64 documentada en docs/00 §3.

## ADR-0004 — Correlación y trazabilidad transversal

- **Decisión**: metadata gRPC con estándares W3C: `traceparent`/`tracestate` (tracing), `x-correlation-id` (unidad de negocio, persistida en logs y ledger), `x-request-id` (idempotencia de red/reintento). Cada servicio loguea JSON estructurado con los tres IDs. El gateway valida/inyecta `x-correlation-id`.
- **Consecuencias**: `common.proto` no duplica contexto en mensajes; los IDs viajan en metadata (estándar de facto gRPC/OTel).

## ADR-0005 — Contratos autocontenidos (sin imports remotos)

- **Contexto**: §4 exige autocontención; `googleapis` externo acoplaría lint/build a la red.
- **Decisión**: `contracts/proto` no importa nada externo excepto well-known types de protobuf (incluidos por el propio toolchain). Health checks propios (`common.v1`), no `grpc.health.v1` de googleapis por ahora.
- **Consecuencias**: `buf lint/generate` funciona offline; migración futura a `grpc.health.v1` es aditiva.

## ADR-0006 — Servicio `wallet`: quién lo implementa

- **Contexto**: mandato §5 no lista `wallet` como servicio; docs 03 §10 definen Wallet como saldos (available/held/pending).
- **Decisión**: `wallet.proto` lo implementa **`payments`** (Rust), apoyado en `ledger` (holds). No se crea un microservicio wallet separado hasta que el volumen/la separación lo justifique (§33: límites + contratos, no cantidad de contenedores).
- **Consecuencias**: `services/payments` expone `plentypay.wallet.v1.WalletService` + `plentypay.payments.v1.PaymentOrchestratorService`.

## ADR-0007 — Contenedor `web-public`: solo superficies públicas (ratificado por el dueño)

- **Contexto**: la instrucción del dueño pide un contenedor "Web"; el mandato §2 prohíbe frontends web; el doc 00 §3.6 exige tracking público vía enlace sin cuenta. Decisión del dueño (2026-10-01): web solo para superficies públicas.
- **Decisión**: existe un contenedor `web-public` (Go) que sirve **únicamente** páginas públicas sin sesión: tracking QR de logística, landing informativa, marketplace público de solo-lectura. Sin TypeScript/React/Vue; SSR o HTML estático servido por Go; sin lógica financiera; toda operación requiere la app nativa.
- **Consecuencias**: Flutter Web queda descartado (coherente con ADR-0002: `int` de Dart no es seguro en JS); el contenedor es eliminable/reemplazable sin tocar el resto (§4).

## ADR-0008 — NoSQL: diferido hasta justificación real (ratificado por el dueño)

- **Contexto**: la instrucción del dueño lista un contenedor NoSQL; mandato §18 exige justificación documentada.
- **Decisión**: no se crea contenedor NoSQL en Etapas 1-3. Valkey cubre cache/sesiones/colas y PostgreSQL JSONB cubre documentos. Si aparece un caso real (ej. eventos de alta escritura), ADR nuevo con benchmark y caso concreto.
- **Consecuencias**: el inventario de contenedores de la instrucción inicial queda "los que apliquen estratégicamente" (§33).

## ADR-0009 — IaC: HCL compatible Terraform/OpenTofu, binario OpenTofu (ratificado por el dueño)

- **Contexto**: el dueño menciona Terraform; la doctrina 100% OSS (doc 02 §1) evita licencias BSL (Terraform desde 2023).
- **Decisión**: módulos HCL escritos compatibles con ambos CLIs; el binario por defecto es **OpenTofu** (MPL 2.0, Linux Foundation). Terraform CLI sigue usable con los mismos archivos.
- **Consecuencias**: portabilidad sin renuncia OSS; `infrastructure/` se implementa en Etapa 5 (hoy Compose).

## ADR-0010 — Acceso a datos: sin ORM único multi-lenguaje (decisión por servicio)

- **Contexto**: el dueño pide "un ORM compatible con Rust, Go y Flutter". Verificado (2026-10-01, §28): **no existe un producto ORM maduro para los tres lenguajes**. El intento más cercano en Dart (Prisma Client Dart) está **suspendido por su propio mantenedor** ("Development of Prisma Dart Client has been suspended", aviso oficial en pub.dev/orm). Forzar un único ORM implicaría una tecnología inexistente o no mantenida — prohibido.
- **Decisión** (la robustez se logra por disciplina por lenguaje, no por un único producto):
  - **Rust (dinero: `ledger`, `payments`)**: **sqlx** — SQL verificado contra el esquema real en tiempo de compilación; sin magia en el camino crítico (doc 04 §3 ya lo designaba). SeaORM queda descartado para el camino del dinero (ORM de alto nivel con implícitos).
  - **Go (servicios de red)**: **sqlc** — codegen type-safe desde SQL real (doc 04 §3 ya lo designaba). GORM descartado para servicios financieros/de red por reflexión e implícitos (§21).
  - **Flutter (cliente)**: **NUNCA** toca la base de datos del servidor (violación de límites §3/§13; credenciales embebidas prohibidas). El "acceso a datos" del cliente son los contratos gRPC generados. Para el modo offline-first del POS (doc 00 §3.1) se usará **SQLite + Drift** como almacén LOCAL del dispositivo (carrito/reservas offline), sincronizado vía gRPC al reconectar.
  - **NoSQL**: diferido (ADR-0008).
- **Consecuencias**: cada servicio usa la herramienta type-safe de su lenguaje; la coherencia entre servicios la dan los contratos y el esquema por servicio (§18). Versiones se fijan (pin) al implementar cada servicio, sin números inventados.
