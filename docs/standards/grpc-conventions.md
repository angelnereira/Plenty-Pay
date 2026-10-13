# Convenciones gRPC y de contratos

Aplica a TODO `.proto` de `network-contracts/proto/` y a toda llamada entre contenedores. Un agente que implemente un servicio cumple esto sin que cada SPEC lo repita.

## 1. Diseño de contratos
1. **Cambios solo aditivos** una vez publicado un campo (ADR 0004): nunca reutilizar ni renumerar; para retirar: `reserved <n>; reserved "<nombre>";`. Un cambio incompatible exige paquete nuevo (`...v2`).
2. **Paquete** `plentypay.<dominio>.v1`. **Servicio**: sustantivo de dominio (`Payments`, `Ledger`). **RPC** `VerboSustantivo` (`CreatePaymentIntent`, `ListPayments`). **Mensajes** `<Rpc>Request` / `<Rpc>Response` o la entidad devuelta.
3. **Enums**: valor 0 siempre `<ENUM>_UNSPECIFIED`; valores con prefijo del enum (`PAYMENT_STATUS_CAPTURED`). *(Excepción histórica ya publicada: `UserRole` en identity.)*
4. **Dinero**: `plentypay.common.v1.Money{amount_minor:int64, currency}` — nunca `float`/`double`. Cantidades de inventario en **milésimas** (`*_milli`, int64). Tasas en **puntos básicos** (`*_bps`, int32; 1 % = 100).
5. **Tiempo**: `google.protobuf.Timestamp` (UTC). Fechas de negocio sin hora (`YYYY-MM-DD`) y horas de turno (`"HH:MM"`) se interpretan en `America/Panama`.
6. **IDs**: strings UUIDv7 en minúsculas (`data-standards.md` §2). Un `*_id` vacío = "no aplica", nunca un id inventado.
7. **Paginación**: `PageRequest{page_size (1..200, def. 50), page_token}` → `PageInfo{next_page_token}`. Tokens opacos (keyset, nunca OFFSET). Sin paginación solo si el conjunto está acotado por diseño.
8. **Mutaciones** que crean o cambian dinero/stock/estado y pueden reintentarse llevan `idempotency_key` (§3).
9. **Streaming** solo donde el dominio es un flujo (ubicación, display del cliente, bandeja en vivo, seguimiento).
10. **Mapas** `map<string,string>`: máx. 20 claves, valores ≤ 500 caracteres, jamás datos sensibles.
11. Cada servicio y RPC documenta en el `.proto` su efecto; el `.proto` es documentación de primera clase.
12. Cada `.proto` declara al final los **mensajes de eventos** que su dueño publica (`events-and-messaging.md`).

## 2. Contexto de petición (metadatos, no campos del cuerpo) — ADR 0011
El **tenant y el actor NUNCA viajan en el cuerpo para autorizar**: viajan en metadatos gRPC establecidos por `api-gateway` tras validar el token y aceptados solo de un llamador de confianza.

| Metadato | Contenido |
|---|---|
| `x-pp-request-id` | UUIDv7 por petición de usuario; se propaga sin cambio en toda la cadena; aparece en logs/trazas y se devuelve al cliente |
| `x-pp-user-id` | usuario autenticado (vacío = servicio/sistema) |
| `x-pp-tenant-id` | comercio del usuario (vacío = cliente final o plataforma) |
| `x-pp-role` | rol del usuario |
| `x-pp-permissions` | permisos separados por coma (si > 4 KB se omite y el servicio consulta a identity) |
| `x-pp-actor-service` | contenedor que origina la llamada (auditoría) |
| `traceparent` | W3C Trace Context (OpenTelemetry) |
| `x-pp-step-up` | token de confirmación fuerte, si la operación lo exige |

Un servicio **debe**: (a) rechazar con `UNAUTHENTICATED` toda llamada sin identidad de servicio válida (mTLS, Fase 5; hasta entonces aislamiento de red); (b) tomar tenant/actor **solo** de estos metadatos; (c) filtrar TODA consulta por `x-pp-tenant-id`. Los campos `tenant_id`/`party_id` del cuerpo son **datos de negocio** (p. ej. a quién se liquida), nunca fuente de autorización.

## 3. Idempotencia (obligatoria en mutaciones reintentables)
- `idempotency_key`: 16–100 caracteres (UUID recomendado), única **por (tenant, RPC)**.
- Servidor: guarda `(tenant, rpc, key) → sha256(request canónico), respuesta, recurso_id` en la **misma transacción** que la mutación (tabla estándar `idempotency_keys`, `data-standards.md` §6; retención ≥ 72 h).
- Misma key + mismo hash → devuelve la respuesta original **sin ejecutar de nuevo**. Misma key + hash distinto → `ALREADY_EXISTS` (`reason=IDEMPOTENCY_KEY_REUSED`). Nunca devolver el resultado viejo en silencio: ocultaría un bug del cliente.
- Reintento mientras la primera ejecución sigue en curso → `ABORTED` (el cliente reintenta con backoff).
- Los clientes **reutilizan la misma key al reintentar la misma operación**; generan una nueva para otra operación (otro monto, destinatario o riel).
- Las claves internas entre servicios son deterministas: p. ej. `pay:<payment_id>` para el asiento de una captura (`domain-model.md` §6).

## 4. Errores
Códigos gRPC estándar; detalle estructurado en `google.rpc.Status` con `ErrorInfo{reason, domain:"plentypay", metadata}`. `reason` es un código estable en `MAYUSCULAS_CON_GUION_BAJO` (parte del contrato; los clientes lo traducen a texto).

