# Diseño: Módulo Business Intelligence (BI) — el cerebro de PlentyPay

**Fecha:** 2026-05-10
**Estado:** ✅ IMPLEMENTADO (Fases 1, 1.5, 2, 3, 4) — release v2.0.0
**Autor:** sesión de design con feedback del owner

---

## TL;DR

El módulo de BI es la capa transversal que **observa, explica, predice y activa** todo
lo que pasa en PlentyPay. Se ofrece en dos tiers progresivos:

| Tier            | Promesa                       | Pregunta que responde            | Quién lo usa                  |
|-----------------|-------------------------------|----------------------------------|-------------------------------|
| **BI Esencial** | Monitoreo                     | ¿Qué está pasando hoy?           | Dueño / gerente operativo     |
| **BI Pro**      | Monitoreo + experimentación   | ¿Qué va a pasar y cómo lo muevo? | Estratega / dueño con datos   |

Esencial vive del trabajo ya hecho (Invoice, POS, Inventory, Créditos, Logística,
Payday). Pro suma builder de vistas custom, forecast, segmentación y captura de
datos para campañas — equivalente "abstraído" a Power BI dentro de PlentyPay.

---

## 1. Problema / Contexto

Hoy PlentyPay captura datos ricos en cada módulo (facturas, ventas POS, movimientos
de inventario, créditos otorgados, entregas, asistencia), pero **el dueño del
negocio no tiene un solo lugar para entenderlos**. Hay un dashboard genérico al
loguearse, KPIs sueltos en cada módulo, y `/dashboard/admin/analytics` que es
solo para SUPER_ADMIN (métricas de la plataforma, no del cliente).

El cliente quiere preguntas como:
- ¿Qué producto me deja más utilidad este mes? ¿Y cuál bajó vs el mes pasado?
- ¿Qué clientes me dejaron de comprar?
- Si subo el precio del SKU X 5%, ¿cuánto cambia mi margen?
- ¿Cuándo me voy a quedar sin stock del top 10?
- Avísame cuando las ventas caigan más de 20% día a día.

Ninguna de esas se responde hoy con dos clics.

---

## 2. Objetivo

Construir un módulo BI que sea **el cerebro del negocio del cliente**:

1. **Conectarse a todo** lo que ya existe (es transversal, no vertical).
2. **Empezar por observar** (Esencial) y **escalar a entender + actuar** (Pro).
3. **Inspirado en Power BI** pero con el subset que un PyME panameño realmente usa.
4. **Vivir en el catálogo** como uno o dos addons cobrables — alineado con el
   modelo actual de monetización.

No-objetivos del MVP:
- DAX completo, modelo semántico custom, embed externo, app móvil dedicada.
- Conexión a fuentes externas (Snowflake, Excel del cliente, etc.).
- Multi-currency / multi-país (Panamá first).

---

## 3. Decisiones de diseño

### 3.1 Tiers como dos addons separados

Dos entradas en `ADDON_CATALOG` (`lib/constants/plans.ts`):

| Addon ID  | Label             | Pricing         | Requiere     |
|-----------|-------------------|-----------------|--------------|
| `bi`      | BI Esencial       | `$25/mes` fijo  | —            |
| `biPro`   | BI Pro            | `$59/mes` fijo  | `bi` activo  |

Razón: `creditos` ya usa `tiered` para "volumen del cliente"; usar `tiered` también
para "nivel de feature" mezclaría dos conceptos. Dos addons separados es más
honesto y permite a un cliente quedarse en Esencial sin pagar el upgrade. **Pro
incluye Esencial** — al activar `biPro` se asume `bi`.

> ⚠️ Decisión a confirmar con el owner: precios exactos y si Pro debería incluir
> Esencial implícitamente o requerir ambos flags activos.

### 3.2 Power BI parity — qué SÍ y qué NO

**Qué traemos (con etiqueta de fase):**

