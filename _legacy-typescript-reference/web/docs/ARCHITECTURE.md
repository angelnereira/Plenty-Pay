# Arquitectura de PlentyPay

## Visión General

PlentyPay es una plataforma SaaS de facturación electrónica certificada para Panamá, construida con Next.js 15 y una arquitectura modular por dominios (Feature-First Architecture).

---

## Stack Tecnológico

> **Estado: Producción 100% Operativo (Abril 2026)**

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Frontend** | Next.js + React + TypeScript | 15.5.9 / 19.2.1 |
| **Estilos** | Tailwind CSS v4 + Shadcn/UI | 4.x |
| **Backend** | Next.js Server Actions + API Routes | - |
| **Base de Datos** | PostgreSQL (Neon) + Prisma ORM | 6.19.2 |
| **Autenticación** | NextAuth v5 (JWT) | 5.0.0-beta.30 |
| **Cache / Rate Limiting** | Upstash Redis | - |
| **AI Gateway** | Vercel AI Gateway + AI SDK | - |
| **Estado (Server)** | TanStack Query | 5.90 |
| **Estado (Client)** | Zustand + React Context | 5.0 |
| **Encriptación** | AES-256-CBC, bcryptjs | - |
| **Integración Fiscal** | SOAP Web Services (HKA) | v1.0 |
| **Biometría** | TensorFlow.js + face-api | 4.22 / 1.7 |
| **Monitoreo** | Sentry | 10.29 |
| **Deploy** | Vercel Edge Network (crons nativos) | - |

---

## Estructura del Proyecto

```
plentypay-app/
├── app/                         # Next.js App Router
│   ├── api/                     # API Routes (externos)
│   ├── actions/                 # Server Actions
│   ├── dashboard/               # UI protegido
│   ├── auth/                    # Páginas de autenticación
│   └── payday/                  # Kiosko de asistencia
│
├── core/                        # Infraestructura central
│   ├── auth/                    # Configuración NextAuth
│   ├── database/                # Cliente Prisma
│   └── middleware/              # Middleware utilities
│
├── features/                    # Módulos de dominio
│   ├── admin/                   # Panel administrativo
│   ├── auth/                    # Lógica de autenticación
│   ├── bio/                     # Biometría facial
│   ├── clients/                 # Gestión de clientes
│   ├── config/                  # Configuración sistema
│   ├── hka/                     # Integración HKA (PAC)
│   ├── inventory/               # Control de inventario
│   ├── invoicing/               # Facturación electrónica
│   ├── logistics/               # Órdenes de entrega y distribución
│   ├── notifications/           # Sistema de notificaciones
│   ├── payday/                  # Control de asistencia
│   ├── pos/                     # Punto de venta
│   ├── subscription/            # Suscripciones SaaS
│   └── support/                 # Soporte al cliente
│
├── shared/                      # Código compartido
│   ├── ui/                      # 35 componentes (Radix + CVA)
│   ├── hooks/                   # Custom hooks
│   ├── lib/                     # Utilidades compartidas
│   └── types/                   # TypeScript definitions
│
├── components/                  # Componentes globales
│   ├── landing/                 # Sistema de diseño de marketing
│   ├── dashboard/               # Layout y navegación
│   └── ui/                      # Primitivas extendidas
│
├── lib/                         # Utilidades y servicios
├── prisma/                      # Schema y migraciones
└── docs/                        # Documentación técnica
```

---

## Principios Arquitectónicos

### 1. Feature-Based Architecture

Cada dominio de negocio se organiza en su propia carpeta con estructura consistente:

```
features/invoicing/
├── model/              # Tipos, schemas Zod, servicios
│   ├── services/       # Lógica de negocio
│   ├── repositories/   # Acceso a datos (Prisma)
│   └── types/          # TypeScript types
├── ui/                 # Componentes React
├── actions.ts          # Server Actions del módulo
└── index.ts            # Barrel export
```

### 2. Separation of Concerns

| Capa | Responsabilidad |
|------|-----------------|
| **API Route** | HTTP, autenticación, validación de entrada |
| **Server Action** | Mutaciones internas, revalidación de cache |
| **Service** | Lógica de negocio pura |
| **Repository** | Acceso a datos (Prisma) |

### 3. Barrel Pattern

```typescript
// Import limpio
import { InvoiceService } from '@/features/invoicing';

// Evitar
import { InvoiceService } from '@/features/invoicing/model/services/invoice.service';
```

---

## Multi-Tenancy

El sistema es multi-tenant con aislamiento por `clientId`:

- Cada organización (Client) tiene sus propios usuarios, facturas y configuración
- Las queries filtran automáticamente por `clientId`
- Los roles son: `SUPER_ADMIN` (PlentyPay) y `CLIENT` (usuarios normales)

