# Estándares de observabilidad

Objetivo: cualquier operación de usuario se puede seguir de punta a punta (Flutter → gateway → servicios → BD/eventos) con un solo `request_id`, y cualquier degradación se detecta antes que el cliente la reporte. Contenedor responsable de la pila: `observability` (Prometheus, Grafana, Loki, Tempo, OpenTelemetry Collector).

## 1. Logs
1. **JSON en una línea a stdout**. Nada de archivos de log dentro del contenedor.
2. Campos obligatorios en cada línea:

| Campo | Ejemplo | Nota |
|---|---|---|
| `ts` | `2026-10-10T14:03:22.123Z` | RFC 3339 UTC, milisegundos |
| `level` | `info` | `debug`, `info`, `warn`, `error` |
| `service` | `payments-core` | nombre de la carpeta |
| `version` | `1.4.2+sha.abc123` | inyectada en build |
| `msg` | `payment captured` | inglés, estable, sin datos interpolados |
| `request_id` | UUIDv7 | de `x-pp-request-id` |
| `trace_id`, `span_id` | hex | de OTel |
| `tenant_id`, `user_id` | UUIDv7 | si existen |
| `rpc` | `/plentypay.payments.v1.Payments/CreatePaymentIntent` | en logs de acceso |
| `duration_ms` | `42` | en logs de acceso |
| `grpc_code` | `OK` | en logs de acceso |
| `err` | texto | solo `warn`/`error` |
| `reason` | `INSUFFICIENT_FUNDS` | si hay error de dominio |

3. Niveles: `error` = requiere acción humana; `warn` = anómalo pero manejado; `info` = hechos de negocio y acceso; `debug` desactivado en prod.
4. **Prohibido**: secretos, tokens, contraseñas, PAN, CVV, documentos completos, cuerpos completos de petición. Correos y teléfonos enmascarados (`a***@dominio.com`, `****1234`).
5. Un log de acceso por RPC (interceptor), no logs por cada función.
6. Retención: Loki 30 días en caliente; auditoría va por otro camino (security, 5 años).

## 2. Métricas (Prometheus, endpoint `:9100/metrics`)
Prefijo `pp_`. Unidades en el nombre (`_seconds`, `_bytes`, `_total`).

### 2.1 Obligatorias en todo servicio (las da el interceptor)
- `pp_rpc_server_requests_total{service,rpc,code}`
- `pp_rpc_server_duration_seconds{service,rpc}` (histograma; buckets 5ms…10s)
- `pp_rpc_client_requests_total{service,target,rpc,code}` y `pp_rpc_client_duration_seconds`
- `pp_db_pool_in_use{service}`, `pp_db_query_duration_seconds{service,query}` (`query` = nombre estable, no SQL)
- `pp_outbox_pending{service}`, `pp_outbox_oldest_age_seconds{service}`
- `pp_event_consumer_lag{service,stream,consumer}`, `pp_event_processing_failures_total{service,subject}`
- `pp_build_info{service,version,commit}` = 1

### 2.2 De negocio (por dueño)
- payments-core: `pp_payments_total{rail,status}`, `pp_payments_amount_minor_total{rail,currency}`, `pp_payments_unknown_current{rail}`, `pp_payments_unknown_age_seconds_max`, `pp_payments_captured_unposted_current`, `pp_rail_requests_total{rail,op,result}`, `pp_webhook_rejected_total{provider,reason}`
- ledger: `pp_ledger_transactions_total{template}`, `pp_ledger_post_duration_seconds`, `pp_ledger_holds_active`, `pp_ledger_invariant_violations_total` (debe ser 0 siempre)
- settlement: `pp_settlement_batches_total{status}`, `pp_reconciliation_mismatches_current`
- fiscal-invoicing: `pp_invoices_total{doc_type,status}`, `pp_pac_latency_seconds`, `pp_invoices_pending_age_seconds_max`
- identity: `pp_logins_total{result}`, `pp_lockouts_total`, `pp_refresh_reuse_detected_total`
- api-gateway: `pp_http_requests_total{route,status}`, `pp_http_duration_seconds{route}`, `pp_ws_connections_current`, `pp_rate_limited_total{route}`
- notifications: `pp_notifications_total{channel,status}`
- pos: `pp_pos_offline_sales_pending{tenant_bucket}` (sin tenant_id como etiqueta)
- inventory: `pp_inventory_blocked_levels` (existencias con algo bloqueado, F16.10)