| Power BI                          | PlentyPay BI                                       | Fase |
|-----------------------------------|------------------------------------------------|------|
| Dashboards con visualizaciones    | Dashboards prediseñados (Esencial)             | 1    |
| Filtros globales y locales        | `BIFilterBar` reutilizable                     | 1    |
| Drill-down (mes → semana → día)   | Click en eje de tiempo abre nivel inferior     | 1    |
| Exportar a Excel / PDF            | Exportes programados y on-demand               | 1    |
| Drag & drop de campos             | Builder visual con dimensions/measures         | 2    |
| Tableros personalizados           | `BIDashboard` editable + grid layout           | 2    |
| Cross-filtering                   | Click en barra filtra el resto del dashboard   | 2    |
| Compartir dashboards              | Share con miembros del tenant                  | 2    |
| Q&A en lenguaje natural           | "Pregúntale al BI" via AI Gateway              | 4    |
| Forecast nativo                   | Predicción de ventas/demanda (heurística + estacionalidad) | 3 |
| Alerts                            | Alertas inteligentes (anomalías) y por umbral  | 4    |

**Qué NO traemos:**

- DAX (lenguaje de fórmulas). El builder usa medidas predefinidas.
- Modelo semántico configurable por el cliente. Usamos uno fijo bien diseñado.
- Conexión a fuentes externas. Solo datos internos de PlentyPay.
- Embed público en web del cliente.
- Mobile app nativa (la web es responsive y funciona en tablet/móvil).

### 3.3 Arquitectura: 5 capas

```
┌─────────────────────────────────────────────────────────────┐
│ Capa 5 — UI                                                 │
│   /dashboard/bi/* (Esencial fijo + Pro custom)              │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│ Capa 4 — Servicios de inteligencia (Pro)                    │
│   forecast.service · segments.service · alerts.service      │
│   campaigns.service · whatif.service                        │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│ Capa 3 — Query DSL                                          │
│   POST /api/bi/query                                        │
│   { measure, dimensions[], filters[], dateRange, sortBy }   │
│   → SQL parametrizado + cache Upstash (TTL 60s en vivo,     │
│     1h en agregados diarios)                                │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│ Capa 2 — Read models (Postgres)                             │
│   Vistas materializadas particionadas por clientId          │
│   refrescadas por cron (cada hora para hoy, diario para     │
│   histórico). Vistas regulares para datos en vivo.          │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│ Capa 1 — Fuentes (existentes)                               │
│   Invoice · InvoiceItem · Customer · Product · POS Sale     │
│   StockMovement · CreditMovement · DeliveryOrder · Payday   │
└─────────────────────────────────────────────────────────────┘
```

**Por qué vistas materializadas y no un warehouse separado:** Postgres en Neon
maneja agregaciones a la escala que estamos hablando (PyMEs, < 1M facturas/año
por cliente) sin necesidad de mover datos a un sistema externo. Refrescamos por
cron, particionamos por `clientId`, y mantenemos un solo lenguaje (SQL) de punta
a punta. Si en el futuro un cliente Enterprise satura, lo movemos a un warehouse
dedicado sin tocar la API de query.

---

## 4. Funcionalidades por tier

### 4.1 BI Esencial — `$25/mes`

**Promesa:** "Entiende qué pasa en tu negocio cada día sin abrir Excel."

#### 4.1.1 Dashboards prediseñados (6 fijos)

| Dashboard      | KPIs principales                                      | Filtros           |
|----------------|-------------------------------------------------------|-------------------|
| **Resumen**    | Ventas hoy/semana/mes, ticket promedio, # tx          | Período, sucursal |
| **Ventas**     | Por producto, por sucursal, por vendedor, por cliente | + categoría       |
| **Productos**  | Top sellers, margen por SKU, días sin movimiento      | + categoría       |
| **Clientes**   | Top compradores, frecuencia, ticket promedio          | Período           |
| **Inventario** | Valoración, stock bajo, productos sin rotación        | Sucursal          |
| **Créditos**   | Saldo otorgado, vencidos, cobranza del mes            | Estado entidad    |

> Si el cliente no tiene un módulo activo (ej. no usa POS), su dashboard se
> oculta automáticamente del menú.

#### 4.1.2 Comparativas y drill-down

- Cada KPI muestra su delta vs período anterior (`+12.4%` en verde / `-3.1%` en rojo).
- Click en un punto del eje de tiempo abre el siguiente nivel (mes → semana → día → hora).
- Filtro de período rápido: Hoy, 7d, 30d, MTD, YTD, custom.

#### 4.1.3 Exportes

- Botón "Exportar" en cada dashboard → Excel o PDF.
- Exportes programados: "envíame este dashboard cada lunes 8am al correo X" (vía cron + email service ya existente).

#### 4.1.4 Alertas básicas (umbrales)