| Situación | gRPC | HTTP (gateway) |
|---|---|---|
| Entrada inválida | `INVALID_ARGUMENT` | 400 |
| Sin identidad / token inválido | `UNAUTHENTICATED` | 401 |
| Sin permiso | `PERMISSION_DENIED` | 403 |
| Recurso inexistente **o de otro tenant** (no revelar existencia) | `NOT_FOUND` | 404 |
| Transición de estado inválida / regla de negocio | `FAILED_PRECONDITION` | 409 |
| Idempotency key reutilizada con otro contenido / duplicado | `ALREADY_EXISTS` | 409 |
| Conflicto de concurrencia (reintentar) | `ABORTED` | 409 + `Retry-After` |
| Límite de tasa | `RESOURCE_EXHAUSTED` | 429 |
| Dependencia caída (reintentable) | `UNAVAILABLE` | 503 |
| Plazo vencido | `DEADLINE_EXCEEDED` | 504 |
| Bug del servidor | `INTERNAL` (sin detalle al cliente; detalle en logs con `request_id`) | 500 |
| No implementado aún | `UNIMPLEMENTED` | 501 |

Los errores de **negocio esperables** (saldo insuficiente, sin stock) son `FAILED_PRECONDITION` con `reason` estable, nunca `INTERNAL`.
*(Conformidad: `identity` hoy devuelve `success=false`+mensaje dentro de `AuthResult` en `Register/Login/RefreshToken` — contrato ya publicado que se mantiene; **todo RPC nuevo usa códigos gRPC**.)*

Catálogo de `reason` transversales: `IDEMPOTENCY_KEY_REUSED`, `TENANT_NOT_ACTIVE`, `STEP_UP_REQUIRED`, `STEP_UP_INVALID`, `INSUFFICIENT_FUNDS`, `OUT_OF_STOCK`, `INVALID_STATE_TRANSITION`, `AMOUNT_BELOW_FEES`, `CURRENCY_MISMATCH`, `UNBALANCED_TRANSACTION`, `RAIL_UNAVAILABLE`, `RATE_LIMITED`, `MAINTENANCE_MODE`. Cada SPEC lista los suyos; el catálogo completo, con dueño, está en `docs/glossary.md` §7.3.

## 4.1 Anexo — `reason` por RPC (F03.5)

Dónde buscar el detalle de cada RPC, para no duplicarlo aquí:

| Dueño | Dónde están sus `reason` por RPC |
|---|---|
| identity, payments-core, settlement, fiscal-invoicing, orders, pos, ledger | columna *Errores (`reason`)* de la tabla §4 de su `SPEC.md` |
| api-gateway | `api-gateway/SPEC.md` §3.11 y la tabla de rutas §4 |
| catalog, inventory, logistics, geolocation, payroll, notifications, analytics-bi, security, infra-management | ídem (columna añadida el 2026-10-12, F03.5) |
| **todos** | catálogo completo con dueño: `docs/glossary.md` §7.3 |

Reglas para añadir uno:
1. El nombre se decide con el SPEC abierto: si §5 ya nombra el fallo, se usa esa palabra.
2. Se declara en la columna *Errores (`reason`)* de la fila del RPC **y** en la fila del contenedor de `docs/glossary.md` §7.3, en el mismo cambio (`scripts/check-docs.sh` comprueba las dos cosas).
3. Si el fallo es transversal (recurso inexistente, estado inválido, clave de idempotencia reutilizada), **no** se declara como propio: se reutiliza el transversal.
4. Un `reason` normativo (los de la fila *normativos* de §7.3) no se copia al contenedor: se cita desde la regla `N-…` que lo fija.
5. Un fallo interno del servidor **nunca** lleva `reason` de negocio: es `INTERNAL` sin detalle al cliente.

## 5. Plazos, reintentos y resiliencia
- Todo llamador fija **deadline** (3 s lecturas, 10 s escrituras, 30 s cuando cruza a un riel externo). Los servicios propagan el deadline restante, nunca lo amplían.
- Reintento automático **solo** de RPC idempotentes (lecturas o mutaciones con `idempotency_key`), solo ante `UNAVAILABLE`/`ABORTED`, backoff exponencial con jitter (100 ms ×2, tope 2 s, máx. 3 intentos). Nunca reintentar a ciegas un cobro tras `DEADLINE_EXCEEDED`: se consulta estado.
- **Circuit breaker** por dependencia en clientes de alto tráfico (abre tras 5 fallos consecutivos o 50 % de error en 30 s; semiabierto con 1 sonda).
- Límite de concurrencia por servicio (bulkhead) para que una dependencia lenta no agote todos los workers.

## 6. Versionado y compatibilidad
- Cambios compatibles (campo/RPC nuevo) se publican directo; el servidor tolera clientes que no envían el campo nuevo.
- CI: `buf lint` y `buf breaking --against '.git#branch=main'` sobre `network-contracts/proto` (Fase 3). Mínimo bloqueante ya disponible: `protoc` compilando todos los archivos + `scripts/sync-protos.sh --check`.

## 7. Generación de código
`network-contracts/consumers.txt` declara qué consume cada contenedor; `scripts/sync-protos.sh` genera (Go, un paquete `pb` por contenedor) o copia (Rust, `<contenedor>/proto/` + `tonic-build` en `build.rs`). El código generado **se commitea** y nunca se edita a mano.

## 8. Salud y administración
Cada contenedor expone `grpc.health.v1.Health` en su puerto de servicio **y** un puerto de administración HTTP `:9100` (no publicado al host) con `/healthz/live` (vivo), `/healthz/ready` (dependencias críticas OK) y `/metrics` (Prometheus) — `observability-standards.md`. Reflexión gRPC solo si `ENV != production`.
