# PlentyPay - Infraestructura de Facturación Electrónica B2B

<div align="center">

![PlentyPay Banner](public/plentypay-logo.png)

**Plataforma Integral SaaS para la Gestión Fiscal en Panamá**

[![Production](https://img.shields.io/badge/Production-Stable-00c853?style=flat-square&logo=vercel)](https://plentypay.com)
[![Compliance](https://img.shields.io/badge/DGI%20Panamá-Compliant-blue?style=flat-square)](https://dgi.mef.gob.pa)
[![Security](https://img.shields.io/badge/Security-AES--256-critical?style=flat-square&logo=auth0)](https://plentypay.com/security)
[![Version](https://img.shields.io/badge/Version-1.6.0-purple?style=flat-square)](./CHANGELOG.md)

</div>

## Resumen Ejecutivo

PlentyPay es una solución de facturación electrónica de arquitectura moderna ("Cloud-Native") diseñada para resolver las fricciones de la gestión fiscal en Panamá. A diferencia de las soluciones legacy, nuestra plataforma opera bajo un modelo **PWA (Progressive Web App) Offline-First**, garantizando continuidad operativa incluso sin conexión a internet.

Nuestra arquitectura multi-tenant permite escalar desde pequeños comercios (Retail/PYMES) hasta grandes corporaciones, manejando millones de transacciones con latencia sub-100ms y cumplimiento estricto de las normativas de la DGI (Dirección General de Ingresos) a través de integración directa con proveedores PAC.

---

## Arquitectura de Software

El sistema está construido sobre un stack moderno, optimizado para rendimiento, escalabilidad y mantenibilidad a largo plazo.

### Stack Tecnológico (Core)
*   **Frontend / Edge:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions) + React 19
*   **Estilizado / UI:** Tailwind CSS v4 + Shadcn/ui (Diseño atómico, temas dinámicos Dark/Light)
*   **Base de Datos:** PostgreSQL en Neon (Serverless), gestionado por Prisma ORM 6.19.2
*   **Cache / Rate Limiting:** Upstash Redis (distributed locking, rate limiting, catalog cache)
*   **AI / Biometría:** TensorFlow.js + `@vladmandic/face-api` (Client-side inference)
*   **AI Gateway:** Vercel AI Gateway + Vercel AI SDK (asistente de soporte con streaming)
*   **Infraestructura:** Despliegue en Vercel Edge Network (crons nativos, sin Railway/BullMQ)

### Módulos Clave

#### 1. Motor de Facturación (Invoicing Engine)
Implementa el patrón **Adapter** para abstracción de proveedores PAC (The Factory HKA). Esto permite cambiar el proveedor de certificación subyacente sin reescribir la lógica de negocio.
*   **Integración:** SOAP Web Services con validación estricta de esquemas XML (DGI FE v2.0)
*   **Resiliencia:** Cola de reintentos para fallos de red y sincronización automática (Background Sync API)
*   **DGI Reconciliation Engine:** Pre-validación de documentos para prevenir errores 2500-2507 antes de envío a HKA

#### 2. Sistema de Inventario
Control total sobre los activos físicos con una arquitectura reactiva.
*   **Gestión Centralizada:** Catálogo unificado de productos con soporte para múltiples almacenes
*   **Historial Auditado:** Trazabilidad completa de movimientos de stock (entradas, salidas, ajustes)
*   **Smart Analytics:** Cálculo de valoración de inventario en tiempo real y alertas de stock bajo

#### 3. Punto de Venta (POS)
Diseñado para el alto volumen transaccional del retail moderno.
*   **Experiencia Rápida:** Interfaz optimizada para minimizar clicks y agilizar el checkout
*   **Integración Hardware:** Soporte nativo para lectores de códigos de barras
*   **Offline-First:** Continuidad operativa garantizada sin conexión a internet

#### 4. Logística y Órdenes de Entrega
Gestión completa del ciclo de vida de entregas y distribución.
*   **Ciclo Completo:** Workflow de estados desde borrador hasta entrega confirmada (DRAFT → DELIVERED)
*   **Creación Flexible:** Crear órdenes directamente o importar desde facturas existentes
*   **Inventario Integrado:** Deducción automática de stock con control de concurrencia optimista
*   **Documentación:** Generación de PDF para documentos de entrega con datos completos
*   **Trazabilidad:** QR codes, audit trail completo y historial de estados
*   **Transporte:** Gestión de transportistas, conductores, vehículos y condiciones de envío

#### 5. Control de Asistencia Biométrico (Payday)
Sistema de kiosco de asistencia con reconocimiento facial en el borde (Edge AI).
*   **Privacidad:** Procesamiento local en el navegador usando TensorFlow.js
*   **Liveness:** Detección de vida para evitar suplantación (spoofing)
*   **Múltiples métodos:** QR Code, Face ID, teclado numérico

#### 6. Business Intelligence & Analytics
Panel de análisis y monitoreo para Super Admins.
*   **Métricas en Tiempo Real:** Usuarios activos, transacciones por hora
*   **MRR Dashboard:** Ingresos recurrentes por plan
*   **Heatmaps:** Facturación por región y periodo

#### 7. Sistema de Notificaciones 2.0
Notificaciones proactivas con Web Push API.
*   **Push Notifications:** Alertas incluso con la app cerrada
*   **Agrupación Temporal:** "Hoy", "Ayer", "Antiguas"
*   **Feedback Visual:** UI optimista con confirmación de lectura

#### 8. Capa de Marketing & SEO
Landing page modular rediseñada como ERP por suscripción, con pricing en vivo y checkout de módulos.
*   **SSR Completo:** Renderizado del lado del servidor para máxima indexabilidad
*   **Checkout Modular:** El usuario selecciona módulos (Facturación, Inventario, POS, etc.) en el landing y los lleva directamente al registro
*   **Pricing Dinámico:** Precios calculados en tiempo real según módulos y ciclo de facturación (mensual/anual)
*   **SEO Técnico:** Implementación de JSON-LD, Sitemap dinámico y Robots.txt programático
*   **Performance:** LCP < 1.2s y CLS 0.00 (Core Web Vitals optimizados)

#### 9. Asistente de Soporte AI
Asistente inteligente de soporte integrado en la plataforma.
*   **Vercel AI Gateway:** Enrutamiento y gestión de modelos de lenguaje
*   **Streaming:** Respuestas en tiempo real via Vercel AI SDK
*   **Contexto:** Acceso a documentación y datos del cliente para soporte contextualizado

#### 10. Seguridad Bancaria
La confianza es nuestro activo principal. Implementamos seguridad en profundidad:
*   **At-Rest:** Cifrado AES-256-CBC para credenciales sensibles (HKA Tokens)
*   **In-Transit:** TLS 1.3 forzado
*   **Identity:** NextAuth v5 con JWT rotativos y protección CSRF/XSS

#### 11. Business Intelligence (BI Suite)
Cerebro analítico de la plataforma. Empaquetado en dos addons del catálogo:
**BI Esencial** ($25/mes) y **BI Pro** ($59/mes — incluye Esencial).

*   **Esencial — monitoreo:** Resumen, Ventas, Productos, Clientes, Inventario, Créditos. KPIs con delta vs período anterior, drill-down, exportes Excel/PDF y alertas por umbral con cooldown 24h.
*   **Pro — experimentación + activación:**
    - **Builder de vistas custom** con preview en vivo (drag de medidas y dimensiones, similar a Power BI Fields panel).
    - **Tableros personalizados** persistidos (`BIDashboard` + `BIWidget`).
    - **Predicción** de ventas con heurística media móvil 7d + estacionalidad semanal y banda ±1σ.
    - **Segmentación RFM** + builder de reglas custom y vista en vivo de 4 buckets estándar (Champions / At Risk / Hibernating / Big Spenders).
    - **Campañas** dirigidas (canal WhatsApp o email) con tracking de envío y conversiones post-ventana.
    - **Anomalías 3σ** sobre series diarias.
    - **Cohortes de retención** mensuales (heatmap).
    - **Análisis de canasta** con support / confidence / lift.
    - **Q&A en lenguaje natural** vía AI Gateway con patrón intent+dispatcher (el modelo nunca ve SQL).
*   **Arquitectura 5 capas:** vistas materializadas Postgres refrescadas por cron → DSL `/api/bi/query` → servicios → endpoints → UI SSR. Cada query fuerza `clientId` del contexto del servidor.
*   **Tres crons:** refresh vistas (30 min), evaluación de alertas (1h), refresh segmentos+forecast (diario 4 AM). Todos con Bearer `CRON_SECRET` y Sentry wrapper.

---

## Instalación y Desarrollo

Estas instrucciones están destinadas a ingenieros de software que deseen colaborar o auditar el código fuente.

### Prerrequisitos
*   Node.js 20.x (LTS)
*   PostgreSQL 15+ (Local o Docker)
*   Claves de API HKA (Entorno DEMO o PROD)

### Setup Local

```bash
# 1. Clonar el repositorio
git clone git@github.com:plentypay-app/plentypay-app.git
cd plentypay-app

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp env.template .env.local
# Editar .env.local con las credenciales de base de datos y llaves AES

# 4. Inicializar base de datos
npm run db:generate
npm run db:push
npm run db:seed  # Carga datos maestros (Tipos de documento, Impuestos)

# 5. Iniciar servidor de desarrollo
npm run dev
```

---

## Estructura del Proyecto

La arquitectura sigue el principio de "Feature-Sliced Design" para mejorar la cohesión y reducir el acoplamiento.

```text
plentypay-app/
├── app/                    # Next.js App Router (Rutas y Layouts)
│   ├── api/                # API Routes públicas
│   ├── actions/            # Server Actions
│   ├── dashboard/          # Aplicación principal protegida
│   └── payday/             # Módulo de kiosco de asistencia
├── components/
│   ├── landing/            # Sistema de diseño de marketing
│   ├── dashboard/          # Layout y navegación
│   └── ui/                 # Primitivas de interfaz extendidas
├── core/                   # Lógica de negocio pura (Agnóstica del UI)
│   ├── auth/               # Configuración NextAuth
│   └── database/           # Cliente Prisma
├── features/               # Módulos por dominio de negocio
│   ├── hka/                # Integración con proveedor PAC
│   ├── invoicing/          # Facturación electrónica
│   ├── inventory/          # Control de inventario
│   ├── logistics/          # Órdenes de entrega y distribución
│   ├── pos/                # Punto de venta
│   ├── payday/             # Control de asistencia
│   └── ...                 # Otros módulos
├── shared/                 # Código compartido
│   ├── ui/                 # Componentes UI reutilizables
│   └── hooks/              # Custom hooks
├── lib/                    # Utilidades y configuración de librerías
└── prisma/                 # Definiciones de esquema de datos
```

---

## Integración Continua (CI/CD)

Utilizamos GitHub Actions y Vercel para garantizar la calidad del código.
*   **Linting:** ESLint + Prettier (Standard Rules)
*   **Testing:** Jest para pruebas unitarias
*   **Deploy:** Automático a ambiente de Preview por PR, y a Producción en merge a `main`

---

## Documentación

| Documento | Ubicación |
|-----------|-----------|
| Arquitectura | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Visión General | [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) |
| Logística | [docs/LOGISTICS.md](docs/LOGISTICS.md) |
| Integración HKA | [docs/HKA_INTEGRATION.md](docs/HKA_INTEGRATION.md) |
| API Reference | [docs/API_REFERENCE.md](docs/API_REFERENCE.md) |
| Seguridad | [docs/SECURITY.md](docs/SECURITY.md) |
| Deployment | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Staging Environment | [docs/STAGING-ENVIRONMENT.md](docs/STAGING-ENVIRONMENT.md) |
| Staging Workflow | [docs/STAGING_WORKFLOW.md](docs/STAGING_WORKFLOW.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |

---

## Licencia y Propiedad Intelectual

Este software es propiedad intelectual de **PlentyPay**.
El uso no autorizado, distribución o ingeniería inversa está estrictamente prohibido.

Copyright © 2026 PlentyPay. All Rights Reserved.
