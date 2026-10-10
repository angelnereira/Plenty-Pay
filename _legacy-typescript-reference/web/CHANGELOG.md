# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-05-10 — BI Suite completa

### Added — Módulo BI (Business Intelligence)

Cerebro analítico de PlentyPay. Empaquetado en dos addons del catálogo:
- **BI Esencial** (`bi`, $25/mes) — monitoreo y reportes prediseñados.
- **BI Pro** (`biPro`, $59/mes, `requires: "bi"`) — todo lo anterior
  más builder de vistas custom, predicción, segmentación, campañas,
  anomalías, cohortes, análisis de canasta y Q&A en lenguaje natural.

#### Catálogo + schema
- `lib/constants/plans.ts`: addons `bi` y `biPro` con dependencia
  declarativa (`requires`). Helpers `isBIEnabled` / `isBIProEnabled`.
- `Client.biEnabled` / `Client.biProEnabled`.
- Modelos Prisma nuevos: `BIAlert`, `BIDashboard`, `BIWidget`,
  `BISavedSegment`, `BICampaign`, `BIForecast`.
- Migración 20260510130000 (Fase 1: alerts + 3 vistas materializadas).
- Migración 20260510140000 (Fase 1.5: vistas inventory + credit).
- Migración 20260510150000 (Fase 2: dashboards custom).
- Migración 20260510160000 (Fase 3: segmentos + campañas + forecasts).

#### Vistas materializadas Postgres
- `mv_bi_sales_daily`, `mv_bi_product_performance`,
  `mv_bi_customer_summary`, `mv_bi_inventory_snapshot`,
  `mv_bi_credit_aging`. Función `refresh_bi_views()` invocada por
  cron cada 30 min (REFRESH CONCURRENTLY, sin bloquear lecturas).

#### Servicios (todos en `features/bi/model/services/`)
- `BIQueryService` — DSL → SQL parametrizado con whitelist estricta
  de identifiers y `clientId` forzado del contexto.
- `AlertService` — alertas por umbral con cooldown 24h.
- `ForecastService` — heurística media móvil 7d + estacionalidad
  semanal + banda ±1σ.
- `SegmentService` — resolución de reglas RFM contra
  mv_bi_customer_summary + `previewRFM()` con 4 buckets estándar.
- `AnomalyService` — detección 3σ sobre media móvil 14d.
- `CohortService` — matriz cohort × delta_months desde invoices.
- `BasketService` — pares de SKUs con support/confidence/lift.
- `AskService` — Q&A intent+dispatcher con AI Gateway. El modelo
  clasifica con Zod schema y nunca ve SQL.

#### Endpoints REST
- `POST /api/bi/query` (DSL), `POST /api/bi/export` (xlsx/pdf).
- `GET|POST /api/bi/alerts` + `PATCH|DELETE /api/bi/alerts/[id]`.
- `GET|POST /api/bi/dashboards` + `[id]` + `[id]/widgets`.
- `GET|POST /api/bi/forecast`.
- `GET|POST /api/bi/segments` + `GET|DELETE /api/bi/segments/[id]`.
- `GET|POST /api/bi/campaigns` + `PATCH|DELETE /api/bi/campaigns/[id]`.
- `GET /api/bi/anomalies`, `GET /api/bi/cohorts`, `GET /api/bi/basket`.
- `POST /api/bi/ask` (rate-limited contra aiRatelimit del proyecto).

#### Crons
- `/api/cron/bi-refresh` (cada 30 min) — refresh de vistas.
- `/api/cron/bi-alerts` (cada hora) — evalúa alertas y notifica.
- `/api/cron/bi-pro-refresh` (4 AM diario) — recálcula segmentos y
  forecast de cada cliente con biProEnabled.

#### UI (`/dashboard/bi/*`)
**Esencial:** Resumen, Ventas, Productos, Clientes, Inventario,
Créditos, Alertas.
**Pro:** Mis tableros, Explorador (builder drag&drop), Predicción,
Segmentos, Campañas, Anomalías, Cohortes, Canasta, Pregúntale.
- `BITabs` con badge "Pro" en las exclusivas.
- Cada página Pro tiene paywall si `biProEnabled=false`.
- Widgets reusables: `KpiCard`, `BILineChart`, `TopList`,
  `DataTable`, `SectionCard`, `ForecastChart`, `CohortHeatmap`,
  `ExportButton`, `PeriodFilter`.

#### Admin & integración
- `client-modules-panel.tsx`: toggles `bi` y `biPro` con regla
  `biPro requires bi` enforzada en UI y backend.
- Sidebar añade entry "BI" detrás del flag `biEnabled` consolidado
  (bi || biPro).