### 2.3 Reglas de cardinalidad
**Nunca** usar como etiqueta: `user_id`, `tenant_id`, `payment_id`, `request_id`, correos, montos. Si hace falta por tenant → logs/trazas o analytics-bi. Máximo ~1 000 series por métrica por servicio.

## 3. Trazas (OpenTelemetry → Tempo)
1. Propagación **W3C `traceparent`** en gRPC (metadatos), HTTP y en el `EventEnvelope` de eventos (campo `trace_parent`), de modo que un consumidor continúa la traza del productor (span link).
2. Span por RPC servidor/cliente (interceptores), por consulta SQL (nombre estable) y por llamada a riel externo.
3. Atributos: `pp.tenant_id`, `pp.request_id`, `pp.rail`, `pp.payment_id` (en trazas sí se permiten ids: no son métricas).
4. Muestreo: **100 % de trazas con error o latencia > p99**, 10 % del resto (tail sampling en el Collector).
5. Exportación OTLP gRPC a `observability:4317`. Si el collector cae, el servicio sigue (exportador asíncrono con buffer acotado).

## 4. Salud
Puerto admin `:9100` (nunca publicado): `/healthz/live` (proceso vivo), `/healthz/ready` (dependencias críticas OK: BD, y para quien lo requiera event-bus), `/metrics`. Además `grpc.health.v1.Health` en el puerto gRPC. `ready` = false durante arranque, migraciones y apagado ordenado.

## 5. SLO (objetivos de servicio)

| Indicador | Objetivo | Ventana |
|---|---|---|
| Login p95 | ≤ 400 ms | 28 días |
| `CreatePaymentIntent` p95 (sin tiempo del riel) | ≤ 300 ms | 28 días |
| `ledger.PostTransaction` p99 | ≤ 50 ms | 28 días |
| Lecturas (listas, detalle) p95 | ≤ 150 ms | 28 días |
| Éxito de peticiones (no 5xx) gateway | ≥ 99.5 % (Fase 30: 99.9 %) | 28 días |
| Pagos en `UNKNOWN` resueltos | ≤ 15 min p95 | 7 días |
| Pagos `CAPTURED` sin asiento > 5 min | **0** | continuo |
| Violaciones de invariantes del ledger | **0** | continuo |
| Facturas pendientes con el PAC > 1 h | 0 | continuo |
| Lag de consumidores de eventos | ≤ 30 s p95 | 7 días |

Presupuesto de error: si se consume > 50 % en una semana, se congelan cambios no relacionados con fiabilidad en ese contenedor.

## 6. Alertas (Alertmanager; reglas como código en `observability/alerts/`)
**Críticas (página inmediata)**:
- `pp_ledger_invariant_violations_total` > 0.
- `pp_payments_captured_unposted_current` > 0 durante 5 min.
- Pago en `UNKNOWN` > 1 h.
- Tasa de error 5xx gateway > 2 % por 5 min.
- Riel con > 20 % de fallos técnicos por 10 min.
- `postgres-db` réplica caída o lag > 30 s; disco > 85 %.
- Certificados que vencen en < 7 días.
- `pp_refresh_reuse_detected_total` sube (posible robo de token).

**Advertencias (ticket)**:
- p95 por encima del SLO 15 min; outbox más viejo > 60 s; lag de consumidor > 2 min; UNKNOWN > 15 min; facturas pendientes > 30 min; bloqueos de login anómalos (> 3× la media horaria).

Cada alerta incluye `runbook_url` hacia `docs/runbooks/<alerta>.md`.

