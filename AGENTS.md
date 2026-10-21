# AGENTS.md — Instrucciones para agentes de código (y personas)

Este repositorio **se gobierna por su documentación** (ADR 0010). Tu trabajo es implementar lo que los documentos ya decidieron, no re-decidirlo. Si un documento está mal o incompleto, **primero corriges el documento** (o propones un ADR) y después el código — en el mismo cambio.

## 1. Orden de lectura obligatorio antes de tocar código
1. `README.md` → `ARCHITECTURE.md` (estado real de cada contenedor).
2. `docs/roadmap/status.md` → qué fase está en curso y qué paso te toca. **No adelantes fases**: cada paso tiene precedencia en `05-HOJA-DE-RUTA-30-FASES.md` y `docs/roadmap/phase-matrix.md`.
3. El `SPEC.md` del contenedor que vas a tocar (y el `.proto` de su contrato en `network-contracts/proto/`). En su sección 5, la línea **Cumplimiento normativo** lista las reglas `N-…` que ese contenedor debe implementar.
4. Los estándares que aplican: `docs/standards/` (siempre: `grpc-conventions.md`, `data-standards.md`, `security-standards.md`, `testing-strategy.md`, `observability-standards.md`; por lenguaje: `go-standards.md` | `rust-standards.md` | `flutter-standards.md`).
5. `docs/glossary.md` antes de nombrar cualquier cosa (campo, estado, `reason`, variable, subject, atributo de telemetría): si el nombre existe, se usa tal cual. `docs/domain/domain-model.md` si tocas dinero, estados o permisos. Sus vectores de prueba son obligatorios.
6. Para pantallas e interfaces Flutter: `docs/gravital-experience-ui.md` (**regla de diseño estricta** `gravital-experience-ui` para todas las interfaces previas y futuras), `docs/ux/screen-catalog.md`, la ficha de la pantalla en `docs/ux/functional-spec/README.md` (y el archivo de su módulo) y `docs/design-system.md`.
7. `docs/compliance/regulatory-framework.md` (normas de Panamá) y `docs/compliance/international-standards.md` (estándares internacionales) si tocas impuestos, nómina, identidad, datos personales, descuentos, pagos, formatos de fecha, moneda, unidades, códigos de producto o documentos legales: las reglas `N-…` de tu contenedor son obligatorias.
8. `docs/standards/observability-standards.md` §9–§16 **siempre**: todo código nuevo registra sus fallos de modo que se sepa qué, dónde, cómo, cuándo y por qué falló.

**Precedencia si dos documentos se contradicen**: ADR → `domain-model.md` → marco normativo (`docs/compliance/`) → `SPEC.md` del contenedor → especificación funcional (`docs/ux/functional-spec/`) → `gravital-experience-ui.md` → `screen-catalog.md` → README del contenedor → serie `00`–`04`. El glosario no redefine reglas: si difiere de su fuente, manda la fuente.

