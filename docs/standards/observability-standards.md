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