## 7. Dashboards como código (`observability/dashboards/*.json`, aprovisionados)
1. **Visión general** (RED por servicio: rate, errors, duration).
2. **Pagos** (volumen por riel, estados, UNKNOWN, latencia de rieles, conversión intent→captured).
3. **Ledger** (asientos/s, latencia, holds, invariantes).
4. **Liquidación y conciliación**.
5. **Fiscal** (emisión, rechazos, latencia PAC).
6. **Plataforma** (BD, NATS, Scylla, almacenamiento, recursos por pod).
7. **Seguridad** (logins, bloqueos, reuso de refresh, webhooks rechazados, 401/403).

## 8. Trazabilidad de datos (analítica)
Todo evento lleva `event_id`, `occurred_at`, `producer`, `tenant_id`, `request_id`, `trace_parent` (`events-and-messaging.md` §2). `analytics-bi` conserva estos campos en sus tablas para poder ir de un número del dashboard al evento y a la traza que lo produjo.

## 9. Qué debe poder responderse ante cualquier fallo

Regla de aceptación de todo código (servicio, job, consumidor, pantalla, widget, función con efectos): cuando falla, la telemetría responde **sin reproducir el fallo y sin acceso a la máquina** estas cinco preguntas.

| Pregunta | Dato obligatorio | Dónde queda |
|---|---|---|
| **Qué** falló | `error.type` (clase del error), `reason` (código de dominio), `exception.message` | log + span |
| **Dónde** | `service.name`, `service.version`, `code.function.name`, `code.file.path`, `code.line.number`, `rpc` o ruta, y en la app `pp.screen` y `pp.widget` | log + recurso OTel |
| **Cómo** | `exception.stacktrace` completo y la **cadena de causas** (error original → envoltorios), más los pasos previos como spans y eventos de la misma traza | log + traza |
| **Cuándo** | `ts` (RFC 3339 UTC, milisegundos), duración del span, orden de los spans | log + traza |
| **Por qué** | causa raíz (`pp.error.cause`), entradas **no sensibles** que la explican (ids, estado anterior, versión del parámetro legal, intento número), y la dependencia que falló (`peer.service`) | atributos del span y del log |

Además siempre: **a quién afectó** (`tenant_id`, `user_id`, `request_id`) y **qué vio el usuario** (`reason` y estado HTTP devueltos).

Un fallo del que no se pueda responder alguna de las cinco es un defecto de instrumentación y se corrige como un bug.

## 10. Modelo de error (único en los tres lenguajes)

1. **Tres clases de error**, y cada una se trata distinto:

| Clase | Ejemplos | Nivel de log | Estado del span | Qué recibe el cliente |
|---|---|---|---|---|
| **De dominio** (esperable) | saldo insuficiente, transición inválida, validación | `info` (`warn` si es anómalo por frecuencia) | sin error (`UNSET`), con atributo `pp.reason` | código gRPC + `reason` |
| **De dependencia** (reintentable) | BD caída, riel sin respuesta, timeout | `warn` mientras se reintenta; `error` al agotar reintentos | `ERROR` solo si la operación termina fallando | `UNAVAILABLE` / `DEADLINE_EXCEEDED` + `reason` |
| **Defecto** (bug, pánico, invariante rota) | nil, índice fuera de rango, estado imposible | `error`; `fatal` si el proceso no puede seguir | `ERROR` | `INTERNAL` genérico con `request_id`; **nunca** el detalle |