Configurables desde el dashboard:
- "Avísame cuando stock de SKU X baje de Y unidades."
- "Avísame cuando un cliente con crédito pase de N días vencido."
- "Avísame cuando las ventas del día sean menores a $X."

Notificaciones por web push y/o correo (reutilizando el sistema existente).

---

### 4.2 BI Pro — `$59/mes` (incluye Esencial)

**Promesa:** "Experimenta con tus datos, predice y arma campañas — sin científicos de datos."

#### 4.2.1 Builder de vistas custom

Inspirado en el panel "Visualizations + Fields" de Power BI, simplificado:

```
┌─────────────────────────────────────────────────────────────┐
│ Visualización: [📊 Barras ▼]                                │
├──────────────────────┬──────────────────────────────────────┤
│ Dimensiones          │   ┌───────────────────────────┐     │
│  · Producto          │   │                           │     │
│  · Sucursal       ←  │   │     Preview en vivo       │     │
│  · Cliente           │   │                           │     │
│  · Fecha             │   └───────────────────────────┘     │
│                      │                                      │
│ Medidas              │   Filtros (drag here)                │
│  · Ventas         ←  │   · Período = últimos 30 días        │
│  · Margen            │   · Sucursal ≠ "Bodega"              │
│  · # transacciones   │                                      │
│  · Cantidad vendida  │   [Guardar como widget]              │
└──────────────────────┴──────────────────────────────────────┘
```

- Catálogo fijo de medidas y dimensiones (no hay DAX). Suficiente para 95% de los casos PyME.
- Preview en vivo conforme se arrastran campos.
- Guardar como widget en un dashboard custom o como reporte standalone.

#### 4.2.2 Tableros personalizados

- `BIDashboard` con grid layout (12 columnas, alturas configurables).
- Añadir/quitar widgets, reordenar drag & drop.
- Compartir con miembros del tenant (con permisos: ver, editar).

#### 4.2.3 Predicción

| Predicción                  | Cómo                                          | UX                                                  |
|-----------------------------|------------------------------------------------|-----------------------------------------------------|
| Ventas próximos 30/60/90d   | Media móvil + estacionalidad (semanal/mensual) | Línea con banda de confianza superpuesta a histórico |
| Demanda por SKU             | Promedio + tendencia + estacionalidad de SKU   | Top 20 SKUs con "días hasta agotamiento" estimados   |
| Clientes en riesgo de churn | RFM + caída de frecuencia                      | Lista con "razón" y CTA "iniciar campaña"            |
| Productos en riesgo         | Demanda decreciente vs stock alto              | Lista con "días de inventario muerto" estimados      |

> Modelos heurísticos en TypeScript ejecutados server-side. No requerimos GPU ni
> servicio externo de ML para el MVP. Si en fase 4 queremos modelos más sofisticados
> (ej. Prophet, ARIMA), añadimos un microservicio Python sin tocar la API de capa 3.

#### 4.2.4 Simulador what-if

- Slider sobre precio de un SKU (-20% a +20%) → impacto proyectado en margen del mes.
- Slider sobre descuento general → impacto en ingresos.
- "Si abro una sucursal nueva con ventas similares a la sucursal X, ¿cuánto crece el negocio?"

#### 4.2.5 Segmentación y captura de datos

`BISavedSegment` con reglas en JSON:

```json
{
  "entity": "customer",
  "rules": [
    { "field": "lastPurchaseDaysAgo", "op": ">=", "value": 60 },
    { "field": "totalSpentLast12mo", "op": ">=", "value": 500 }
  ]
}
```

- Recálculo del count cada 24h por cron.
- Vista del segmento con lista de clientes/productos que caen.
- Acciones sobre el segmento:
  - **Exportar a CSV.**
  - **Iniciar campaña** → conectar al addon `whatsapp` o al email service para
    enviar mensaje masivo. Genera un `BICampaign` con métricas de envío y
    respuesta (cuántos compraron en los próximos 14 días después del envío).

#### 4.2.6 RFM y cohortes

- **RFM (Recency, Frequency, Monetary)**: tabla 5x5 con clientes en cada celda
  ("Champions", "At Risk", "Hibernating", etc.). Estándar de marketing,
  comprensible sin entrenamiento.
- **Cohort retention**: matriz mensual de "% de clientes adquiridos en mes M
  que volvieron a comprar en mes M+N".

