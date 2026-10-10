# Logistics Module - Órdenes de Entrega

> **Estado: Producción** | Marzo 2026

---

## Descripción General

El módulo de Logística gestiona el ciclo de vida completo de las órdenes de entrega, desde la creación hasta la confirmación de recepción. Permite crear órdenes directamente o a partir de facturas existentes, con integración automática al inventario y generación de documentos PDF.

---

## Arquitectura del Módulo

```
features/logistics/
├── model/
│   ├── services/
│   │   └── delivery-order.service.ts    # Lógica de negocio (queries + mutations)
│   ├── types/
│   │   └── index.ts                     # TypeScript types, DTOs e interfaces
│   └── index.ts                         # Barrel export
└── ui/
    ├── DeliveryOrdersClientList.tsx      # Listado con filtros y búsqueda
    ├── DeliveryOrderDetailClient.tsx     # Vista detallada de orden
    ├── orders/
    │   ├── CreateDeliveryOrderModal.tsx  # Modal de creación directa
    │   └── CreateFromInvoiceModal.tsx    # Modal de creación desde factura
    └── pdf/
        └── DeliveryOrderPDF.tsx          # Template PDF (@react-pdf/renderer)
```

### API Routes

```
app/api/logistics/
├── orders/
│   ├── route.ts                # GET (listar) / POST (crear)
│   ├── [id]/
│   │   ├── route.ts            # GET (detalle) / PATCH (actualizar)
│   │   ├── status/route.ts     # PATCH (cambiar estado)
│   │   └── pdf/route.ts        # GET (generar PDF)
│   └── from-invoice/route.ts   # POST (crear desde factura)
├── invoices/search/route.ts    # GET (buscar facturas)
└── products/search/route.ts    # GET (buscar productos de inventario)
```

### Páginas

```
app/dashboard/logistics/
├── page.tsx          # Listado principal de órdenes
└── [id]/page.tsx     # Detalle de orden específica
```

---

## Modelo de Datos

### DeliveryOrder (Modelo Principal)

Modelo con 90+ campos que captura toda la información de una orden de entrega:

| Grupo | Campos |
|-------|--------|
| **Identificación** | `id`, `code` (OE-YYYY-NNNNNN), `qrToken` |
| **Estado** | `status`, `originMode` (DIRECT / FROM_INVOICE) |
| **Cliente** | `customerName`, `customerPhone`, `customerEmail`, `customerRuc` |
| **Dirección** | `deliveryAddress` (JSON: text, lat, lng), `deliveryLocation` |
| **Transporte** | `carrierId`, `driverId`, `carrierName`, `driverName`, `vehiclePlate`, `driverLicense`, `driverIdDoc`, `insurancePolicy` |
| **Condiciones** | `shippingMode`, `incoterm`, `controlledTemp`, `hazardousMat` |
| **Costos** | `subtotal`, `taxAmount`, `totalAmount`, `shippingCost`, `insuranceCost` |
| **Fechas** | `scheduledDate`, `estimatedDate`, `deliveredAt`, `createdAt`, `updatedAt` |
| **Opciones** | `priority`, `purchaseOrderRef`, `emitInvoice`, `notes`, `internalNotes` |
| **Inventario** | `inventoryDeducted` (boolean) |
| **Referencia** | `linkedInvoiceId` (cuando se crea desde factura) |

### Modelos Relacionados

| Modelo | Descripción |
|--------|-------------|
| `DeliveryOrderItem` | Líneas de la orden (producto, cantidad, precio, peso, empaque, dimensiones) |
| `Carrier` | Empresas transportistas (nombre, RUC, teléfono, email) |
| `Driver` | Conductores (nombre, teléfono, licencia, vinculado a Carrier) |
| `DeliveryOrderStatusHistory` | Historial de cambios de estado con usuario y notas |
| `DeliveryEvent` | Audit trail completo de todos los eventos del ciclo de vida |
| `QRScanLog` | Registro de escaneos del código QR (IP, User-Agent, metadata) |

---

## Flujo de Estados

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
  DRAFT ──→ PENDING ──→ IN_PICKING ──→ READY_TO_SHIP ──→ IN_TRANSIT ──→ DELIVERED
                │                                              │
                └──────────────── CANCELLED ←──────────────────┘