- `subscription` UI extiende `ADDON_VISUAL` con iconos BarChart3 y
  Brain para los dos addons.

### Fixed
- `POST /api/support/upgrade-request`: la validación de
  `requestedCreditTier` rechazaba a clientes que ya tenían Créditos
  activo y solo querían cambiar de tier. Ahora se acepta si el
  cliente ya tiene `creditosEnabled` aunque "creditos" no esté en
  `requestedModules`.

### Changed
- Landing: imagen ilustrativa del módulo Créditos y del módulo BI
  (eliminado `feature_security_shield.png` huérfano).

### Docs
- `docs/superpowers/specs/2026-05-10-bi-module-design.md` (spec).
- `docs/superpowers/plans/2026-05-10-bi-module.md` (plan ejecutable).

---

## [1.6.1] - 2026-05-10

### Added
- feat(plans): `priceYearlyCents` por plan en el catálogo (`lib/constants/plans.ts`) con ~17% de descuento sobre 12 meses. Helpers `getPlanPriceCents`, `getPlanMonthlyEquivalentCents`, `getYearlySavingsCents`, `formatBillingPeriod`.
- feat(schema): `BillingPeriod` enum (MONTHLY / YEARLY) y columna `Client.billingPeriod` con default MONTHLY (migración `20260510120000_billing_period`). Sin uso aún en el flujo — preparación para el cobro anual real.
- feat(landing): módulo de Créditos a Clientes añadido al checkout modular del landing y al `MODULE_IDS` del endpoint `/api/auth/register`. Tarjeta con tier pricing ($49.99/$74.99/$99.99 según número de clientes con crédito activo) y modal de detalle con casos de uso.
- feat(creditos): rediseño del detalle de entidad — hero + toolbar de acciones + modal de 3 fases (input → preview → confirm) para todas las operaciones del ledger; "Cargo" desaparece de la UI (unificado con Otorgar crédito).

---

## [1.6.0] - 2026-04-22

### Added
- feat: registro modular con checkout (landing → signup con módulos seleccionados)
- feat: captura de credenciales HKA en registro (tokenEmpresa + tokenPassword encriptados, ambiente PROD)
- feat: número de última factura emitida para continuidad de secuencia (`Client.lastInvoiceNumber`)
- feat(ui): precio y botones de módulos como overlay sobre imagen ilustrativa (tarjetas compactas)
- chore: establecimiento de rama staging (`claude/setup-staging-environment-ODcO9`)

### Fixed
- fix(ui): desbordamiento horizontal en `auth-shell` en móvil (`overflow-x-hidden` + `overflow-hidden` en form card)
- fix(ui): badge de ciclo de facturación y precios en tarjeta "Tu Plan" ya no se cortan

---

## [1.5.0] - 2026-04-01

### Added
- feat: Upstash Redis para rate limiting, distributed locking y catalog caching
- feat(ai): Vercel AI Gateway + asistente de soporte inteligente con streaming
- feat(landing): rediseño completo como ERP modular con pricing en vivo y sin free tier
- feat(landing): checkout modular (selección de módulos → registro directo)
- feat(invoicing): sorting premium, flujo de creación unificado, hardening fiscal
- feat(hka): motor de reconciliación DGI para prevenir errores 2500-2507
- feat(auth): persistencia real de sesión PWA
- feat(navigation): nav móvil personalizado para super admins

### Changed
- refactor: reemplazo de BullMQ/Railway con Vercel crons nativos y background jobs

### Fixed
- fix(deps): upgrade eslint-config-next 15.5.9 (resuelve CVE de Railway)

### Technical Stack
- Next.js 15.5.9 / React 19.2.1 / Prisma 6.19.2

---

## [1.4.0] - 2026-03-12

### Added
- **Logistics Module**: Complete delivery order lifecycle management
  - Delivery order CRUD with full data capture (90+ fields)
  - Create orders directly or from existing invoices (`FROM_INVOICE` mode)
  - Sequential order code generation (`OE-YYYY-NNNNNN`)
  - QR token generation (HMAC-SHA256) for order tracking
  - Status workflow: DRAFT → PENDING → IN_PICKING → READY_TO_SHIP → IN_TRANSIT → DELIVERED
  - Full audit trail via `DeliveryEvent` and `DeliveryOrderStatusHistory`
  - PDF generation for delivery documents using `@react-pdf/renderer`
  - Automatic inventory deduction with Optimistic Concurrency Control (OCC)
  - Product search integration from inventory module
  - Invoice search for creating orders from existing invoices
  - Carrier and driver management with vehicle tracking
  - Shipping conditions: mode, incoterm, temperature control, hazardous materials