2. **Todo error lleva contexto al subir de capa**: se envuelve con la operación que se intentaba (`post transaction: lock account: …`), sin perder el original. Prohibido descartar un error (`_ = err`, `catch` vacío, `unwrap()` fuera de pruebas, `let _ =` sobre un `Result`).
3. **Se registra una sola vez, en el borde**: el interceptor (gRPC), el middleware (HTTP), el bucle del consumidor o del job, y el manejador global de la app. Las capas internas envuelven y devuelven; no escriben log. Así cada fallo produce exactamente un registro con la traza completa, no cinco parciales.
4. **Un error reintentado que al final tiene éxito no se registra como error** de la operación (convención de OpenTelemetry): queda como evento `retry` en el span, con el número de intento.
5. **Pánicos y excepciones no capturadas**: se capturan en el borde, se registran con traza de pila, incrementan `pp_panics_total{service}` y devuelven `INTERNAL`. El proceso solo termina si su estado quedó inconsistente; en ese caso sale con código distinto de cero tras vaciar la telemetría.
6. **Mensajes de error**: `msg` en inglés, estable y sin datos interpolados (los datos van en atributos), para poder agrupar el mismo fallo.
7. **Huella del error** (`pp.error.fingerprint`): hash de `service` + `error.type` + los 3 primeros marcos propios de la traza de pila. Agrupa ocurrencias del mismo defecto y alimenta la alerta de "error nuevo".

## 11. Trazas de pila

1. Obligatorias en todo log `error` y `fatal`, y en `warn` de la clase "defecto". No se adjuntan a errores de dominio.
2. Atributo `exception.stacktrace`: texto en el formato natural del lenguaje, completo (sin truncar marcos propios; los de librerías pueden abreviarse a partir de 50 marcos).
3. **Se captura donde nace el error**, no donde se registra: Go — error con pila en el punto de creación (envoltorio propio en `internal/observability/errs`); Rust — `std::backtrace::Backtrace` capturada en el error de infraestructura, con `RUST_BACKTRACE=1` en las imágenes; Dart — el `StackTrace` del `catch (e, st)` se propaga siempre.
4. **Símbolos**: los binarios Go resuelven función, archivo y línea aun compilados con `-s -w` (la tabla de líneas del runtime no se elimina; comprobado en F04.6); los binarios Rust de producción conservan símbolos (sin `strip`). La app Flutter se compila con `--split-debug-info` y `--obfuscate`; los archivos de símbolos de cada versión se guardan en `object-storage` (bucket `debug-symbols`, por `service.version`) y el Collector o la consola des-ofuscan la traza.
5. Las trazas de pila **nunca llegan al cliente** ni al cuerpo de un error HTTP o gRPC.
6. La traza de pila se revisa contra la lista de datos prohibidos (§1.4): los mensajes de excepción de librerías pueden contener SQL con valores o URLs con tokens; el borde aplica el mismo enmascarado antes de exportar.

## 12. OpenTelemetry: señales y convenciones

Se usa el SDK oficial de OpenTelemetry en Go y Rust, exportando por **OTLP** al Collector de `observability`; en Dart, mientras no se adopte un SDK, la app emite los mismos nombres de atributos por su propio `AppLogger` (§16). Nombres de atributos según las **convenciones semánticas** de OpenTelemetry; los atributos propios llevan prefijo `pp.`.

1. **Recurso** (idéntico en logs, métricas y trazas): `service.name` (carpeta del contenedor o `flutter_app`), `service.version`, `service.instance.id`, `deployment.environment.name` (`dev`, `staging`, `prod`), y en la app `os.name`, `os.version`, `device.model.identifier`, `app.build_id`.
2. **Logs**: los registros de §1 se emiten también como `LogRecord` de OTel con `TraceId` y `SpanId`, de modo que desde un log se salta a su traza y al revés. `SeverityNumber`: `debug` 5, `info` 9, `warn` 13, `error` 17, `fatal` 21.
3. **Excepciones como logs** (la convención de eventos de span está en retirada): un `LogRecord` con `exception.type`, `exception.message` y `exception.stacktrace`, nombre de evento `<operación>.exception` (o `exception` en manejadores globales) y severidad según impacto: `fatal` si termina el proceso, `error` si no se manejó, `warn` si el código la manejó.
4. **Estado del span**: se deja sin fijar si la operación terminó bien; `ERROR` si falló, con la descripción igual al mensaje de la excepción cuando no es sensible. Toda operación fallida lleva `error.type`.
5. **Métricas de error**: el histograma de duración de cada operación lleva `error.type` cuando falla y no lo lleva cuando tiene éxito; no se crean contadores de error separados por operación. `error.type` usa valores de baja cardinalidad (clase del error o `reason`), nunca el mensaje.
6. **Propagación**: `traceparent` de W3C Trace Context, versión `00`: `00-<trace-id 32 hex>-<parent-id 16 hex>-<flags 2 hex>`, en minúsculas; un id todo en ceros es inválido y obliga a iniciar traza nueva. Viaja en HTTP, en metadatos gRPC, en el WebSocket (campo `traceparent` de cada mensaje `subscribe`) y en los eventos.
7. **Spans obligatorios**: servidor y cliente por RPC o petición HTTP; consulta SQL (nombre estable, sin valores); publicación y consumo de evento (con *span link* al productor); llamada a riel, PAC u otro tercero; cada ejecución de job; y en la app: arranque, navegación entre pantallas, petición HTTP y cada acción de dinero de punta a punta.
8. **Atributos de negocio en spans**: `pp.tenant_id`, `pp.request_id`, `pp.reason`, `pp.rail`, `pp.payment_id`, `pp.idempotency_key_hash`, `pp.legal_param_version` (cuando un cálculo usó parámetros `legal.pa.*`).
9. **Nunca en telemetría**: lo prohibido en §1.4, más cuerpos de petición, plantillas biométricas, y coordenadas exactas de personas (se redondean a 3 decimales).

