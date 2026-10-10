# AGENTS.md — Instrucciones para agentes de código (y personas)

Este repositorio **se gobierna por su documentación** (ADR 0010). Tu trabajo es implementar lo que los documentos ya decidieron, no re-decidirlo. Si un documento está mal o incompleto, **primero corriges el documento** (o propones un ADR) y después el código — en el mismo cambio.

## 1. Orden de lectura obligatorio antes de tocar código
1. `README.md` → `ARCHITECTURE.md` (estado real de cada contenedor).
2. `docs/roadmap/status.md` → qué fase está en curso y qué paso te toca. **No adelantes fases**: cada paso tiene precedencia en `05-HOJA-DE-RUTA-30-FASES.md` y `docs/roadmap/phase-matrix.md`.
3. El `SPEC.md` del contenedor que vas a tocar (y el `.proto` de su contrato en `network-contracts/proto/`).
4. Los estándares que aplican: `docs/standards/` (siempre: `grpc-conventions.md`, `data-standards.md`, `security-standards.md`, `testing-strategy.md`; por lenguaje: `go-standards.md` | `rust-standards.md` | `flutter-standards.md`).
5. `docs/domain/domain-model.md` si tocas dinero, estados o permisos. Sus vectores de prueba son obligatorios.
6. Para pantallas: `docs/ux/screen-catalog.md` y `docs/design-system.md`.

## 2. Reglas inviolables (un PR que rompa una se rechaza)
1. **Tres tecnologías**: Rust, Go, Flutter/Dart (ADR 0001). Nada de TypeScript/Node/Python/Java en código desplegable. (Herramientas de desarrollo/prueba fuera de la ruta de producción — p. ej. `scripts/ledger-tests` con Node — están permitidas y marcadas como tales.)
2. **Una carpeta raíz = una unidad de despliegue**; nunca importes código de otra carpeta (ADR 0002/0016). Solo `network-contracts/` es compartida. `scripts/check-isolation.sh` debe pasar.
3. **Entre contenedores solo gRPC** contra un `.proto` (ADR 0003). **Flutter solo habla con `api-gateway` por HTTPS/JSON + WebSocket** (ADR 0015).
4. **Dinero = enteros en centavos**. Jamás `float`/`double` (ADR 0013). Redondeo y repartos según `domain-model.md` §4.
5. **Solo `ledger` escribe en el libro contable**; solo `payments-core` orquesta cobros; solo `notifications` envía mensajes; solo `security` guarda secretos de terceros.
6. **Contratos solo aditivos**: no renumeres ni reutilices campos de `.proto` (ADR 0004). Tras editar un `.proto`: `./scripts/sync-protos.sh` y commitear lo generado.
7. **Tenant y actor salen de los metadatos del contexto, nunca del cuerpo** (ADR 0011, 0014). Todo query filtra por tenant; RLS como segunda barrera.
8. **Mutaciones reintentables llevan `idempotency_key`** con la semántica de `grpc-conventions.md` §3.
9. **Eventos solo por outbox** (ADR 0012); consumidores idempotentes.
10. **Ningún secreto** en código, imágenes, logs ni commits. `.env` nunca se commitea.
11. **No inventes resultados**: si no pudiste ejecutar una verificación (falta herramienta, red, credenciales), dilo explícitamente en el README del contenedor y en `docs/roadmap/status.md`. Nunca marques ✅ algo no ejecutado.
12. **Nunca simules dinero real**: los adaptadores de rieles sin credenciales responden en modo `sandbox:true` y la UI lo muestra.

## 3. Ciclo de trabajo por paso del roadmap
1. Toma **un** paso (`F<nn>.<m>`) de `docs/roadmap/status.md` cuyo predecesor esté cerrado.
2. Lee su criterio de aceptación en `05-HOJA-DE-RUTA-30-FASES.md` y las reglas (`R<n>`) del SPEC que implementa.
3. Si el paso necesita un cambio de contrato, de datos o una decisión no cubierta → actualiza `.proto`/SPEC/ADR **primero**.
4. Implementa siguiendo la estructura de carpetas del estándar del lenguaje. Pruebas **antes o junto** al código; una prueba por regla, con el id en el nombre (`TestR4_...`, `r4_...`, `test('R4 ...')`).
5. Ejecuta localmente el nivel de verificación que exige el paso (L0–L4, `testing-strategy.md` §1) y **pega la salida** en el PR.
6. Actualiza en el mismo cambio: `SPEC.md` (si cambió algo), `README.md` del contenedor (estado), `docs/roadmap/status.md` (paso → hecho, con nivel y evidencia), `ARCHITECTURE.md` §2 si cambió el estado del contenedor.
7. Corre `./scripts/check-isolation.sh && ./scripts/check-docs.sh && ./scripts/sync-protos.sh --check`.
8. Commit con Conventional Commits y el contenedor como scope: `feat(ledger): reject unbalanced entries (F10.3, R1)`.

## 4. Cómo crear un contenedor nuevo
Copia `docs/templates/SPEC-TEMPLATE.md` → `<contenedor>/SPEC.md` y `docs/templates/CONTAINER-README-TEMPLATE.md` → `<contenedor>/README.md`; registra el contenedor en `docs/architecture/service-dependencies.md`, `network-contracts/consumers.txt`, `docker-compose.yml`, `ARCHITECTURE.md` §2 y escribe un ADR que justifique su existencia (como ADR 0017 hizo con `orders`).
La estructura interna sigue `go-standards.md` §2 o `rust-standards.md` §3 al pie de la letra.

## 5. Comandos
| Para | Comando |
|---|---|
| Verificar aislamiento | `./scripts/check-isolation.sh` |
| Verificar documentación (enlaces, SPEC/README por contenedor, ADR índice) | `./scripts/check-docs.sh` |
| Regenerar / verificar contratos | `./scripts/sync-protos.sh` / `--check` |
| Pruebas Go de un contenedor | `cd <c> && go test -race ./...` |
| Pruebas Rust | `cd <c> && cargo test` |
| Flutter | `cd flutter_app && flutter analyze && flutter test` |
| E2E identity↔gateway | `./scripts/e2e-identity-gateway.sh` |
| Invariantes del ledger (especificación de referencia) | `cd scripts/ledger-tests && npm install && npm test` |
| Sistema local | `docker compose up --build` |

## 6. Convenciones de lenguaje
Documentación, comentarios y mensajes al usuario: **español** (UI con i18n `es_PA`/`en`). Identificadores, nombres de pruebas, commits, nombres de métricas y `reason` de errores: **inglés**.

## 7. Cuándo detenerte y preguntar (no adivines)
- Cualquier cosa de `docs/open-questions.md` marcada **BLOQUEANTE** para tu paso (p. ej. credenciales reales de un riel, especificación privada de un proveedor, tratamiento fiscal).
- Un cambio que rompería una regla de §2 o un contrato publicado.
- Una ambigüedad entre dos documentos: señálala, propone cuál prevalece (el ADR más reciente prevalece sobre documentos de la serie 00–04; el SPEC prevalece sobre el README del contenedor) y regístrala en `open-questions.md`.