#### 4.2.7 Análisis de canasta (market basket)

- "Los clientes que compraron X también compraron Y, con confianza Z%."
- Útil para sugerencias de bundle, displays físicos en POS, recomendaciones.

#### 4.2.8 Alertas inteligentes (anomalías)

- Detección automática de caídas o picos atípicos vs línea base (3σ sobre la
  media móvil).
- "Las ventas de hoy están 35% por debajo de lo esperado para un viernes."

---

## 5. Posición en el catálogo (`lib/constants/plans.ts`)

Dos addons nuevos en `ADDON_CATALOG`:

```ts
bi: {
  label: "BI Esencial",
  description: "Dashboards de monitoreo, exportes y alertas por umbral.",
  flagField: "biEnabled",
  pricing: { kind: "fixed", priceCents: 2500 },
},
biPro: {
  label: "BI Pro",
  description:
    "Incluye Esencial + builder custom, predicción, segmentos y campañas.",
  flagField: "biProEnabled",
  pricing: { kind: "fixed", priceCents: 5900 },
  requires: "bi", // nuevo campo: dependencia entre addons
},
```

### Cambios al schema (`prisma/schema.prisma`)

```prisma
model Client {
  // ...
  biEnabled       Boolean  @default(false)
  biProEnabled    Boolean  @default(false)
  // ...
}
```

> El módulo "bi" del **landing modular** (`modules-catalog.ts`) sigue mostrando
> "Reportes y BI" — el upsell a Pro vive dentro del propio módulo BI una vez
> activado, no en el landing público. Mantenemos el landing simple.

---

## 6. Fuentes de datos (qué módulos alimentan al BI)

| Módulo          | Tablas / eventos                                | Métricas que produce                              |
|-----------------|-------------------------------------------------|---------------------------------------------------|
| **Invoicing**   | Invoice, InvoiceItem                            | Ventas $/cantidad, ticket promedio, # facturas    |
| **POS**         | PosSale (o equivalente)                         | Ventas POS, vendedor, cajero, descuentos          |
| **Inventory**   | Product, InventoryLot, StockMovement            | Stock actual, valoración, rotación, costo unitario|
| **Customer**    | Customer (en Invoice)                           | Quién compra, recurrencia, ticket por cliente     |
| **Créditos**    | CreditMovement, CreditEntity                    | Saldo otorgado, vencidos, antigüedad de saldo     |
| **Logistics**   | DeliveryOrder, DeliveryOrderItem                | Despachos, demoras, conductor, ruta               |
| **Payday**      | Attendance, PayrollRun                          | Horas trabajadas, costo de mano de obra           |
| **Subscription**| (solo SUPER_ADMIN)                              | MRR plataforma — fuera del BI del cliente         |

**Consecuencia:** el cliente que tiene más módulos activos tiene un BI más rico
automáticamente. Quien solo factura ve "Ventas + Productos + Clientes". Quien
suma POS ve cajeros y desempeño por turno. Y así.

---

## 7. Modelo de datos nuevo (Prisma)

