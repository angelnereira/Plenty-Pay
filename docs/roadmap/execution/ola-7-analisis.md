# Ola 7 · Inteligencia de negocio

**Qué cierra**: lo vendido, cobrado y comprado vuelve al dueño como cifras, alertas y pronósticos, y alimenta la siguiente compra. Etapa P9 · M9 ([`../lifecycles.md`](../lifecycles.md)). analytics-bi **no tiene servidor**: se construye con [`README.md`](README.md) §3. Precedencia de fase: F15, F17, F20 (05 §F21).

**Regla de oro (R6 de analytics-bi)**: nunca SQL libre. Toda consulta sale del catálogo de métricas versionado; una pregunta en lenguaje natural siempre devuelve su interpretación junto a la cifra.

| # | Paso | Nivel | Precedencia | Bloqueo |
|---|---|---|---|---|
| 1 | [F21.1](#f211--ingesta-de-eventos) Ingesta de eventos | L2 | servidor analytics-bi | — |
| 2 | [F21.2–F21.3](#f212f213--agregados-y-catálogo-de-métricas) Agregados y catálogo de métricas | L2 | F21.1 | margen ⛔ Q-52 |
| 3 | [F21.4](#f214--tableros) Tableros | L2 | F21.3 | — |
| 4 | [F21.6](#f216--alertas-y-anomalías) Alertas y anomalías | L4 | F21.2, F20.5 | — |
| 5 | [F21.8](#f218--preguntas-en-lenguaje-natural) Preguntas en lenguaje natural | L2 | F21.3 | — |
| 6 | [F21.9](#f219--exportes) Exportes | L2 | F21.3 | — |
| 7 | [F21.10](#f2110--pantallas-de-análisis) Pantallas de análisis | L4 | F21.2–F21.9 | — |

F21.5 (ABC y RFM) y F21.7 (pronóstico) están ✅ en dominio (L1) y se exponen con F21.3.

---

### F21.1 · Ingesta de eventos
Nivel L2 · Estado 📝 (tabla `processed_events` en PostgreSQL).
- **Resultado observable**: cada evento de negocio desplegado (`pos.sale.paid`, `pos.sale.refunded`, `orders.order.paid`, `orders.sub_order.status_changed`, `payments.payment.captured`, `payments.refund.succeeded`, `inventory.stock.changed`, `settlement.batch.paid`) se guarda crudo una sola vez.
- **Código**: consumidores durables (uno por stream) con `processed_events`; almacenamiento crudo en Scylla (keyspace `analytics_events`, TTL según SPEC) o, si el SPEC lo permite mientras no haya volumen, en PostgreSQL particionado: registrar la decisión en el README como desviación.
- **Pruebas**: L2 con NATS efímero `TestR1_SameEventTwiceIsStoredOnce`.
- **Terminado cuando**: «Idempotente» (05).

### F21.2–F21.3 · Agregados y catálogo de métricas
Nivel L2 · Estado 📝 (cálculo y catálogo de 15 métricas en dominio).
- **Resultado observable**: `QueryMetric(gross_sales, día, sucursal)` responde lo mismo que la referencia calculada a mano sobre los eventos de prueba; `gross_margin` solo aparece si hay costo (y el costo de lo vendido espera Q-52: hasta entonces la métrica queda oculta).
- **Código**: agregados diarios por (tenant, sucursal, canal) materializados por un job; RPC `QueryMetric`/`ListMetrics` con dimensiones soportadas (`METRIC_NOT_FOUND` si no).
- **Pruebas**: L2 `TestF21_2_AggregatesMatchReference` (vector con ventas, devoluciones y reembolsos), `TestR2_UnsupportedDimensionIsMetricNotFound`.
- **Terminado cuando**: «Coinciden con referencia» y «R2» (05).

### F21.4 · Tableros
Nivel L2 · CRUD de tableros cuyos widgets apuntan a métricas del catálogo (validación existente `ValidateDashboard`). Prueba: `TestF21_4_DashboardCRUDOnlyCatalogMetrics`. Terminado cuando: «CRUD» (05).

### F21.6 · Alertas y anomalías
Nivel L4 · Estado 📝 (`IsAnomaly`, `EvaluateAlert` en dominio).
- **Resultado observable**: una caída anómala de ventas (z-score robusto > 3.5 con 28 días) o una regla del dueño (p. ej. «faltante de caja > 5.00») produce **una** alerta por regla y día, que llega por notifications (`pp.analytics.alert.triggered.v1`, R2 de notifications).
- **Pruebas**: L2 `TestR3_OneAlertPerRulePerDay`; L4 con datos sembrados en una cuenta de prueba.
- **Terminado cuando**: «R3» (05).

### F21.8 · Preguntas en lenguaje natural
Nivel L2 · RPC `AskQuestion` sobre el parser existente; rechaza SQL (`ContainsSQL`); devuelve interpretación + cifra + citas. Prueba: `TestR6_NeverFreeSQL`, `TestF21_8_AnswerIncludesInterpretation`. Terminado cuando: «R6; nunca SQL libre» (05).

### F21.9 · Exportes
Nivel L2 · CSV/XLSX con el rango y el filtro en la cabecera del archivo (C-20), guardados en object-storage con URL de corta duración. Prueba: `TestF21_9_ExportHeaderHasRangeAndFilter`. Terminado cuando: «CSV/XLSX» (05).

### F21.10 · Pantallas de análisis
Nivel L4 · Estado 📝 (pantallas hechas el 2026-10-19 sin servicio).
- **Qué falta**: conectarlas al servicio real, quitar datos literales (hoy 4 pantallas de analytics con datos fijos según `event-chains.md` §4), widget tests de 4 estados y golden del gráfico.
- **Terminado cuando**: «Widget tests + gráfico golden» (05) y L4 en el Pixel.