- **Database Models**: Added `Carrier`, `Driver`, `DeliveryOrder`, `DeliveryOrderItem`, `DeliveryOrderStatusHistory`, `DeliveryEvent`, `QRScanLog`
- **API Endpoints**: 7 new logistics endpoints under `/api/logistics/`
- **Neon Serverless Integration**: Logistics module integrated with Neon serverless adapter

### Fixed
- Auth: Fixed `useSession` crash in modals by adding client session provider
- Auth: Reverted to native Prisma client to resolve serverless edge runtime crashes in NextAuth
- Upgrades: Synchronized logistics & legacy modules across upgrade API, UI
- Upgrades: Properly overwrite frozen NextAuth session on the fly to propagate DB privileges
- Sidebar: Added missing Truck icon import for logistics menu item
- Logistics: Made all non-essential form fields optional
- Logistics: Resolved lint errors in service and status route
- Logistics: Fixed PDF generation failing in Vercel serverless environment
- HKA: Auto-heal duplicate invoice errors silently

### Changed
- Updated admin configuration to include logistics module
- Added logistics to mobile navigation
- Updated documentation suite to March 2026
- Database schema expanded to 68 Prisma models

---

## [1.3.0] - 2026-01-19

### Added
- **Payday Kiosk Improvements**: QR session management, camera permissions handling, lunch break system
- **Business Intelligence Dashboard**: Real-time analytics, MRR tracking, user activity monitoring
- **Notifications 2.0**: Web Push API integration, temporal grouping, read confirmations
- **Premium UI Refinements**: Facturas page redesign, enhanced mobile layouts

### Changed
- Consolidated architecture documentation (merged `ARCHITECTURE_SUMMARY.md` into `docs/ARCHITECTURE.md`)
- Cleaned up obsolete planning documents
- Updated all documentation to January 2026

### Removed
- `ARCHITECTURE_SUMMARY.md` (content merged into docs/ARCHITECTURE.md)
- `PAYDAY_IMPLEMENTATION_PLAN.md` (module fully implemented)
- `admin_enhancement_plan.md` (features completed)
- Redundant HKA internal documentation

### Technical Stack
- Next.js 15.5.7
- React 19.2.1
- Prisma 6.17.1
- TensorFlow.js 4.22.0

---

## [1.2.0] - 2025-12-17

### Added
- **Production Release**: Official deployment of PlentyPay (v1.0.0 stable)
- **HKA Integration**: Full 15-rule compliance engine (SOAP/XML)
- **Folio Management**: Automated folio tracking with low-stock alerts
- **PWA**: Offline-first architecture with background sync
- **Multi-Tenancy**: Data isolation strategy implementation
- **Inventory Module**: Product catalog, stock movements, valuation
- **POS Module**: Point of sale with barcode reader support

### Changed
- System status upgraded to "Production Stable"
- Automated DGI certification workflow
- Updated documentation suite

### Technical Stack
- Next.js 15.5.7
- React 19.2.1
- Prisma 6.17.1
- NextAuth 5.0.0-beta.30

---

## [1.1.0] - 2025-12-14

### Added
- Structured Logger: Replaced `console.log` with Pino for redacted, secure logging
- Documentation reorganization (Architecture, API, Security)

### Changed
- Unified versioning across `package.json` and documentation
- Standardized Prisma imports to single singleton instance

### Security
- Removed sensitive logs exposing tokens in production
- Consolidated duplicate code in features modules

---

## [1.0.1] - 2025-12-03

### Security
- **Critical (CVE-2025-55182)**: Patched RCE vulnerability in React Server Components
- Upgraded Next.js (15.5.7) and React (19.1.2)

---

## [1.0.0] - 2025-12-02

### Added
- **HKA Compliance Engine**: Catalog validation and formatting core
- **Database Schema**: Added `otiCode` and `otiAmount` for tax compliance

### Changed
- Refactored invoice mapper to use centralized compliance core
- Implemented exact calculation formula for item totals

### Fixed
- Fixed error 109 (validation failures) by implementing strict catalog checks

---

## [0.9.0] - 2025-12-01

### Changed
- **Dashboard UI**: Refactored KPI cards for high-density display
- Improved mobile responsiveness for dashboard grid

---

## [0.8.0] - 2025-11-12

### Added
- Multi-tenant digital certificate storage (P12/PFX)
- XMLDSig signing module (RSA-SHA256)
- Certificate management API endpoints

---

## [0.7.0] - 2025-11-11

### Added
- Initial verified release with basic invoicing capabilities
- Docker configuration
- Initial documentation set