### Patrón de Aislamiento

```typescript
// OBLIGATORIO en todas las queries de negocio
const invoices = await prisma.invoice.findMany({
  where: { clientId: session.user.clientId }
});
```

---

## Flujo de Datos

```
Usuario → UI → API Route/Server Action → Service → Repository → Prisma → PostgreSQL
                       ↓
                 HKA Service (SOAP)
                       ↓
                   DGI Panamá
```

---

## Patrones de Diseño

### Server Actions

```typescript
'use server'
export async function createInvoice(data: CreateInvoiceDTO) {
  const session = await auth();
  if (!session) throw new Error('No autorizado');
  
  const service = new InvoiceService();
  const invoice = await service.create(data, session.user.clientId);
  
  revalidatePath('/dashboard/facturas');
  return invoice;
}
```

### Repository Pattern

```typescript
export class InvoiceRepository {
  async findByClientId(clientId: string) {
    return prisma.invoice.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
```

### Component Strategy

1. **Server Components (Default)**: Para fetching de datos e initial rendering
2. **Client Components (`'use client'`)**: Solo para interactividad (Forms, Modals)
3. **Shared UI**: Primitivas en `@/shared/ui` (no hardcodear estilos)

---

## Módulos Principales

### AI Support Assistant

Asistente de soporte inteligente integrado en la plataforma:

- **Vercel AI Gateway**: Enrutamiento de modelos LLM con fallback automático
- **Streaming**: Respuestas en tiempo real via Vercel AI SDK (`streamText`)
- **Soporte contextual**: Accede a documentación interna y datos del cliente para respuestas precisas
- **Endpoint**: `features/support/` + `app/api/support/`

---

### Background Jobs / Crons

Los trabajos en segundo plano se ejecutan como **Vercel Crons nativos** (reemplazaron BullMQ/Railway en v1.5.0):

| Tarea | Frecuencia | Descripción |
|-------|-----------|-------------|
| Sync folio pool | Diario | Sincroniza folios disponibles con HKA |
| Invoice retry | Cada 15 min | Reintenta facturas fallidas |
| Subscription renewal | Diario | Gestiona renovaciones y expiración de planes |
| BI refresh views | Cada 30 min | `refresh_bi_views()` — vistas materializadas del módulo BI |
| BI alerts evaluate | Cada hora | Evalúa alertas por umbral, dispara notificaciones |
| BI Pro refresh | Diario 4 AM | Recálcula segmentos + forecast de cada cliente con `biProEnabled` |

Todos protegidos con `Bearer CRON_SECRET` y `withSentryCron` wrapper.
Configuración en `vercel.json` → sección `crons`.

---

### Módulo BI (Business Intelligence)

Capa transversal de analítica. Stack en 5 capas:

1. **Fuentes** — tablas existentes (Invoice, InvoiceItem, Product,
   Customer, MotorEntity, MotorLedgerEntry).
2. **Read models** — 5 vistas materializadas Postgres particionadas
   por `client_id`: `mv_bi_sales_daily`, `mv_bi_product_performance`,
   `mv_bi_customer_summary`, `mv_bi_inventory_snapshot`,
   `mv_bi_credit_aging`. Refresco `CONCURRENTLY` por cron.
3. **DSL** — `POST /api/bi/query` recibe `{measures, dimensions, filters,
   dateRange, sortBy, limit}` y genera SQL parametrizada con whitelist
   estricta de identifiers (jamás interpolación de input). El
   `clientId` siempre viene del contexto del servidor.
4. **Servicios de inteligencia** (`features/bi/model/services/`):
   `QueryService`, `AlertService`, `ForecastService`, `SegmentService`,
   `AnomalyService`, `CohortService`, `BasketService`, `AskService`.
5. **UI** — `/dashboard/bi/*` con SSR de Server Components y widgets
   reusables. Subnav `BITabs` con tabs Esencial siempre visibles y
   tabs Pro con badge "Pro" + paywall si `biProEnabled=false`.

**Gating:**
- `requireBIAccess()` → notFound si `biEnabled=false` y `biProEnabled=false`.
- `requireBIProAccess()` → notFound si `biProEnabled=false`.
- Reglas de catálogo: `biPro requires bi` (activar Pro auto-activa
  Esencial; desactivar Esencial auto-desactiva Pro).

**Seguridad multi-tenant del Q&A AI:** el modelo nunca ve SQL. Patrón
intent+dispatcher con Zod schema — el modelo clasifica la pregunta en
uno de 7 intents canónicos y el dispatcher ejecuta queries seguras.