```prisma
model BIDashboard {
  id        String   @id @default(cuid())
  clientId  String
  name      String
  layout    Json     // {cols: 12, rows: [{widgetId, x, y, w, h}, ...]}
  isDefault Boolean  @default(false)
  isShared  Boolean  @default(false)
  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  client   Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
  widgets  BIWidget[]

  @@index([clientId])
  @@map("bi_dashboards")
}

model BIWidget {
  id          String   @id @default(cuid())
  dashboardId String
  type        String   // "kpi" | "line" | "bar" | "pie" | "table" | "heatmap" | "rfm"
  title       String
  query       Json     // {measure, dimensions, filters, dateRange, sortBy, limit}
  options     Json?    // estilos, colores, formato de números
  createdAt   DateTime @default(now())

  dashboard BIDashboard @relation(fields: [dashboardId], references: [id], onDelete: Cascade)

  @@index([dashboardId])
  @@map("bi_widgets")
}

model BISavedSegment {
  id          String    @id @default(cuid())
  clientId    String
  name        String
  entity      String    // "customer" | "product"
  rules       Json
  cachedCount Int       @default(0)
  refreshedAt DateTime?
  createdAt   DateTime  @default(now())

  client    Client       @relation(fields: [clientId], references: [id], onDelete: Cascade)
  campaigns BICampaign[]

  @@index([clientId])
  @@map("bi_segments")
}

model BICampaign {
  id          String   @id @default(cuid())
  clientId    String
  segmentId   String
  channel     String   // "whatsapp" | "email"
  message     String
  scheduledAt DateTime?
  sentAt      DateTime?
  status      String   // "DRAFT" | "SCHEDULED" | "SENT" | "FAILED"
  recipients  Int      @default(0)
  conversions Int      @default(0) // compras post-envío en ventana de 14d

  client  Client         @relation(fields: [clientId], references: [id], onDelete: Cascade)
  segment BISavedSegment @relation(fields: [segmentId], references: [id])

  @@index([clientId, status])
  @@map("bi_campaigns")
}

model BIAlert {
  id         String   @id @default(cuid())
  clientId   String
  name       String
  kind       String   // "threshold" | "anomaly"
  config     Json     // {metric, op, value} o {metric, sensitivity}
  isActive   Boolean  @default(true)
  lastFiredAt DateTime?

  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([clientId, isActive])
  @@map("bi_alerts")
}

model BIForecast {
  id          String   @id @default(cuid())
  clientId    String
  metric      String   // "sales_total" | "demand_<sku>" | "customer_churn"
  granularity String   // "day" | "week" | "month"
  data        Json     // [{date, predicted, lower, upper}]
  computedAt  DateTime @default(now())

  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([clientId, metric, granularity])
  @@map("bi_forecasts")
}
```

---

## 8. UX (estructura de rutas)

```
/dashboard/bi/
├── /                         → Resumen (default)
├── /ventas                   → Dashboard Ventas (Esencial)
├── /productos                → Dashboard Productos (Esencial)
├── /clientes                 → Dashboard Clientes (Esencial)
├── /inventario               → Dashboard Inventario (Esencial)
├── /creditos                 → Dashboard Créditos (Esencial)
├── /explore                  → Builder de vistas (Pro)
├── /dashboards               → Mis dashboards custom (Pro)
├── /dashboards/[id]          → Vista/edición de dashboard custom (Pro)
├── /forecasts                → Predicciones y simulaciones (Pro)
├── /segments                 → Segmentos guardados (Pro)
├── /campaigns                → Campañas activas e históricas (Pro)
├── /alerts                   → Alertas configuradas
└── /exports                  → Exportes programados
```

Cada ruta verifica `client.biEnabled` (todas) y `client.biProEnabled` (las marcadas como Pro). Si falta el flag, se muestra una página de upsell con preview de la feature.

---

## 9. Roadmap por fases

### Fase 1 — BI Esencial MVP (4-6 semanas)
**Objetivo:** que un cliente pueda activar `bi`, abrir `/dashboard/bi/`, ver 6 dashboards prediseñados, exportar y configurar alertas básicas.

- Vistas materializadas: `mv_sales_daily`, `mv_product_performance`, `mv_customer_summary`, `mv_inventory_snapshot`, `mv_credit_aging`.
- Endpoint `POST /api/bi/query` con DSL básico.
- 6 dashboards prediseñados (Resumen, Ventas, Productos, Clientes, Inventario, Créditos).
- Exportes Excel/PDF on-demand y programados.
- Alertas por umbral integradas al sistema de notificaciones existente.
- Catálogo: addon `bi` activable; flag `biEnabled` en `Client`.
- Migración Prisma.

### Fase 2 — Builder y dashboards custom (4 semanas)
**Objetivo:** activar `biPro`. Cliente puede crear su propio dashboard arrastrando dimensions/measures sobre visualizaciones.

- Catálogo de dimensions y measures (archivo único, source of truth).
- UI del builder (`/explore`) con preview en vivo.
- `BIDashboard` + `BIWidget` con grid layout (`react-grid-layout`).
- Cross-filtering y drill-down.
- Compartir dashboards con equipo.
- Catálogo: addon `biPro` activable; flag `biProEnabled`.

### Fase 3 — Predicción y campañas (6 semanas)
**Objetivo:** Pro completo. Forecast, segmentos, campañas conectadas con WhatsApp/email.

- Servicio de forecast (heurístico: media móvil + estacionalidad).
- `BIForecast` con cron de cómputo diario.
- Productos en riesgo / Clientes en riesgo (vistas derivadas).
- RFM segmentation.
- `BISavedSegment` + builder de reglas.
- `BICampaign` con integración a `whatsapp` addon y email service.
- Métricas de conversión post-campaña (ventana 14d).