Pendiente de contrato (aditivo, F03.2): `EventEnvelope` hoy solo tiene `trace_id`; para continuar la traza en el consumidor necesita el campo `trace_parent` con la cabecera completa.

## 13. Telemetría del cliente Flutter

1. **Tres capturas globales, las tres obligatorias**: `FlutterError.onError` (errores de construcción y de widgets), `PlatformDispatcher.instance.onError` (errores asíncronos no capturados) y `runZonedGuarded` alrededor de `runApp`. Los isolates adicionales registran su propio `addErrorListener`.
2. **Cada error de la app registra**: `pp.screen` (ruta de `go_router`), `pp.widget` (cuando viene de `FlutterErrorDetails`), `exception.type`, `exception.stacktrace`, `app.build_id`, sistema y modelo, estado de red (en línea o no), `request_id` y `trace_id` de la última petición, y las últimas 20 **migas** (navegaciones, toques sobre acciones con nombre, peticiones con su estado) sin valores de campos.
3. **Límite de error en la interfaz**: un widget que falla al construirse se reemplaza por `ErrorState` de su sección, no tumba la pantalla. La pantalla completa solo cae en la de error genérica con el código de soporte.
4. **Código de soporte**: lo que el usuario ve y puede copiar es el `request_id`; con él se llega al log, y del log a la traza.
5. **Envío**: OTLP/HTTP al gateway (`POST /v1/telemetry`, con límite de tasa y de tamaño), en lotes, con cola local acotada (500 registros o 1 MiB) que sobrevive al cierre de la app y se vacía al recuperar red. Nunca bloquea la interfaz ni una operación de dinero.
6. **Privacidad**: sin datos personales, sin texto de campos, sin capturas de pantalla. El `user_id` solo viaja si el usuario tiene sesión; el envío de telemetría de uso (no la de errores) respeta el consentimiento del usuario (`docs/compliance/regulatory-framework.md` N-DAT-02).
7. **Rendimiento**: arranque en frío, tiempo hasta primer cuadro por pantalla, cuadros lentos y congelados, y duración de cada petición, como métricas.

## 14. Requisitos por lenguaje