## 2. Reglas inviolables (un PR que rompa una se rechaza)
1. **Tres tecnologías**: Rust, Go, Flutter/Dart (ADR 0001). Nada de TypeScript/Node/Python/Java en código desplegable. (Herramientas de desarrollo/prueba fuera de la ruta de producción — p. ej. `scripts/ledger-tests` con Node — están permitidas y marcadas como tales.)
2. **Una carpeta raíz = una unidad de despliegue**; nunca importes código de otra carpeta (ADR 0002/0016). Solo `network-contracts/` es compartida. `scripts/check-isolation.sh` debe pasar.
3. **Entre contenedores solo gRPC** contra un `.proto` (ADR 0003). **Flutter solo habla con `api-gateway` por HTTPS/JSON + WebSocket** (ADR 0015).
4. **Dinero = enteros en centavos**. Jamás `float`/`double` (ADR 0013). Redondeo y repartos según `domain-model.md` §4. El número de decimales de una moneda sale de la tabla ISO 4217, no se asume (N-STD-02).
5. **Solo `ledger` escribe en el libro contable**; solo `payments-core` orquesta cobros; solo `notifications` envía mensajes; solo `security` guarda secretos de terceros.
6. **Contratos solo aditivos**: no renumeres ni reutilices campos de `.proto` (ADR 0004). Tras editar un `.proto`: `./scripts/sync-protos.sh` y commitear lo generado.
7. **Tenant y actor salen de los metadatos del contexto, nunca del cuerpo** (ADR 0011, 0014). Todo query filtra por tenant; RLS como segunda barrera.
8. **Mutaciones reintentables llevan `idempotency_key`** con la semántica de `grpc-conventions.md` §3.
9. **Eventos solo por outbox** (ADR 0012); consumidores idempotentes.
10. **Ningún secreto** en código, imágenes, logs ni commits. `.env` nunca se commitea.
11. **No inventes resultados**: si no pudiste ejecutar una verificación (falta herramienta, red, credenciales), dilo explícitamente en el README del contenedor y en `docs/roadmap/status.md`. Nunca marques ✅ algo no ejecutado.
12. **Nunca simules dinero real**: los adaptadores de rieles sin credenciales responden en modo `sandbox:true` y la UI lo muestra.
13. **Ningún valor legal en código.** Tasas, topes, plazos y porcentajes fijados por una norma (ITBMS, cuotas de la CSS, recargos de horas extra, tramos de ISR, límites de billetera, descuentos de ley, plazos de retención) se leen de los parámetros `legal.pa.*` de infra-management, con el valor **vigente en la fecha del hecho** (fecha de la venta, período de nómina), no en la fecha de ejecución. Una constante legal en el código es un defecto aunque el valor sea correcto hoy.
14. **Ningún fallo se descarta ni se registra a medias.** Prohibido ignorar un error (`_ = err`, `catch` vacío, `unwrap()` fuera de pruebas). El error se envuelve con la operación que se intentaba al subir de capa y **se registra una sola vez, en el borde** (interceptor, middleware, bucle del consumidor o del job, manejador global de la app). Prohibido `log.Printf`, `fmt.Println`, `println!`, `print` y `debugPrint`: solo el logger estructurado del contenedor.
15. **El detalle de un fallo nunca llega al cliente.** Un defecto responde `INTERNAL` genérico con `request_id`; la pila, el mensaje interno y la causa van solo a la telemetría. El usuario ve el mensaje traducido de un `reason` y el código de soporte.
16. **Nada sensible en la telemetría**: ni tokens, ni contraseñas, ni datos de tarjeta, ni documentos completos, ni cuerpos de petición, ni plantillas biométricas, ni correos sin enmascarar. Aplica a logs, trazas, métricas, migas de la app y mensajes de excepción de librerías.
17. **PlentyPay nunca ve datos de tarjeta.** Ni un campo, ni un log, ni una variable con número de tarjeta, código de seguridad o PIN. La captura es del proveedor de pagos, por redirección o componente nativo (N-STD-28, N-STD-29).
18. **Una pantalla solo contiene lo que dice su ficha.** Un campo, botón o texto que no esté en `docs/ux/functional-spec/` no se agrega sin actualizar primero la ficha; cada formulario pide el mínimo de datos (N-DAT-12). **Ninguna fecha se muestra solo con números**: el mes va en texto (N-STD-10).
19. **Regla de diseño estricta Flutter (`gravital-experience-ui`).** Toda interfaz Flutter previa y futura debe construirse y diseñarse cumpliendo estrictamente `docs/gravital-experience-ui.md` (sistema `gravital-experience-ui` basado en M3 Expressive: cero valores literales fuera de tokens/roles, un único botón `filled` por pantalla, jerarquía por tono `surfaceContainer*`, movimiento físico por resortes, diseño adaptativo por `WindowClass` borde a borde, accesibilidad WCAG 2.2 AA con texto al 200 % y el checklist obligatorio de `docs/gravital-experience-ui.md` §15.3).
20. **Atribución obligatoria a Claude en GitHub.** Todo lo que se publica en GitHub con participación de Claude lo declara, sin excepción:
   - cada **commit** termina con la línea `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>` (p. ej. `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), separada del cuerpo por una línea en blanco;
   - cada **pull request** termina su descripción con `🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
   - cada **release** lleva la misma línea al final de sus notas (`scripts/publish-release.sh` la agrega si falta);
   - los comentarios, issues y revisiones que Claude escribe en GitHub terminan igual.

   Un commit de Claude sin la línea `Co-Authored-By` se corrige antes del push (`git commit --amend` si aún no se publicó); nunca se reescribe historia ya publicada para agregarla.

## 3. Ciclo de trabajo por paso del roadmap
1. Toma **un** paso (`F<nn>.<m>`) de `docs/roadmap/status.md` cuyo predecesor esté cerrado.
2. Lee su criterio de aceptación en `05-HOJA-DE-RUTA-30-FASES.md`, las reglas (`R<n>`) del SPEC que implementa y las reglas normativas (`N-…`) que ese SPEC cita. Para una pantalla, lee su ficha `S-<módulo>-<nn>` y el comportamiento común `C-<nn>`.
3. Si el paso necesita un cambio de contrato, de datos o una decisión no cubierta → actualiza `.proto`/SPEC/ADR **primero**. Las rutas que la especificación funcional ya pide y aún no existen están listadas en `docs/ux/functional-spec/README.md` §7: se agregan de forma aditiva antes de construir su pantalla.
4. Implementa siguiendo la estructura de carpetas del estándar del lenguaje. Pruebas **antes o junto** al código; una prueba por regla, con el id en el nombre (`TestR4_...`, `r4_...`, `test('R4 ...')`; para reglas normativas `TestN_LAB_02_...`; para observabilidad `TestObs_...`).
5. **Instrumenta en el mismo cambio** (no después): cada función con entrada/salida recibe el contexto y abre o continúa un span; cada camino de error tiene una prueba que verifica el código, el `reason` **y** el registro emitido (clase de error, `request_id`, y pila si es un defecto). Cada servicio conserva sus pruebas de pánico, de propagación de traza y de fuga de datos sensibles (`observability-standards.md` §15).
6. Ejecuta localmente el nivel de verificación que exige el paso (L0–L4, `testing-strategy.md` §1) y **pega la salida** en el PR.
7. Actualiza en el mismo cambio: `SPEC.md` (si cambió algo), `README.md` del contenedor (estado, incluida la fila de observabilidad), `docs/roadmap/status.md` (paso → hecho, con nivel y evidencia), `ARCHITECTURE.md` §2 si cambió el estado del contenedor, y `docs/glossary.md` si creaste un nombre, un `reason` o un enum.
8. Corre `./scripts/check-isolation.sh && ./scripts/check-docs.sh && ./scripts/sync-protos.sh --check`.
9. Commit con Conventional Commits y el contenedor como scope: `feat(ledger): reject unbalanced entries (F10.3, R1)`, con la atribución de la regla 20 de §2 si participó Claude.
10. **Después de cada push a `main`**, publica la app: `./scripts/publish-release.sh <patch|minor|major> <notas.md>` (sube la versión, compila web/Linux/Android contra producción, verifica que los APK lleven la misma firma que la versión anterior, actualiza la web servida y GitHub Pages, y crea el release con instaladores y checksums).

### 3.1 Esta máquina es producción
El repositorio vive en el servidor que atiende a las apps instaladas. Por eso:
- Nada de simulaciones ni datos de demostración en servicios o pantallas: un módulo sin servicio desplegado muestra su estado vacío.
- Las pruebas L2/L3 corren contra recursos **efímeros** (p. ej. `identity/test/test_store_l2.sh` crea y borra su base); nunca contra la base `plentypay`, el stream de NATS de producción ni los contenedores en servicio.
- Desplegar = `docker compose build <svc> && docker compose up -d --no-deps <svc>`. **Nunca** reiniciar el contenedor `tunnel` sin necesidad: su URL cambia al reiniciarse. Desde ADR 0019 las apps la descubren en `server.json` de GitHub Pages (`scripts/publish-server-url.sh`, temporizador cada 2 min); si el túnel muere («Tunnel not found»), se reinicia y se publica la URL nueva.
- Antes de modificar datos de producción, respaldo (`pg_dump`) fuera del repositorio.

## 4. Cómo crear un contenedor nuevo
Copia `docs/templates/SPEC-TEMPLATE.md` → `<contenedor>/SPEC.md` y `docs/templates/CONTAINER-README-TEMPLATE.md` → `<contenedor>/README.md`; registra el contenedor en `docs/architecture/service-dependencies.md`, `network-contracts/consumers.txt`, `docker-compose.yml`, `ARCHITECTURE.md` §2, la tabla de nombres de `docs/glossary.md` §1, y escribe un ADR que justifique su existencia (como ADR 0017 hizo con `orders`).
La estructura interna sigue `go-standards.md` §2 o `rust-standards.md` §3 al pie de la letra.

Todo contenedor nace con su paquete de observabilidad, antes de su primer RPC. Como no se comparte código entre carpetas (regla 2), **se copia y adapta** la implementación de referencia; no se importa:

| Lenguaje | Referencia | Qué aporta |
|---|---|---|
| Go (servidor gRPC) | paquete `internal/observability` de `identity` | logger JSON con correlación, errores con pila (`Wrap`), `Reporter` (`Defect`, `Dependency`, `Panic`), interceptor de servidor, trazas, `/metrics` |
| Go (servidor HTTP y cliente gRPC) | paquete `internal/observability` de `api-gateway` | middleware HTTP, interceptor de cliente que propaga `traceparent` y `x-pp-*`, cuerpo de error con `request_id` |
| Dart | `flutter_app/lib/core/observability/app_logger.dart` | `AppLogger`, migas, capturas globales, enmascarado, `X-Request-Id` y `traceparent` |
| Rust | aún sin referencia: la establece el primer servicio Rust (F10.1) según `rust-standards.md` §5 y `observability-standards.md` §14 | — |

## 5. Comandos
| Para | Comando |
|---|---|
| Verificar aislamiento | `./scripts/check-isolation.sh` |
| Verificar documentación (enlaces, SPEC/README por contenedor, ADR índice, glosario) | `./scripts/check-docs.sh` |
| Regenerar / verificar contratos | `./scripts/sync-protos.sh` / `--check` |
| Pruebas Go de un contenedor | `cd <c> && go vet ./... && go test -race ./...` |
| Pruebas Rust | `cd <c> && cargo test` |
| Flutter | `cd flutter_app && flutter analyze && flutter test` |
| E2E identity↔gateway (incluye traza, `request_id` y fuga de secretos en logs) | `./scripts/e2e-identity-gateway.sh` |
| Invariantes del ledger (especificación de referencia) | `cd scripts/ledger-tests && npm install && npm test` |
| Sistema local | `docker compose up --build` |
| Ver trazas en consola (desarrollo) | `OTEL_TRACES_EXPORTER=console` en el `.env` del contenedor |

## 6. Convenciones de lenguaje
Documentación, comentarios y mensajes al usuario: **español** (UI con i18n `es_PA`/`en`). Identificadores, nombres de pruebas, commits, nombres de métricas, `reason` de errores, **mensajes de log (`msg`) y nombres de atributos de telemetría**: **inglés**. El `msg` de un log es estable y sin datos interpolados; los datos van en atributos.

## 7. Cuándo detenerte y preguntar (no adivines)
- Cualquier cosa de `docs/open-questions.md` marcada **BLOQUEANTE** para tu paso (p. ej. credenciales reales de un riel, especificación privada de un proveedor, tratamiento fiscal).
- Un cambio que rompería una regla de §2 o un contrato publicado.
- Una ambigüedad entre dos documentos: señálala, propone cuál prevalece (orden de §1) y regístrala en `open-questions.md`.
- Una regla normativa marcada **⚠** (sin confirmar) de la que dependa tu paso: implementa el mecanismo, deja el valor sin defecto o la función en sandbox, y cita su `Q-NN`. **No completes el valor con lo que recuerdes de la ley.**
- Una norma, tasa o plazo que no esté en `docs/compliance/`: no la apliques de memoria. Agrégala primero al marco con su fuente y su nivel de verificación.

## 8. Reglas normativas: cómo se implementan
- **Niveles de verificación.** ✔ confirmada en fuente oficial: se implementa tal cual. ◐ solo en fuente secundaria: se implementa como **valor por defecto configurable**. ⚠ sin confirmar: mecanismo sí, valor no (§7). Ningún paso que dependa de reglas ◐ o ⚠ habilita dinero, nómina o facturación reales hasta su validación legal (F28.7, F30.3).
- **Efecto de cada regla.** Cada `N-…` declara si **bloquea** (con un `reason`), **advierte** (pide confirmación y motivo) o **registra**. Se implementa en el servidor; la app muestra el resultado y pide solo los datos que la regla necesita.
- **Evidencia.** Toda operación con efecto legal guarda quién, cuándo y con qué versión del parámetro se calculó (`pp.legal_param_version` en la traza). Nada financiero, fiscal ni laboral se borra: se corrige con un registro nuevo (reverso, nota de crédito, evento de corrección).
- **Datos personales.** Cada dato que recoges tiene una condición de licitud declarada; el consentimiento es previo, separado por finalidad, nunca premarcado, y queda registrado con versión y fecha. Los datos sensibles (biometría) no salen del dispositivo en claro ni se transfieren.
- **Formatos.** Se almacena en el formato del estándar (ISO 4217, ISO 8601 en UTC, E.164, código de unidad de medida, GTIN normalizado) y se presenta en el formato local; la conversión ocurre solo en la capa de presentación.

## 9. Identificadores que vas a encontrar
| Prefijo | Qué es | Dónde se define |
|---|---|---|
| `F<nn>.<m>` | Paso del roadmap | `05-HOJA-DE-RUTA-30-FASES.md` |
| `R<n>` | Regla de negocio de un contenedor | su `SPEC.md` §5 |
| `I<n>`, `T<n>` | Invariante y plantilla de asiento del ledger | `docs/domain/domain-model.md` §5 |
| `N-<área>-<nn>` | Regla normativa (`FIS`, `AML`, `DAT`, `LAB`, `CON`, `COM`, `PAG`, `LOG`, `FMT`, `STD`) | `docs/compliance/regulatory-framework.md`, `docs/compliance/international-standards.md` |
| `S-<módulo>-<nn>` | Ficha de una pantalla | `docs/ux/functional-spec/README.md` §1 |
| `RF-<módulo>-<nn>` | Requisito funcional | `docs/ux/functional-spec/README.md` §5 |
| `C-<nn>` | Comportamiento común a todas las pantallas | `docs/ux/functional-spec/README.md` §3 |
| `Q-NN` | Pregunta abierta | `docs/open-questions.md` |
| `legal.pa.*` | Parámetro legal con vigencia | `docs/compliance/regulatory-framework.md` §13 |
| `pp.*`, `pp_*` | Atributo propio de telemetría y métrica | `docs/standards/observability-standards.md` |