### Fase 4 — Avanzado (post-MVP)
- Alertas inteligentes (anomalías, 3σ).
- Análisis de canasta.
- Cohort retention.
- Simulador what-if.
- Q&A en lenguaje natural sobre los datos (vía AI Gateway).

---

## 10. Riesgos / preguntas abiertas

| # | Pregunta                                                          | Mi propuesta                                              |
|---|-------------------------------------------------------------------|-----------------------------------------------------------|
| 1 | Precios exactos: $25 / $59 ¿van?                                  | Sí, alineados con `creditos` y addons existentes          |
| 2 | ¿Pro incluye Esencial automáticamente o requiere ambos flags?     | Pro incluye. Activar `biPro` activa `bi`                  |
| 3 | ¿Cómo se relacionan los "Reportes básicos" del plan con BI?       | Plan trae stats sueltos en cada módulo; BI los consolida  |
| 4 | ¿Forecasts heurísticos vs ML real?                                | Heurística para MVP; arquitectura permite swap a ML después|
| 5 | ¿Permisos finos (CEO ve todo, jefe sucursal solo lo suyo)?        | Fase 2: rol "view" vs "edit"; permisos granulares en F4   |
| 6 | ¿Cuándo movemos a warehouse separado?                             | Cuando un cliente Enterprise pase de 1M facturas/año      |
| 7 | ¿BI requiere algún módulo previo (Facturación, Inventario)?       | No es obligatorio pero el valor depende del módulo activo |
| 8 | ¿Captura de datos para campañas usa `whatsapp` addon o standalone?| Reusar `whatsapp` y email — no duplicar canales           |

---

## 11. Por qué este diseño y no otro

- **Dos addons en lugar de un tier en `creditos`-style:** mantiene simple el tipo `tiered` (volumen) y usa `fixed` (nivel de feature). Más legible.
- **Vistas materializadas en Postgres en lugar de warehouse:** menos infra, mismo lenguaje, suficiente escala para PyME. Migración a warehouse cuando duela, no antes.
- **Heurística antes que ML:** un PyME panameño no necesita Prophet — necesita "qué SKU se va a quedar sin stock". Una media móvil + estacionalidad acierta el 80% con 0% de complejidad operativa.
- **Power BI como inspiración, no como objetivo:** el cliente promedio nunca usó DAX. Le damos la promesa ("entiende y predice tu negocio") sin la curva de aprendizaje.
- **Conectado, no acoplado:** BI lee de las tablas existentes vía vistas. Cada módulo sigue siendo dueño de su escritura. Si Inventory cambia su schema, ajustamos la vista materializada — no rompemos BI.
- **Tier honesto:** Esencial = mira. Pro = mira, predice, actúa. La línea es clara para el cliente y para el equipo de ventas.

---

## 12. Próximos pasos (esta sesión)

1. **Owner revisa el spec** y confirma:
   - Modelo de tiers (dos addons, Pro incluye Esencial).
   - Pricing ($25 / $59).
   - Alcance del MVP (Fase 1) y orden de fases.
2. Si OK → escribir el plan ejecutable en `docs/superpowers/plans/2026-05-10-bi-module.md` con tareas atomizadas.
3. Implementación arranca por Fase 1 (vistas materializadas + 6 dashboards + addon `bi`).

---

## 13. Archivos que tocaría la Fase 1

- `lib/constants/plans.ts` — añadir addons `bi` y `biPro`, helpers de gating.
- `prisma/schema.prisma` — añadir `biEnabled`, `biProEnabled` en `Client` + modelos `BIDashboard`/`BIWidget`/`BIAlert`.
- `prisma/migrations/2026XXXXXX_bi_essential/` — migración + creación de vistas materializadas.
- `features/bi/` — nuevo módulo (model/services/repositories, ui/components, actions.ts, index.ts).
- `app/api/bi/query/route.ts` — endpoint del DSL.
- `app/dashboard/bi/` — rutas y páginas.
- `components/dashboard/sidebar.tsx` (o equivalente) — entrada de menú "BI" detrás del flag `biEnabled`.
- `lib/limits/` — gating de rutas Pro detrás de `biProEnabled`.
