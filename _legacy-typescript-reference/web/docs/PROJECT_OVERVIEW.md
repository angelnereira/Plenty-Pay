# PlentyPay - Project Overview

> **Status: Production Stable** | Version: 1.6.0 | Abril 2026

---

## System Description

**PlentyPay** is a DGI-certified SaaS platform for electronic invoicing and business operations in Panama. It enables enterprises to issue, manage, and control fiscal documents, manage inventory, process point-of-sale transactions, and coordinate delivery logistics — all in full compliance with Panamanian regulations through a cloud-native architecture.

---

## Architectural Overview

### Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Frontend** | Next.js + React + TypeScript | 15.5.9 / 19.2.1 |
| **Estilos** | Tailwind CSS v4 + Shadcn/UI | 4.x |
| **Backend** | Next.js API Routes + Server Actions | - |
| **Base de Datos** | PostgreSQL (Neon Serverless) + Prisma ORM | 6.19.2 |
| **Autenticación** | NextAuth.js | 5.0.0-beta.30 |
| **Estado** | Zustand + TanStack Query | 5.0 / 5.90 |
| **Cache / Rate Limiting** | Upstash Redis | - |
| **AI Gateway** | Vercel AI Gateway + AI SDK | - |
| **Integración Fiscal** | SOAP (HKA) | v1.0 |
| **AI / Biometría** | TensorFlow.js + face-api | 4.22 / 1.7 |
| **Monitoreo** | Sentry | 10.29 |
| **Deploy** | Vercel Edge Network (crons nativos) | - |

### Estructura del Proyecto (Feature-Sliced Design)

```
plentypay-app/
├── app/                    # Next.js App Router (rutas, páginas, API)
│   ├── (marketing)/       # Landing Page y páginas públicas (SEO Optimized)
│   ├── api/               # 24 categorías de endpoints
│   ├── dashboard/         # UI protegido (facturas, inventario, logística, config, admin)
│   └── actions/           # Server Actions
├── core/                  # Infraestructura central
│   ├── auth/             # NextAuth config
│   ├── database/         # Prisma client
│   └── middleware/       # Middleware utilities
├── features/             # Módulos de dominio
│   ├── admin/           # Administración de sistema
│   ├── auth/            # Lógica de autenticación
│   ├── bio/             # Biometría facial
│   ├── clients/         # Gestión de clientes
│   ├── config/          # Configuración del sistema
│   ├── hka/             # Integración HKA (PAC/SOAP)
│   ├── inventory/       # Control de inventario
│   ├── invoicing/       # Facturación electrónica
│   ├── logistics/       # Órdenes de entrega y distribución
│   ├── notifications/   # Sistema de notificaciones
│   ├── payday/          # Control de asistencia biométrico
│   ├── pos/             # Punto de venta
│   ├── subscription/    # Suscripciones SaaS
│   └── support/         # Soporte al cliente
├── shared/              # Código compartido
│   ├── ui/             # 35+ componentes (Radix + CVA)
│   ├── hooks/          # Custom hooks
│   └── types/          # TypeScript definitions
├── components/          # Componentes globales
│   ├── landing/        # Sistema de diseño de marketing & Landing
│   ├── dashboard/      # Layout y navegación
│   └── ui/             # Primitivas extendidas
├── lib/                # Utilidades y servicios
├── prisma/             # Schema (68 modelos), migraciones, seeds
└── docs/               # Documentación técnica
```

---

## HKA Integration (100% Operational)

### Implemented SOAP Methods

| # | Method | Function | Status |
|---|--------|---------|--------|
| 1 | **Enviar** | Fiscal document emission | ✅ Production |
| 2 | **EstadoDocumento** | DGI status query | ✅ Production |
| 3 | **AnulacionDocumento** | Fiscal cancellation | ✅ Production |
| 4 | **DescargaXML** | Signed XML download | ✅ Production |
| 5 | **FoliosRestantes** | Folio control | ✅ Production |
| 6 | **EnvioCorreo** | Email delivery | ✅ Production |
| 7 | **DescargaPDF** | PDF with CAFE | ✅ Production |
| 8 | **RastreoCorreo** | Email tracking | ✅ Production |
| 9 | **ConsultarRucDV** | RUC validation | ✅ Production |

#### DGI Reconciliation Engine

Motor de pre-validación que previene errores de secuencia DGI (códigos 2500-2507) antes de enviar documentos a HKA. Verifica correlatividad de `numeroDocumentoFiscal` y repara huecos de secuencia automáticamente.

### HKA Architecture (Facade Pattern)

```
HKAFacade (features/hka/model/hka.facade.ts)
    ├── emitInvoice()
    ├── checkFolios()
    ├── validateRUC()
    ├── getDocumentStatus()
    ├── downloadPDF()
    ├── downloadXML()
    ├── cancelInvoice()
    └── sendEmail()
```

---

## Database Schema (68 Prisma Models)

### Core Models

| Model | Description |
|--------|-------------|
| `Client` | Organization/Company (multi-tenant root) |
| `User` | Users with roles (SUPER_ADMIN, CLIENT) |
| `Invoice` | Electronic invoices |
| `InvoiceItem` | Invoice lines |
| `Customer` | Invoice receivers |
| `HKACredential` | Encrypted HKA credentials |
| `FolioPool` | Available folio pool |
| `FolioAssignment` | Folio assignments per client |

### Inventory Models

| Model | Description |
|--------|-------------|
| `Product` | Product catalog |
| `InventoryLot` | Batch/lot tracking |
| `InventoryTransaction` | Stock movements |
| `StockMovement` | Granular stock changes |
| `Supplier` | Vendor management |
| `PurchaseOrder` | Purchase orders |
| `GoodsReceipt` | Goods receipt processing |