**Spec completo:** `docs/superpowers/specs/2026-05-10-bi-module-design.md`

---

### Caching & Rate Limiting (Upstash Redis)

Upstash Redis provee tres funciones principales:

1. **Rate Limiting**: Protege endpoints de abuso (`core/middleware/rate-limit.ts`)
2. **Distributed Locking**: Previene procesamiento concurrente de facturas
3. **Catalog Cache**: Cache de catálogos DGI (tipos de doc, impuestos) con TTL de 24h

---

### HKA Integration (Facturación Electrónica)

Implementa patrón **Facade** para abstracción del PAC:

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

#### Motor de Reconciliación DGI

Pre-valida documentos antes de enviarlos a HKA para prevenir errores de secuencia DGI (códigos 2500-2507):

- Verifica correlatividad de `numeroDocumentoFiscal`
- Detecta huecos en la secuencia y los repara antes de la emisión
- Evita rechazos DGI por documentos fuera de secuencia
- Implementado en `features/hka/model/services/hka-reconciliation.service.ts`

### Registro Modular

Flujo de onboarding rediseñado en v1.6.0:

```
Landing (selección de módulos)
    → URL params: ?modules=billing,inventory&cycle=monthly
    → /auth/signup (form pre-cargado con módulos seleccionados)
    → POST /api/auth/register (crea Client + User + HKACredential)
    → Verificación de email
    → Aprobación admin
```

Campos clave en el registro:
- `modules[]`: Array de módulos seleccionados (`billing`, `inventory`, `pos`, `logistics`, `people`, `bi`)
- `hkaTokenUser` / `hkaTokenPassword`: Credenciales HKA capturadas si se selecciona `billing`; se almacenan encriptadas (AES-256-CBC), ambiente siempre PROD
- `lastInvoiceNumber`: Número de última factura emitida para continuidad de secuencia en `Client.lastInvoiceNumber`

### Payday (Control de Asistencia)

Sistema biométrico Edge AI con reconocimiento facial:

- Procesamiento local con TensorFlow.js
- Detección de vida (anti-spoofing)
- Modo Kiosko para tablets
- Sincronización offline de descriptores

### POS (Punto de Venta)

Optimizado para retail de alto volumen:

- Interfaz táctil rápida
- Integración con lectores de código de barras
- Modo offline-first
- Sincronización automática

### Logistics (Órdenes de Entrega)

Gestión completa del ciclo de vida de entregas:

```
features/logistics/
├── model/
│   ├── services/
│   │   └── delivery-order.service.ts   # Lógica de negocio principal
│   ├── types/
│   │   └── index.ts                    # TypeScript types y DTOs
│   └── index.ts                        # Barrel export
└── ui/
    ├── DeliveryOrdersClientList.tsx     # Listado con filtros
    ├── DeliveryOrderDetailClient.tsx    # Vista detallada
    ├── orders/
    │   ├── CreateDeliveryOrderModal.tsx # Creación directa
    │   └── CreateFromInvoiceModal.tsx   # Creación desde factura
    └── pdf/
        └── DeliveryOrderPDF.tsx         # Generación de PDF
```

**Flujo de estados:**
```
DRAFT → PENDING → IN_PICKING → READY_TO_SHIP → IN_TRANSIT → DELIVERED
                                                              ↓
                        CANCELLED ←──────────────────────────────
```

**Características clave:**
- Dos modos de creación: directa (`DIRECT`) o desde factura (`FROM_INVOICE`)
- Deducción automática de inventario con Optimistic Concurrency Control
- Generación de códigos secuenciales (`OE-YYYY-NNNNNN`)
- QR tokens HMAC-SHA256 para tracking
- Audit trail completo vía `DeliveryEvent` y `DeliveryOrderStatusHistory`
- Generación de PDF para documentos de entrega
- Soporte para transportistas, conductores, vehículos y condiciones de envío

---

## Convenciones de Código

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| **Archivos** | kebab-case | `invoice-service.ts` |
| **Clases/Tipos** | PascalCase | `InvoiceService` |
| **Funciones/Variables** | camelCase | `createInvoice` |
| **Constantes** | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| **Commits** | Conventional Commits | `feat:`, `fix:`, `chore:` |

---

## Cómo Agregar un Nuevo Módulo

1. **Database**: Agregar modelos en `prisma/schema.prisma` con `clientId`
2. **Feature**: Crear `features/[module]/` con estructura estándar
3. **Routing**: Crear `app/dashboard/[module]/page.tsx`
4. **Navigation**: Actualizar sidebar y bottom-nav
5. **Permissions**: Agregar feature flag al modelo Client

---

*Última actualización: Abril 2026*
