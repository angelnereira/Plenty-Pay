# 📚 API Reference

## Autenticación

Todas las APIs requieren autenticación via NextAuth session o API Key.

### Headers

```
Authorization: Bearer <api-key>
Content-Type: application/json
```

---

## Registro

### Registrar Organización

```http
POST /api/auth/register
```

Crea una nueva organización (Client) y su usuario administrador. La organización queda en estado `PENDING` hasta aprobación manual. Se envía un email de verificación al usuario.

**Body:**
```json
{
  "name": "string (min 2 chars) — nombre del usuario",
  "email": "string — email del usuario",
  "password": "string — mínimo 8 chars, 1 letra, 1 número, 1 símbolo",
  "companyName": "string (min 2 chars)",
  "ruc": "string (min 4 chars)",
  "modules": ["billing", "inventory", "pos", "logistics", "people", "bi"],
  "billingCycle": "monthly | yearly (default: monthly)",
  "planType": "CRECIMIENTO | PROFESIONAL | EMPRESARIAL | ENTERPRISE (default: CRECIMIENTO)",
  "hkaTokenUser": "string (opcional) — requerido si modules incluye 'billing'",
  "hkaTokenPassword": "string (opcional) — requerido si modules incluye 'billing'",
  "lastInvoiceNumber": "number (opcional) — último número de factura emitida para continuidad de secuencia"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Solicitud enviada exitosamente",
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "role": "CLIENT",
    "createdAt": "ISO 8601",
    "client": {
      "id": "string",
      "name": "string",
      "slug": "string"
    }
  }
}
```

**Errores:**
- `400` — Email ya registrado
- `400` — RUC ya registrado
- `400` — Validación de campos (Zod)
- `429` — Rate limit excedido

> **Nota**: Las credenciales HKA (`hkaTokenUser`, `hkaTokenPassword`) se almacenan encriptadas con AES-256-CBC. El ambiente siempre es `PROD` — se detecta automáticamente al momento de configurar credenciales.

---

## Facturas

### Crear Factura

```http
POST /api/invoices-v2/create
```

**Body:**
```json
{
  "customerId": "string",
  "items": [
    {
      "description": "string",
      "quantity": "number",
      "unitPrice": "number",
      "taxRate": "number"
    }
  ],
  "paymentMethod": "CASH | CREDIT | TRANSFER | CREDIT_CARD",
  "notes": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "DRAFT | EMITTED",
    "cufe": "string (si emitida)",
    "total": "number"
  }
}
```

### Emitir Factura

```http
POST /api/invoices-v2/{id}/emit
```

Envía la factura a HKA para certificación DGI.

**Response:**
```json
{
  "success": true,
  "data": {
    "cufe": "string",
    "qrCode": "string",
    "protocol": "string"
  }
}
```

### Obtener Factura

```http
GET /api/invoices-v2/{id}
```

### Listar Facturas

```http
GET /api/invoices-v2?status=EMITTED&limit=20&offset=0
```

### Cancelar Factura

```http
POST /api/invoices-v2/{id}/cancel
```

**Body:**
```json
{
  "reason": "string"
}
```

---

## Clientes

### Crear Cliente

```http
POST /api/customers
```

**Body:**
```json
{
  "ruc": "string",
  "dv": "string",
  "name": "string",
  "email": "string",
  "phone": "string",
  "address": "string"
}
```

### Listar Clientes

```http
GET /api/customers?search=texto&limit=50
```

---

## HKA

### Validar RUC

```http
POST /api/hka/validate-ruc
```

**Body:**
```json
{
  "ruc": "string"
}
```

**Response:**
```json
{
  "valid": true,
  "dv": "number",
  "name": "string"
}
```

### Folios Disponibles

```http
GET /api/hka/folios
```

**Response:**
```json
{
  "available": "number",
  "used": "number",
  "total": "number"
}
```

### Estado de Documento

```http
POST /api/hka/status
```

**Body:**
```json
{
  "cufe": "string"
}
```

---

## Server Actions

Las acciones más comunes están implementadas como Server Actions para mejor rendimiento:

```typescript
// Emitir factura completa
import { emitFullInvoice } from '@/app/actions/invoice/emit-full-invoice.action';

const result = await emitFullInvoice({
  customerId: 'xxx',
  items: [...],
  paymentMethod: 'CASH'
});
```

