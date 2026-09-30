# Análisis Técnico del Sistema Base — Estado de Origen

> Nota: este documento describe el sistema técnico sobre el que se construye PlentyPay, tomado como una línea base genérica de requerimientos (no como identidad de marca — ver `00-PLENTYPAY-BLUEPRINT-FUNCIONAL.md` para la descripción de producto, ya sin ninguna referencia al sistema de origen).

> Basado en la revisión directa del código fuente del sistema original entregado como línea de partida (94 pantallas, 76 modelos de datos, ~36 widgets compartidos + primitivas Shadcn). Este documento es la línea base técnica real sobre la que se construyen los demás documentos de la serie PlentyPay.

## 1. Qué es el sistema base hoy

El sistema base **no es solo un facturador**. Es un ERP SaaS multi-tenant para PYMEs y empresas en Panamá, construido "Feature-Sliced", con nueve módulos productivos activos:

| Módulo | Función | Madurez |
|---|---|---|
| **Facturación (HKA)** | Facturación electrónica DGI vía SOAP con The Factory HKA (PAC certificado) | Producción, muy maduro |
| **Inventario** | Multi-almacén, lotes, ABC, reorder point, EOQ, forecasting de demanda | Producción, sofisticado |
| **POS** | Punto de venta con offline-first, scanner, impresión térmica | Producción |
| **Logística** | Órdenes de entrega, transportistas, choferes, tracking QR público | Producción |
| **Payday** | Asistencia biométrica (Face ID en el edge) + nómina | Producción |
| **Motor / Créditos** | Motor de entidades genéricas + libro contable (ledger) + lealtad | Producción reciente |
| **BI Suite** | Analítica, forecasting, RFM, anomalías, canasta, Q&A en lenguaje natural | Producción reciente, muy completo |
| **Soporte AI** | Asistente con Vercel AI Gateway | Producción |
| **Marketing/Landing** | Checkout modular de módulos, SEO técnico | Producción |

Versión declarada: `package.json` marca `1.4.0`; el `README.md` documenta hasta `2.0.0` (BI Suite) — vale la pena alinear ambos antes de cualquier rebranding.

## 2. Modelo de negocio actual

Tres planes (`lib/constants/plans.ts`, single source of truth, precios en centavos):

| Plan | Precio/mes | Usuarios | Cajas POS | Sucursales | Facturas/mes |
|---|---|---|---|---|---|
| **Start** | $24.99 | 3 | 1 | 1 | 100 |
| **Business** | $59.99 | 10 | — | — | — |
| **Enterprise** | — | ilimitado | ilimitado | ilimitado | — (incluye Logística, API Access, Multi-sucursal) |