| | Go | Rust | Dart / Flutter |
|---|---|---|---|
| Logger | `log/slog` con handler JSON + puente OTel. Prohibido `log.Printf`, `fmt.Println` | `tracing` + `tracing-subscriber` (JSON) + `tracing-opentelemetry`. Prohibido `println!`, `eprintln!` | Un `AppLogger` en `core/observability/`. Prohibido `print`, `debugPrint` en release |
| Errores | `fmt.Errorf("…: %w", err)`; errores tipados de dominio; pila en el origen | `thiserror` en dominio; `#[source]` para la causa; `Backtrace` en errores de infraestructura | Excepciones tipadas (`ApiException`, `DomainException`); `catch (e, st)` siempre con `st` |
| Borde | Interceptores gRPC y middleware HTTP: `recover` → log + span + métrica | Capa `tower`: `catch_unwind` + `tracing::error!` con el error y su pila | Las tres capturas de §13.1 + `ProviderObserver` de Riverpod para errores de providers |
| Función instrumentada | `ctx` como primer parámetro en toda función con E/S; span con `tracer.Start(ctx, …)` | `#[tracing::instrument(skip(…), err)]` en casos de uso y adaptadores | `AppLogger.span('nombre', () async { … })` en repositorios y controladores |
| Linter que lo exige | `errcheck`, `wrapcheck`, `forbidigo` (golangci-lint) | `clippy::unwrap_used`, `clippy::expect_used`, `clippy::print_stdout`, `let_underscore_must_use` en `deny` | `avoid_print`, `empty_catches`, `unawaited_futures` como errores |

`ctx`/`Span` se propaga siempre: una goroutine, tarea `tokio` o `Future` lanzada en segundo plano recibe el contexto de traza de quien la lanzó, o crea un span raíz con *link* si sobrevive a la petición.

## 15. Verificación (parte del Definition of Done)

1. **Prueba de fallo por regla**: por cada camino de error de un RPC existe una prueba que verifica el código, el `reason` **y** que se emitió un registro con `error.type`, `request_id` y, si es defecto, `exception.stacktrace`. Se usa un exportador en memoria.
2. **Prueba de pánico**: cada servicio tiene una prueba que provoca un pánico en un handler y comprueba: respuesta `INTERNAL` sin detalle, log `error` con pila, `pp_panics_total` incrementado y proceso vivo.
3. **Prueba de propagación**: una petición con `traceparent` produce spans del gateway y del servicio con el mismo `trace-id` (L4, sobre Compose).
4. **Prueba de fuga**: un test recorre los registros emitidos por la suite y falla si encuentra patrones de token, contraseña, tarjeta o cédula completa.
5. **CI**: los linters de §14 son bloqueantes.
6. **Alertas nuevas**: `pp_panics_total` > 0 (crítica); huella de error nunca vista en `prod` (advertencia); tasa de `error.type` por operación 3 veces sobre su media de 7 días (advertencia); caída del 50 % en el volumen de telemetría de un servicio (advertencia: puede estar fallando en silencio).

## 16. Estado de conformidad del código actual

| Contenedor | Implementado (2026-10-12) | Falta | Paso |
|---|---|---|---|
| `identity`, `api-gateway` | Logs JSON con correlación; modelo de error (§10) con pila en el origen y registro único en el borde; recuperación de pánicos; trazas con propagación W3C entre ambos; `request_id` en el cuerpo de error; `/metrics` con contadores; pruebas de pánico, propagación y fuga (§15.1–15.4) | Histogramas y métricas de §2.1; puente de logs a OTLP; exportación contra un colector real; `golangci-lint` (no instalado: reglas de §14 sin verificar) | F04.1, F04.6 |
| `flutter_app` | Tres capturas globales; registro con pantalla, widget, pila y migas; enmascarado; `X-Request-Id` y `traceparent`; cola acotada; lints | Envío por OTLP y `POST /v1/telemetry`; persistencia de la cola; estado de red; métricas de rendimiento; símbolos de des-ofuscación; límite de error por sección | F22.6 |

Sin SDK oficial de OpenTelemetry para Dart en uso: la app emite registros con los nombres de las convenciones semánticas y genera `traceparent` por sí misma; el SDK se evalúa en F22.6.

Fuentes: OpenTelemetry — [registro de errores](https://opentelemetry.io/docs/specs/semconv/general/recording-errors/), [excepciones como logs](https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-logs/), [excepciones en spans (en retirada)](https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-spans/), [modelo de datos de logs](https://opentelemetry.io/docs/specs/otel/logs/data-model/); W3C — [Trace Context](https://www.w3.org/TR/trace-context/). Consultadas el 2026-10-12.