```

| Estado | Descripción |
|--------|-------------|
| `DRAFT` | Borrador, orden no confirmada |
| `PENDING` | Orden confirmada, pendiente de preparación |
| `IN_PICKING` | En proceso de picking/empaque en almacén |
| `READY_TO_SHIP` | Preparada, lista para despacho |
| `IN_TRANSIT` | En ruta hacia el destino |
| `DELIVERED` | Entregada al destinatario (registra `deliveredAt`) |
| `CANCELLED` | Orden cancelada |

Cada transición de estado se registra en `DeliveryOrderStatusHistory` y `DeliveryEvent`.

---

## Modos de Creación

### 1. Creación Directa (`DIRECT`)

Se crea una orden manualmente capturando todos los datos:
- Datos del cliente (nombre, teléfono, email, RUC)
- Dirección de entrega (texto + coordenadas opcionales)
- Ítems con producto opcional del inventario
- Transportista y conductor (selección o ingreso manual)
- Condiciones de envío (modo, incoterm, temperatura, materiales peligrosos)
- Prioridad y orden de compra de referencia

**Flujo:**
1. Usuario llena el formulario en `CreateDeliveryOrderModal`
2. Se valida con Zod schema en la API
3. Se genera código secuencial (`OE-YYYY-NNNNNN`)
4. Se genera QR token con HMAC-SHA256
5. Se calculan totales (subtotal, ITBMS, total)
6. Se crea la orden con ítems en una transacción
7. Se registra evento `ORDER_CREATED`
8. Si hay productos con `productId`, se descuenta inventario con OCC

### 2. Creación desde Factura (`FROM_INVOICE`)

Se importan automáticamente los datos de una factura existente:
- Los ítems de la factura se copian como ítems de entrega
- Los datos del cliente se precargan desde la factura
- Se vincula la orden con `linkedInvoiceId`

**Flujo:**
1. Usuario busca factura en `CreateFromInvoiceModal`
2. Se selecciona la factura y se agregan datos de entrega
3. Se copian ítems y totales desde la factura
4. Se registra evento `ORDER_CREATED_FROM_INVOICE`

---

## Integración con Inventario

Cuando una orden incluye ítems con `productId`, el sistema:

1. Ejecuta la deducción de stock **fuera de la transacción principal** (resiliencia)
2. Usa `reserveStockWithOCC` (Optimistic Concurrency Control) para evitar condiciones de carrera
3. Registra cada resultado (éxito/fallo) por producto
4. Actualiza `inventoryDeducted` en la orden (true si todos exitosos)
5. Crea evento `INVENTORY_DEDUCTED` con los resultados detallados

Si algún producto no tiene stock suficiente, la orden se crea igualmente pero con `inventoryDeducted = false`.

---

## Generación de PDF

El PDF se genera server-side usando `@react-pdf/renderer`:

- **Endpoint:** `GET /api/logistics/orders/{id}/pdf`
- **Contenido:** Datos del remitente (empresa), destinatario, transporte, ítems con cantidades/pesos, totales, condiciones de envío
- **Formato:** Documento formal con branding de la empresa
- **Auditoría:** Se registra evento `PDF_GENERATED` (fire-and-forget)
- **Respuesta:** Stream binario `application/pdf`

---

## QR Code Tracking

Cada orden genera un token QR único:

```typescript
qrToken = HMAC-SHA256(secret, `${orderCode}-${timestamp}`)
```

- El `secret` se obtiene del campo `logisticsSecret` del `Client`
- El token permite tracking externo sin autenticación
- Los escaneos se registran en `QRScanLog` (IP, User-Agent, metadata)

---

## Validaciones (Zod)

Todas las entradas se validan con schemas Zod en las rutas API:

| Campo | Validación |
|-------|-----------|
| `customerName` | `string().min(1)` - requerido |
| `customerEmail` | `string().email()` o vacío |
| `items` | `array().min(1)` - al menos un ítem |
| `items[].quantity` | `number().positive()` |
| `items[].unitPrice` | `number().min(0)` - opcional |
| `items[].taxRate` | `number().min(0).max(1)` - opcional |
| `status` | enum de estados válidos |
| `scheduledDate` | `string().datetime()` - ISO 8601 |

---

## Event Types (Audit Trail)

| Evento | Descripción |
|--------|-------------|
| `ORDER_CREATED` | Orden creada manualmente |
| `ORDER_CREATED_FROM_INVOICE` | Orden creada desde factura |
| `STATUS_CHANGE` | Cambio de estado (incluye from/to) |
| `INVENTORY_DEDUCTED` | Resultado de deducción de inventario |
| `PDF_GENERATED` | PDF generado por un usuario |

Cada evento registra: `actorType` (USER/SYSTEM), `actorId`, `actorName`, `metadata` (JSON), y `timestamp`.

---

## Multi-Tenancy

- Todas las queries filtran por `clientId` (aislamiento total entre organizaciones)
- Los transportistas (`Carrier`) y conductores (`Driver`) son por organización
- El código secuencial es independiente por `clientId`
- El secreto QR (`logisticsSecret`) es por organización

---

*Última actualización: Marzo 2026*