Addons independientes: `payday` ($20 + $5/empleado), `logistics` ($35/mes), `creditos` (tiered $49.99–$99.99 según # de clientes con crédito), `apiAccess` ($29/mes), `multiBranch` ($19/sucursal extra), `whatsapp` ($19/mes — **esto ya existe y es la puerta de entrada natural a Jelou**), `premiumSupport` ($49/mes).

**Dato clave para el "modelo dual" que mencionas en tu contexto:** el enum `CheckoutPreference` (`ALWAYS_DGI`, `INTERNAL_ONLY`, `ASK_ALWAYS`, `AUTO_THRESHOLD`, con un umbral configurable — default $20) ya resuelve la dualidad factura-fiscal vs. recibo-interno a nivel de cada venta. Esto es exactamente el mecanismo que necesitas extender para diferenciar "factura DGI" de "recibo de pago" en PlentyPay.

## 3. Flujos de usuario clave (end-to-end, verificados en código)

1. **Onboarding → Emisión de factura**: `signup` → `setup-password` → selección de plan (checkout modular del landing) → `dashboard/facturas` → `EmissionWizard` (organism) → validación Zod → envío SOAP a HKA → recepción de CUFE/QR/PDF → `InvoiceLog`.
2. **Venta en POS**: `dashboard/pos/scanner` → `CheckoutView` → lectura de código de barras (ZXing) → `CartReservation` (reserva optimista de stock) → decisión `CheckoutPreference` (¿DGI o interno?) → impresión térmica (ESC/POS) o `pos-customer` (pantalla secundaria para el cliente).
3. **Asistencia biométrica**: `payday/kiosk` → captura facial client-side (TensorFlow.js + face-api, con *liveness detection*) o PIN/QR/NFC (tag físico) → `AttendanceRecord` → alimenta `PaydayPayrollRun`.
4. **Entrega logística**: `DeliveryOrder` (DRAFT → ... → DELIVERED) → asignación de `Driver`/`Carrier` → `QRScanLog` en cada checkpoint → tracking público vía `(marketing)/track/[qrToken]` (sin login).
5. **Ciclo de crédito/lealtad (Motor)**: alta de `MotorEntity` (persona o empresa) → `MotorLedgerEntry` con `movementType` (CHARGE/PAYMENT/ADJUSTMENT/LOYALTY_GRANT/LOYALTY_REDEEM) → `runningBalanceCents` recalculado → reversos vía auto-referencia (`compensatesEntryId`).

## 4. Mapa de pantallas (94 páginas reales)

- **Público/marketing**: landing, `track/[qrToken]`, `privacy`, `terms`.
- **Auth**: signin, signup, forgot/reset password, setup-password, verify-email, **impersonate** (soporte puede entrar como el cliente).
- **Dashboard › Admin** (interno de la plataforma): clients, users, audit-log, monitoring, approvals, crm, motor-access, upgrade-requests, `acid-health` (panel de salud de concurrencia optimista).
- **Dashboard › BI**: 16 subpantallas (alerts, anomalies, ask, basket, campaigns, cohorts, dashboards custom, explore, forecast, segments...).
- **Dashboard › Facturas / Inventario / Logística / POS / Payday / Motor-Créditos / Configuración**: CRUD completos con vistas de detalle, listas, wizards.
- **Standalone**: `payday/kiosk` (modo quiosco a pantalla completa), `payday/mobile/verify/[sessionId]`, `pos-customer` (display de cliente), `offline` (fallback PWA).

## 5. Widgets y sistema de diseño

- **`shared/ui`** (36 archivos): atomic design real — *atoms* (`status-badge`, `folio-counter`), *molecules* (`excel-dropzone`, `invoice-preview-row`), *organisms* (`credential-guard`, `emission-wizard`, `invoice-history-table`).
- **`components/ui`**: 11 primitivas Shadcn/Radix (dialog, select, tabs, toast, tooltip...).
- Cada `features/*/ui` tiene además sus propios componentes de dominio (no compartidos), por lo que el inventario real de widgets es sustancialmente mayor a 47.
- Tema dinámico dark/light, `framer-motion` para transiciones, `Tailwind v4`.

## 6. Modelo de datos: 76 modelos Prisma

Aislamiento multi-tenant estricto: **todo** modelo relevante lleva `clientId` y las queries lo fuerzan a nivel de `core/database`. Familias de modelos: identidad (`User`, `Account`, `Session`, `Authenticator` — WebAuthn/passkeys ya integrado), facturación (`Invoice`, `InvoiceItem`, `FolioPool/Assignment/Consumption`, `HKACredential`), inventario/compras (`Product`, `InventoryLot`, `Supplier`, `PurchaseOrder`, `GoodsReceipt`), logística (`DeliveryOrder`, `Carrier`, `Driver`), payroll (`PaydayEmployee`, `AttendanceRecord`, `PayrollItem`), BI (`BIDashboard`, `BIForecast`, `BISavedSegment`...), y el **Motor** (`MotorEntity`, `MotorLedgerEntry`).

### El hallazgo más importante para PlentyPay: `MotorLedgerEntry`

```prisma
model MotorLedgerEntry {
  amountCents         BigInt   // siempre positivo; sign determina dirección
  runningBalanceCents BigInt   // post-movimiento, denormalizado O(1)
  currency             String  @default("PAB")
  movementType   MotorMovementType // CHARGE, PAYMENT, ADJUSTMENT_*, LOYALTY_GRANT, LOYALTY_REDEEM
  compensatesEntryId  String?  // reverso auditable de otro entry
}
```

Esto **ya es un libro contable de doble entrada con centavos en `BigInt`** (evita errores de punto flotante — la forma correcta de modelar dinero), balance corriente, reversos auditables y hasta tipos de movimiento de **lealtad**. No es un wallet todavía, pero es su núcleo. El documento 03 explica exactamente qué le falta.

## 7. Permisos y control de acceso

- **Nivel plataforma**: `UserRole` = `SUPER_ADMIN` (equipo interno de la plataforma) | `CLIENT`.
- **Nivel organización**: `TeamRole` (roles custom por tenant, ej. "Chofer", "Operador", "Almacenista") con `permissions` como JSON (`[{module, actions[]}]`) + `TeamMember.permissionOverrides` para excepciones puntuales por usuario (grants/revokes).
- Autenticación: NextAuth v5, JWT de 30 días, bcrypt (10 rounds), **y soporte WebAuthn/passkeys ya presente** (`@simplewebauthn`, modelo `Authenticator`) — un activo que casi nadie en este segmento tiene y que es directamente reutilizable para biometría bancaria en PlentyPay.

## 8. NFC, pagos y wallets: estado real (importante)

Se buscó explícitamente en todo el código: `yappy`, `nequi`, `telered`, `apple pay`, `google pay`, `google wallet`, `nfc`, `hce`. **Resultado: no existe ninguna integración de pagos, wallets ni tarjetas hoy.** La única mención de "NFC" en el proyecto es como **método de marcaje de asistencia** (`AttendanceMethod = 'NFC'` junto a `PIN_CODE`, `FACE_RECOGNITION`, `QR_DYNAMIC`, `FINGERPRINT`) — es decir, empleados marcando entrada/salida acercando un tag NFC físico a un kiosco, sin relación alguna con pagos. Esto es clave para no sobreestimar el punto de partida: **todo lo pedido sobre NFC de pago, Apple Pay/Google Pay/Wallet, Visa/Mastercard, Yappy, Nequi y TELERED se construye desde cero** (documento 03).

## 9. Infraestructura y despliegue actuales

100% serverless en **Vercel Edge Network**: Next.js 15 (App Router + Server Actions), **PostgreSQL en Neon** (serverless), **Redis en Upstash** (cache + rate limiting), almacenamiento mixto (Vercel Blob + AWS S3 + Cloudinary), cron nativo de Vercel (el `README` aclara explícitamente que ya migraron **fuera** de Railway/BullMQ hacia crons nativos). **No existe ningún `Dockerfile`, `docker-compose.yml`, manifiesto de Kubernetes ni archivo `.tf` en el repo** — la infraestructura híbrida self-hosted + cloud que describes en el documento 02 es, igual que los pagos, un desarrollo nuevo, no una migración de IaC existente.

## 10. Seguridad actual

- **En reposo**: AES-256-CBC para credenciales HKA y certificados digitales (keys separadas: `ENCRYPTION_KEY`, `CERTIFICATE_ENCRYPTION_KEY`, `CERTIFICATE_MASTER_KEY`).
- **En tránsito**: TLS 1.3 forzado, headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- **Identidad**: NextAuth v5 + JWT + bcrypt + WebAuthn opcional.
- **Multi-tenancy**: aislamiento por `clientId` forzado en middleware.
- **Auditoría**: `AuditLog` en acciones críticas; `ApiLog`/`ErrorLog` con Sentry.
- Esto es una base sólida para un SaaS B2B — pero **no es "nivel bancario" en el sentido de PCI-DSS** (no hay tokenización de tarjetas, HSM/KMS, ni segmentación de red para datos de titular de tarjeta, porque hoy no se procesa ni un dólar por tarjeta). El documento 03 detalla la brecha exacta.

## 11. El proyecto Flutter (scaffold original, carpeta vacía sin nombre de marca): estado real

Se revisó `pubspec.yaml` y `lib/main.dart`: es el **scaffold por defecto de `flutter create`** (solo `cupertino_icons` como dependencia, un único archivo `main.dart` con el contador de ejemplo). Sí trae ya las carpetas nativas generadas (`ios/`, `android/`, `windows/`, `macos/`, `linux/`, `web/`), lo que ahorra el paso de `flutter create` inicial, pero **no hay ni una pantalla, ni un modelo, ni una llamada de red implementada**. La migración a Flutter (documento 04) arranca prácticamente en cero en cuanto a código de cliente, aunque no en cero en cuanto a lógica de negocio — porque esa lógica ya vive, madura, en el backend Next.js/Prisma.

## 12. Tabla de brecha — qué existe vs. qué es 100% nuevo

| Requerimiento del brief | Estado |
|---|---|
| Catálogo de productos | ✅ Existe (por tenant, con CPBS/DGI) → ⚠️ falta capa pública multi-tenant tipo marketplace |
| Cumplimiento DGI | ✅ Maduro (HKA, CPBS, folios, XMLDSig) |
| Recibo de pago (PDF/QR) | ✅ Existe para facturas (`@react-pdf/renderer`) → extender a recibos no fiscales |
| Multi-sucursal | ✅ Existe (`multiBranch`, `TeamRole` por sucursal implícito) |
| Ledger / créditos / lealtad | ✅ Núcleo existe (`MotorLedgerEntry`) |
| RBAC granular | ✅ Existe (`TeamRole`/`TeamMember`) |
| WebAuthn/passkeys | ✅ Ya integrado |
| NFC de pago, HCE, Tap to Pay | ❌ No existe (solo NFC de asistencia) |
| Apple Pay / Google Pay / Google Wallet | ❌ No existe |
| Visa / Mastercard (adquirencia) | ❌ No existe |
| Yappy / Nequi / TELERED / Tarjeta Clave | ❌ No existe |
| Cumplimiento Superintendencia de Bancos | ❌ No existe (hoy la empresa no es sujeto obligado financiero) |
| Marketplace multi-vendedor | ❌ No existe (Product es interno por tenant) |
| Docker / Kubernetes / Terraform / gRPC | ❌ No existe (100% serverless Vercel) |
| App Flutter multiplataforma | ❌ Scaffold vacío |
| Marca "PlentyPay" | ✅ Ya aplicada (ver MIGRATION_STATUS.md) |

Los documentos 02, 03 y 04 desarrollan cada fila roja con arquitectura concreta, y el documento 04 cierra con la hoja de ruta y el rebranding.