### Acciones Disponibles

| Acción | Descripción |
|--------|-------------|
| `emitFullInvoice` | Crear y emitir factura en un paso |
| `cancelInvoice` | Anular factura |
| `downloadPdf` | Descargar PDF |
| `downloadXml` | Descargar XML |
| `sendEmail` | Enviar factura por correo |

---

## Logística (Órdenes de Entrega)

### Listar Órdenes de Entrega

```http
GET /api/logistics/orders?status=PENDING&search=texto
```

**Query Parameters:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `status` | string | Filtrar por estado (`DRAFT`, `PENDING`, `IN_PICKING`, `READY_TO_SHIP`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`) |
| `search` | string | Buscar por código o nombre de cliente |

**Response:**
```json
[
  {
    "id": "string",
    "code": "OE-2026-000001",
    "status": "PENDING",
    "originMode": "DIRECT",
    "customerName": "string",
    "deliveryAddress": { "text": "string", "lat": 0, "lng": 0 },
    "carrier": { "id": "string", "name": "string" },
    "driver": { "id": "string", "firstName": "string", "lastName": "string" },
    "totalAmount": "150.00",
    "createdAt": "2026-03-12T00:00:00Z"
  }
]
```

### Crear Orden de Entrega

```http
POST /api/logistics/orders
```

**Body:**
```json
{
  "customerName": "string (requerido)",
  "customerPhone": "string",
  "customerEmail": "string",
  "customerRuc": "string",
  "deliveryAddress": { "text": "string", "lat": 0, "lng": 0 },
  "deliveryLocation": "string",
  "scheduledDate": "ISO 8601 datetime",
  "estimatedDate": "ISO 8601 datetime",
  "carrierId": "string",
  "driverId": "string",
  "carrierName": "string",
  "driverName": "string",
  "driverIdDoc": "string",
  "driverLicense": "string",
  "vehiclePlate": "string",
  "insurancePolicy": "string",
  "priority": "Normal | Alta | Urgente",
  "purchaseOrderRef": "string",
  "shippingMode": "Terrestre | Marítimo | Aéreo",
  "incoterm": "string",
  "controlledTemp": false,
  "hazardousMat": false,
  "shippingCost": 0,
  "insuranceCost": 0,
  "emitInvoice": false,
  "notes": "string",
  "items": [
    {
      "productId": "string (opcional, vincula con inventario)",
      "description": "string (requerido)",
      "quantity": 1,
      "unitPrice": 0,
      "taxRate": 0.07,
      "packaging": "string",
      "weightKg": 0,
      "dimensions": "string"
    }
  ]
}
```

**Response (201):**
```json
{
  "id": "string",
  "code": "OE-2026-000001"
}
```

### Crear Orden desde Factura

```http
POST /api/logistics/orders/from-invoice
```

**Body:**
```json
{
  "invoiceId": "string (requerido)",
  "customerName": "string",
  "customerPhone": "string",
  "customerEmail": "string",
  "deliveryAddress": { "text": "string", "lat": 0, "lng": 0 },
  "scheduledDate": "ISO 8601 datetime",
  "carrierId": "string",
  "driverId": "string",
  "notes": "string"
}
```

**Response (201):**
```json
{
  "id": "string",
  "code": "OE-2026-000002"
}
```

### Obtener Orden de Entrega

```http
GET /api/logistics/orders/{id}
```

Retorna el detalle completo de la orden incluyendo ítems, historial de estados, transportista y conductor.

### Actualizar Orden de Entrega

```http
PATCH /api/logistics/orders/{id}
```

**Body:** Campos parciales de la orden (customerName, deliveryAddress, carrierId, notes, etc.)

### Cambiar Estado de Orden

```http
PATCH /api/logistics/orders/{id}/status
```

**Body:**
```json
{
  "status": "IN_TRANSIT",
  "notes": "Salió del almacén"
}
```

**Estados válidos:** `DRAFT`, `PENDING`, `IN_PICKING`, `READY_TO_SHIP`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`

### Generar PDF de Orden

```http
GET /api/logistics/orders/{id}/pdf
```

Retorna un documento PDF binario (`Content-Type: application/pdf`) con el formato oficial de orden de entrega.

### Buscar Facturas (para crear orden)

```http
GET /api/logistics/invoices/search?q=texto
```

### Buscar Productos (para agregar ítems)

```http
GET /api/logistics/products/search?q=texto
```

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - No autenticado |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no existe |
| 500 | Internal Error - Error del servidor |

### Formato de Error

```json
{
  "error": "Mensaje descriptivo",
  "code": "ERROR_CODE",
  "details": {}
}
```

---

## Soporte AI

### Asistente de Soporte

```http
POST /api/support/chat
```

Endpoint de streaming para el asistente de soporte inteligente. Utiliza Vercel AI Gateway con Server-Sent Events (SSE).

**Body:**
```json
{
  "messages": [
    { "role": "user", "content": "¿Cómo emito una factura?" }
  ]
}
```

**Response:** `text/event-stream` — SSE stream con chunks de texto.

---

## BI (Business Intelligence)

Todos los endpoints requieren `biEnabled` (o `biProEnabled` para los marcados con 🔒 Pro).

### Query DSL

```http
POST /api/bi/query
```

**Body:**
```json
{
  "measures": ["sales_total", "ticket_avg"],
  "dimensions": ["day"],
  "dateRange": { "from": "2026-05-01", "to": "2026-05-10" },
  "sortBy": { "field": "day", "direction": "asc" },
  "limit": 100
}
```

**Response:** `{ rows: [...], meta: { totalRows, executedAt, source } }`

Measures válidos: `sales_total`, `sales_subtotal`, `invoice_count`, `ticket_avg`, `units_sold`, `gross_sales`, `discounts`, `unique_customers`.

Dimensions: `day`, `week`, `month`, `product`, `customer`.

### Export

```http
POST /api/bi/export
```

Body: `{ format: "xlsx" | "pdf", title, subtitle?, filename, query }`.
Devuelve el archivo binario con `Content-Disposition: attachment`.

### Alertas

| Método | Path | Descripción |
|--------|------|-------------|
| `GET`    | `/api/bi/alerts`        | Lista del tenant |
| `POST`   | `/api/bi/alerts`        | Crea (kind THRESHOLD) |
| `PATCH`  | `/api/bi/alerts/[id]`   | Edita name/config/isActive |
| `DELETE` | `/api/bi/alerts/[id]`   | Borra |

Config: `{ metric, op: lt|lte|gt|gte|eq, value, period: today|7d|30d }`.

### Dashboards custom 🔒 Pro

| Método | Path | Descripción |
|--------|------|-------------|
| `GET`/`POST`    | `/api/bi/dashboards`                       | Lista / crea |
| `GET`/`PATCH`/`DELETE` | `/api/bi/dashboards/[id]`           | Detalle / edita / borra |
| `POST`   | `/api/bi/dashboards/[id]/widgets`          | Agrega widget |
| `DELETE` | `/api/bi/dashboards/[id]/widgets/[widgetId]` | Borra widget |

### Predicción 🔒 Pro

```http
GET  /api/bi/forecast?metric=sales_total
POST /api/bi/forecast   { metric, horizonDays }
```

Heurística media móvil + estacionalidad semanal. Persiste en `BIForecast`.

### Segmentos 🔒 Pro

| Método | Path | Descripción |
|--------|------|-------------|
| `GET`/`POST` | `/api/bi/segments`       | Lista / crea con reglas (totalSpent / totalInvoices / ticketAvg / lastPurchaseDaysAgo) |
| `GET`/`DELETE` | `/api/bi/segments/[id]` | Miembros / borra |

### Campañas 🔒 Pro

| Método | Path | Descripción |
|--------|------|-------------|
| `GET`/`POST`   | `/api/bi/campaigns`        | Lista / crea |
| `PATCH`/`DELETE` | `/api/bi/campaigns/[id]` | `action: send | cancel` |

### Anomalías / Cohortes / Canasta 🔒 Pro

```http
GET /api/bi/anomalies?metric=sales_total&days=60
GET /api/bi/cohorts?months=12
GET /api/bi/basket?minPairCount=3&minConfidence=0.1&limit=50
```

### Q&A AI 🔒 Pro

```http
POST /api/bi/ask   { question: "¿Cuánto vendí esta semana?" }
```

Rate-limited contra `aiRatelimit` (30 reqs/día por tenant).
Response: `{ intent, summary, rows }`.

---

*Última actualización: Mayo 2026 — v2.0 (BI Suite)*