### Logistics Models

| Model | Description |
|--------|-------------|
| `DeliveryOrder` | Delivery order header (90+ fields) |
| `DeliveryOrderItem` | Line items with quantities, pricing, weight |
| `Carrier` | Shipping companies |
| `Driver` | Delivery drivers with license info |
| `DeliveryOrderStatusHistory` | Status change audit trail |
| `DeliveryEvent` | Full event log (creation, status, inventory) |
| `QRScanLog` | QR code scan tracking |

### Multi-Tenancy

- Isolation by `clientId` in all queries
- Roles: `SUPER_ADMIN` (PlentyPay staff) | `CLIENT` (Standard users)
- Independent HKA configuration per client

---

## Core Features

### Electronic Invoicing
- Invoice emission, Credit/Debit Notes
- Multi-input: Excel, manual form
- Automatic CUFE (66 chars)
- Real-time DGI certification

### Inventory Management
- Centralized product catalog with multi-warehouse support
- Full traceability of stock movements (entries, exits, adjustments)
- Real-time inventory valuation and low-stock alerts
- Supplier management and purchase order workflow

### Logistics & Delivery Orders
- Complete delivery order lifecycle (DRAFT → PENDING → IN_PICKING → READY_TO_SHIP → IN_TRANSIT → DELIVERED)
- Create orders directly or from existing invoices
- Automatic inventory deduction with OCC (Optimistic Concurrency Control)
- Carrier and driver assignment with vehicle tracking
- PDF generation for delivery documents
- QR code generation for order tracking
- Full event audit trail and status history
- Support for shipping conditions: temperature control, hazardous materials, incoterms

### Point of Sale (POS)
- Optimized touch interface for high-volume retail
- Barcode reader integration
- Offline-first with automatic sync
- Cart reservation system

### Biometric Attendance (Payday)
- Edge AI facial recognition with TensorFlow.js
- Liveness detection (anti-spoofing)
- Kiosk mode for tablets
- Offline descriptor sync

### PWA & Offline
- Service Worker with aggressive caching
- Delta sync on reconnection
- Installable on devices

### Folio Management
- Availability control
- Low stock alerts
- Usage history

### Analytics & Notifications
- KPI Dashboard with MRR tracking
- Web Push notifications with temporal grouping
- Real-time user activity monitoring
- Audit logs

### AI Support Assistant
- Vercel AI Gateway para enrutamiento de modelos LLM
- Respuestas en streaming via Vercel AI SDK
- Contexto de cliente para soporte personalizado

### BI Suite (v2.0.0)
Módulo transversal de Business Intelligence en dos tiers:
- **BI Esencial** (`bi`, $25/mes) — 6 dashboards prediseñados (Resumen,
  Ventas, Productos, Clientes, Inventario, Créditos), exportes Excel/PDF,
  alertas por umbral con cooldown 24h.
- **BI Pro** (`biPro`, $59/mes, `requires: "bi"`) — builder de vistas
  custom (drag de measures + dimensions), tableros personalizados,
  predicción de ventas (heurística), segmentación RFM + reglas custom,
  campañas WhatsApp/email, anomalías 3σ, cohortes de retención,
  análisis de canasta y Q&A en lenguaje natural vía AI Gateway.

Arquitectura: vistas materializadas Postgres (`mv_bi_sales_daily`,
`mv_bi_product_performance`, `mv_bi_customer_summary`,
`mv_bi_inventory_snapshot`, `mv_bi_credit_aging`) refrescadas por cron,
DSL de query con whitelist estricta de measures/dimensions, servicios
puros (Forecast / Segment / Anomaly / Cohort / Basket / Ask) y UI SSR.

Spec: `docs/superpowers/specs/2026-05-10-bi-module-design.md`

### Modular Registration (v1.6.0)
- Checkout modular en landing: el usuario selecciona módulos antes de registrarse
- Captura de credenciales HKA (`tokenEmpresa` + `tokenPassword`) durante el registro cuando se selecciona Facturación Fiscal; almacenadas con AES-256-CBC, ambiente PROD
- Campo `lastInvoiceNumber` para continuidad de secuencia de facturación

### Background Jobs
- Vercel crons nativos reemplazaron BullMQ/Railway en v1.5.0
- Tareas: sync de folios, reintentos de facturas, renovación de suscripciones

---

## Security

| Aspect | Implementation |
|---------|----------------|
| **Authentication** | NextAuth v5 with JWT |
| **Encryption** | AES-256-CBC for HKA credentials |
| **Passwords** | bcrypt |
| **Validation** | Zod schemas across stack |
| **Rate Limiting** | Upstash Redis (rate limiting, distributed locking, catalog cache) |
| **HTTPS** | Enforced in production |

---

## Related Documentation

| Document | Location |
|-----------|-----------|
| Main README | `/README.md` |
| Architecture | `/docs/ARCHITECTURE.md` |
| Logistics Module | `/docs/LOGISTICS.md` |
| HKA Integration | `/docs/HKA_INTEGRATION.md` |
| API Reference | `/docs/API_REFERENCE.md` |
| Security | `/docs/SECURITY.md` |
| Deployment | `/docs/DEPLOYMENT.md` |
| Staging Workflow | `/docs/STAGING_WORKFLOW.md` |
| Changelog | `/CHANGELOG.md` |

---

## Production Information

| Aspecto | Detalle |
|---------|---------|
| **URL Producción** | https://plentypay.com |
| **Base de Datos** | Neon PostgreSQL |
| **Hosting** | Vercel |
| **HKA Ambiente** | Producción (configurable por cliente) |

---

*Última actualización: Abril 2026 • Versión 1.6.0*
