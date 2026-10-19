# SPEC — analytics-bi

## 1. Responsabilidad
**Hace**: inteligencia de negocio a partir de **eventos** (nunca consulta bases de otros contenedores): proyecciones y métricas (ventas, ticket promedio, productos top, ABC, clientes recurrentes), dashboards, reglas de alerta y detección de anomalías, pronósticos de ventas, segmentación de clientes, exportaciones, y preguntas en lenguaje natural sobre métricas propias.
**No hace**: ser fuente de verdad de nada (si hay discrepancia, manda el contenedor dueño), métricas técnicas (observability).

## 2. Ficha
Go · 50072 · `analytics.proto` · PostgreSQL esquema `analytics` (agregados) + ScyllaDB keyspace `analytics_events` (eventos crudos) + object-storage (exportes) · Fase F21 · Capa L4.

## 3. Modelo de datos
- Scylla `analytics_events.events ((tenant_id, day), occurred_at, event_id)` con el sobre completo (`producer`, `subject`, `request_id`, `trace_parent`, payload) — retención 25 meses.
- PostgreSQL: `analytics.daily_sales (tenant_id, day, branch_id, channel, gross_minor, net_minor, orders, items_milli)`, `analytics.product_daily (tenant_id, day, variant_id, qty_milli, revenue_minor, cost_minor)`, `analytics.customer_stats (tenant_id, customer_user_id, first_purchase, last_purchase, orders, revenue_minor, segment)`, `analytics.dashboards`, `analytics.alert_rules`, `analytics.alert_events`, `analytics.exports`, `analytics.metric_catalog`.
Agregados particionados por mes; todo con `tenant_id` + RLS.

## 4. RPCs
| RPC | Permiso | Comportamiento | Errores (`reason`) |
|---|---|---|---|
| ListMetrics / QueryMetric | `analytics:read` | métricas del catálogo (§5 R2) por rango, granularidad (día/semana/mes), dimensiones (sucursal, canal, categoría) | `METRIC_NOT_FOUND` |
| GetForecast | `analytics:read` | §5 R4 | `METRIC_NOT_FOUND` |
| ListSegments | `analytics:read` | §5 R5 | — |
| GetProductAbc | `analytics:read` | clasificación ABC por ingresos (80/15/5) | — |
| UpsertDashboard / ListDashboards / GetDashboard | `analytics:dashboard:manage` / `analytics:read` | widgets = consultas del catálogo | `METRIC_NOT_FOUND`, `NOT_FOUND` |
| UpsertAlertRule / ListAlertRules / ListAlertEvents | `analytics:alert:manage` / `analytics:read` | umbral fijo o anomalía (§5 R3) | `METRIC_NOT_FOUND` |
| CreateExport / GetExport | `analytics:export` | CSV/XLSX asíncrono a object-storage, enlace 24 h | `IDEMPOTENCY_KEY_REUSED`, `NOT_FOUND` |
| **AskQuestion** | `analytics:read` | §5 R6 | `QUESTION_NOT_UNDERSTOOD` |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-FIS-11, N-FIS-12 y N-COM-03. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Consumidores idempotentes de todos los eventos de negocio (`events-and-messaging.md` §7); los agregados se recalculan desde eventos crudos si cambia una definición (`backfill` por tenant/rango).
- **R2** Catálogo de métricas (definición exacta en `analytics/metrics.yaml`, versionado): `gross_sales`, `net_sales` (tras reembolsos), `orders_count`, `avg_ticket`, `items_sold`, `refund_rate`, `top_products`, `gross_margin` (si hay costo), `new_vs_returning_customers`, `payment_mix_by_rail`, `settlement_paid`, `fees_paid`, `deliveries_completed`, `delivery_success_rate`, `avg_delivery_time_minutes`.
- **R3** Anomalías: por métrica diaria, z-score robusto (mediana y MAD de 28 días, estacionalidad semanal); |z| > 3.5 → `alert_event`; máximo 1 alerta/métrica/día; notificación vía notifications (evento a definir `pp.analytics.alert.triggered.v1` en F21.6).
- **R4** Pronóstico: Holt-Winters aditivo con estacionalidad semanal sobre ventas diarias (mínimo 56 días de historia; si no, media móvil con aviso "historia insuficiente"); intervalos 80 %.
- **R5** Segmentación RFM (recencia, frecuencia, monto en quintiles) → segmentos con nombre ("Campeones", "En riesgo", "Nuevos", "Dormidos"...).
- **R6** Preguntas en lenguaje natural: se traducen a una consulta **del catálogo de métricas** (métrica + rango + filtros) — nunca SQL libre; el traductor puede ser un modelo de lenguaje self-hosted opcional (Q-15) o un parser por reglas en español; la respuesta muestra la consulta interpretada y la cifra exacta.
- **R7** Ventas sandbox excluidas de todo.
- **R8** Dashboards de un tenant solo ven datos del tenant; plataforma ve agregados globales sin datos personales.

## 6. Eventos
Consume todos los de negocio. Publica `alert.triggered` (F21.6).

## 11. Pruebas de aceptación
Reproceso de 1 millón de eventos sintéticos produce los mismos agregados que un cálculo de referencia; pregunta "¿cuánto vendí el mes pasado en la sucursal Colón?" → métrica `net_sales`, rango mes anterior, filtro sucursal.

## 12. Plan
F21.1 ingesta de eventos crudos → F21.2 agregados ventas/productos → F21.3 catálogo de métricas + QueryMetric → F21.4 dashboards → F21.5 ABC + RFM → F21.6 alertas/anomalías → F21.7 pronóstico → F21.8 preguntas en lenguaje natural → F21.9 exportes → F21.10 pantallas Flutter (KPIs, dashboards, preguntar, alertas, segmentos).
