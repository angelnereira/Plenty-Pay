# Glosario universal

Punto único de entrada a **todos los nombres** del proyecto: tipos, estados, permisos, códigos de error, eventos, variables y constantes. Cada entrada da el nombre canónico, una definición corta y la **fuente de verdad** donde vive la regla completa.

**Cómo se usa**
- Antes de inventar un nombre (campo, estado, `reason`, variable de entorno, subject), búscalo aquí. Si existe, se usa tal cual.
- Este documento **no redefine reglas**: si difiere de su fuente, manda la fuente (ADR 0010) y se corrige el glosario en el mismo cambio.
- Un nombre nuevo se agrega primero en su fuente (`.proto`, SPEC, estándar) y después aquí. `scripts/check-docs.sh` falla si un enum de los `.proto` o un `reason` de la columna *Errores* de un SPEC no aparece en este documento.

## 1. Mapa de nombres por contenedor

Un mismo contenedor se llama distinto según la capa. Esta tabla es la correspondencia oficial.

| Contenedor (carpeta) | Lenguaje | Puerto | Archivo `.proto` | Paquete | Servicio gRPC | Esquema PG | Stream NATS |
|---|---|---|---|---|---|---|---|
| `api-gateway` | Go | 8080 | — (consume) | — | — | — | — |
| `web` | Go | 8081 | — | — | — | — | — |
| `identity` | Go | 50060 | `identity.proto` | `plentypay.identity.v1` | `Identity` | `identity` | `PP_IDENTITY` |
| `ledger` | Rust | 50061 | `ledger.proto` | `plentypay.ledger.v1` | `Ledger` | `ledger` | `PP_LEDGER` |
| `payments-core` | Rust | 50062 | `payments.proto` | `plentypay.payments.v1` | `Payments` | `payments` | `PP_PAYMENTS` |
| `settlement` | Rust | 50063 | `settlement.proto` | `plentypay.settlement.v1` | `Settlement` | `settlement` | `PP_SETTLEMENT` |
| `fiscal-invoicing` | Go | 50064 | `fiscal_invoicing.proto` | `plentypay.fiscal.v1` | `FiscalInvoicing` | `fiscal` | `PP_FISCAL` |
| `catalog` | Go | 50065 | `catalog.proto` | `plentypay.catalog.v1` | `Catalog` | `catalog` | `PP_COMMERCE` |
| `inventory` | Go | 50066 | `inventory.proto` | `plentypay.inventory.v1` | `Inventory` | `inventory` | `PP_COMMERCE` |
| `pos` | Go | 50067 | `pos.proto` | `plentypay.pos.v1` | `Pos` | `pos` | `PP_COMMERCE` |
| `logistics` | Go | 50068 | `logistics.proto` | `plentypay.logistics.v1` | `Logistics` | `logistics` | `PP_LOGISTICS` |
| `geolocation` | Go | 50069 | `geolocation.proto` | `plentypay.geo.v1` | `Geolocation` | `geo` | `PP_LOGISTICS` |
| `payroll` | Go | 50070 | `payroll.proto` | `plentypay.payroll.v1` | `Payroll` | `payroll` | `PP_PAYROLL` |
| `notifications` | Go | 50071 | `notifications.proto` | `plentypay.notifications.v1` | `Notifications` | `notifications` | — |
| `analytics-bi` | Go | 50072 | `analytics.proto` | `plentypay.analytics.v1` | `Analytics` | `analytics` | `PP_ANALYTICS` |
| `security` | Go | 50073 | `security.proto` | `plentypay.security.v1` | `Security` | `security` | `PP_AUDIT` (consume) |
| `infra-management` | Go | 50074 | `infra_management.proto` | `plentypay.infra.v1` | `InfraManagement` | `infra` | — |
| `orders` | Go | 50075 | `orders.proto` | `plentypay.orders.v1` | `Orders` | `orders` | `PP_COMMERCE` |

Compartidos: `common.proto` (`plentypay.common.v1`) y `events.proto` (`plentypay.events.v1`). El rol de base de datos de cada contenedor es `<esquema>_svc`. En el catálogo de eventos, el prefijo de un mensaje es el **paquete** (`fiscal.InvoiceAccepted`, `geo.GeofenceCrossed`), no el nombre de la carpeta.

Fuentes: [`architecture/service-dependencies.md`](architecture/service-dependencies.md) §1, [`standards/data-standards.md`](standards/data-standards.md) §1, [`../event-bus/SPEC.md`](../event-bus/SPEC.md) §3, [`../network-contracts/consumers.txt`](../network-contracts/consumers.txt).

## 2. Tipos primitivos

| Concepto | Proto | SQL | JSON (gateway) | Dart |
|---|---|---|---|---|
| Dinero | `common.Money{amount_minor:int64, currency}` | `bigint` + `currency char(3)` | `{"amount_minor":1250,"currency":"USD"}` | `int` en centavos; se pinta con `MoneyText` |
| Tasa | `*_bps` (`int32`; 700 = 7,00 %) | `integer` | número | `int` |
| Cantidad de inventario | `*_milli` (`int64`, milésimas) | `bigint` | número | `int` |
| Identificador | `string` UUIDv7 en minúsculas | `uuid` | string | `String` |
| Instante | `google.protobuf.Timestamp` (UTC) | `timestamptz` | RFC 3339 | `DateTime` (UTC) |
| Fecha de negocio | `string` `YYYY-MM-DD` | `date` | string | `String`; zona `America/Panama` |
| Hora de turno | `string` `"HH:MM"` | `text` | string | zona `America/Panama` |
| Estado | `enum` con prefijo | `text` + `CHECK` | string **sin prefijo** | `String` |
| Paginación | `PageRequest{page_size, page_token}` → `PageInfo{next_page_token}` | keyset | `?page_size=&page_token=` | — |
| Referencia cruzada | `common.Reference{type, id}` | `reference_type`, `reference_id` | objeto | — |
| Punto geográfico | `common.GeoPoint{latitude, longitude}` (`double`) | PostGIS | objeto | — |
| Dirección | `common.Address` (`country` ISO-3166 alfa-2) | `jsonb` | objeto | — |
| Rango de tiempo | `common.TimeRange{from, to}` (desde inclusivo, hasta exclusivo) | — | objeto | — |

Reglas que no admiten excepción:
- **Nunca `float`/`double` para dinero**, tampoco de forma temporal. `double` solo en coordenadas.
- Un `*_id` vacío significa "no aplica"; jamás un id inventado.
- Códigos públicos (terminal, seguimiento, invitación, reset) **no son UUID**: aleatorios ≥ 128 bits en base64url.
- `page_size` 1..200, por defecto 50. Tokens opacos; nunca `OFFSET`.

Valores válidos de `Reference.type` (lista cerrada): `payment`, `payment_intent`, `refund`, `sale`, `order`, `sub_order`, `invoice`, `settlement_batch`, `payroll_run`, `payslip`, `delivery`, `purchase_order`, `transfer`, `topup`, `terminal`, `cash_session`, `stock_movement`.

Identificadores reservados:

| Valor | Significado |
|---|---|
| `00000000-0000-0000-0000-000000000001` | Party **PLATFORM** (PlentyPay) en el ledger |
| `00000000-0000-0000-0000-000000000000` | "Sin tenant" en la tabla `idempotency_keys`. No es un party ni un tenant |

Fuentes: [`../network-contracts/proto/common.proto`](../network-contracts/proto/common.proto), [`standards/grpc-conventions.md`](standards/grpc-conventions.md) §1, [`standards/data-standards.md`](standards/data-standards.md) §2–§3 y §6, [`domain/domain-model.md`](domain/domain-model.md) §9, ADR 0013.

## 3. Cómo cambia un mismo valor entre capas

| Capa | Forma | Ejemplo |
|---|---|---|
| Proto | `<ENUM>_<VALOR>`, el 0 es `<ENUM>_UNSPECIFIED` | `PAYMENT_STATUS_CAPTURED` |
| SQL (`CHECK`) | valor sin prefijo | `CAPTURED` |
| JSON del gateway | string sin prefijo; campos en `snake_case` | `"status":"CAPTURED"` |
| Documentos y UI | valor sin prefijo | CAPTURED, "Confirmando" para UNKNOWN |

- **Excepción publicada**: `UserRole` no lleva prefijo en proto (`PLATFORM_ADMIN`, no `USER_ROLE_PLATFORM_ADMIN`). No se corrige: los contratos son solo aditivos.
- `int64` viaja como **número** JSON si ≤ 2^53 y como string si es mayor. En Flutter Web `int` tiene 53 bits: los montos en centavos caben; cualquier otro `int64` grande se trata como string.
- `ledger` guarda `transaction_type` como **string**, no como enum (valores en §5.3).
- `identity` devuelve `success=false` + `error_message` dentro de `AuthResult` en `Register`/`Login`/`RefreshToken`. Es un contrato ya publicado; **todo RPC nuevo usa códigos gRPC** (§7).

Fuentes: [`standards/grpc-conventions.md`](standards/grpc-conventions.md) §1.3 y §4, [`../api-gateway/SPEC.md`](../api-gateway/SPEC.md) §3.

## 4. Términos de negocio

| Término | Definición | Fuente |
|---|---|---|
| **Party** | Quien puede tener cuentas en el ledger: un `user_id`, un `tenant_id` o PLATFORM | dominio §2 |
| **Tenant** | Comercio (negocio). Tiene sucursales (`branch_id`) y bodegas. El identificador es siempre `tenant_id`; "merchant" y "business" son sinónimos que sobreviven en nombres publicados (`MERCHANT_PAYABLE`, `merchant_net`, `CreateBusiness`) | dominio §2–§3 |
| **Riel (rail)** | Medio de pago interno o externo (`PaymentRail`) | dominio §2 |
| **Gross** | Monto bruto: lo que paga el pagador antes de comisiones | dominio §4 |
| **platform_fee** | Comisión de PlentyPay: fijo + porcentaje sobre el bruto | dominio §4.2 |
| **tax** | ITBMS sobre la comisión de plataforma (Q-07) | dominio §4.2 |
| **rail_fee** | Comisión que cobra el riel | dominio §4.2 |
| **merchant_net** | Lo que recibe el comercio en `MERCHANT_PAYABLE`. Absorbe todo residuo de redondeo | dominio §4.2 |
| **FeeBearer** | Quién asume la comisión: comercio, cliente o plataforma | dominio §4.2 |
| **FeePolicy** | Política de comisiones; se elige la más específica y se congela en el pago al capturar | dominio §4.1 |
| **Split** | Parte de un cobro destinada a un comercio (marketplace). La fórmula de comisión se aplica por split | dominio §4.3 |
| **`half_up`** | Redondeo entero: `(v * bps + 5000) / 10000` | dominio §4.2 |
| **`allocate`** | Reparto por pesos con residuo a las partes de mayor resto fraccional | dominio §4.3 |
| **PaymentIntent** | Intención de cobrar (monto, riel, splits, expiración) | dominio §6.1 |
| **Payment** | El cobro concreto; uno por intent en el MVP | dominio §6.1 |
| **PaymentAttempt** | Cada llamada a un riel | dominio §6.1 |
| **Captura** | Momento en que el riel confirma el dinero; dispara el asiento | dominio §2 |
| **UNKNOWN** | No se sabe si el riel cobró. Nunca es fallo ni éxito | dominio §6.3 |
| **Hold** | Reserva de saldo disponible de una cuenta | dominio §2, §8.4 |
| **Disponible** | Saldo − Σ holds `ACTIVE` | dominio §5.1 |
| **Plantilla (template)** | Forma permitida de un asiento (T1–T10, REV) | dominio §5.2 |
| **Liquidación (settlement)** | Transferir al comercio lo que se le debe | dominio §2 |
| **Conciliación** | Comparar registros internos contra extractos de rieles y bancos | dominio §2 |
| **Tender** | Medio de pago aplicado a una venta POS; uno por riel o efectivo | dominio §7 F4 |
| **Sub-pedido (SubOrder)** | Parte de un pedido que corresponde a un solo comercio | dominio §8.10 |
| **Listing** | Publicación de un producto en el marketplace | dominio §1 |
| **Instantánea (snapshot)** | Copia inmutable de datos de otro contexto en un momento | dominio §2 |
| **Carrier / Driver** | Transportista / repartidor. `courier` es solo el nombre del preset de rol | `logistics.proto` |
| **Step-up** | Confirmación fuerte para una operación concreta | seguridad §4 |
| **KYB** | Verificación del negocio para pasar a `ACTIVE` (Q-04) | dominio §3 |
| **Nivel de verificación** | `KYC_0`, `KYC_1`, `KYC_2`: cuánto se ha verificado la identidad del usuario; decide sus límites | regulatory-framework N-AML-03 |
| **Descuento legal** | Descuento obligatorio por ley a jubilados, tercera edad y personas con discapacidad; distinto del descuento comercial | regulatory-framework N-CON-04 |
| **Parámetro legal** | Valor fijado por una norma (tasa, tope, plazo), guardado como dato con vigencia | regulatory-framework §2 P1 y §13 |
| **Beneficiario final** | Persona natural con 10 % o más de un negocio | regulatory-framework N-AML-04 |
| **CUFE** | Código único de factura electrónica de la DGI | dominio §2 |
| **Consentimiento (finalidad)** | Aceptación de una finalidad concreta, con la versión del texto que la persona vio. Valores: `AGE_CONFIRMATION` (mayoría de edad, N-DAT-14), `TERMS`, `PRIVACY_DATA_PROCESSING` y `MARKETING` (opcional). Nunca se agrupan ni se premarcan (N-DAT-02) | regulatory-framework N-DAT-02, S-GEN-03, `ConsentGrant` en identity.proto |
| **Canal (de un consentimiento)** | Medio por el que se aceptó. Hoy solo `app` (cliente Flutter vía gateway); lo fija el gateway, nunca el cuerpo de la petición | identity.proto `RegisterRequest.channel`, api-gateway R2b |
| **PAC** | Proveedor autorizado de certificación que transmite a la DGI | dominio §2 |
| **Folio** | Numeración fiscal asignada al contribuyente | fiscal SPEC |
| **ITBMS** | Impuesto de Panamá; tasas válidas 0/7/10/15 % (Q-11) | dominio §2 |
| **Outbox** | Tabla donde se escribe el evento en la misma transacción que el cambio | eventos §4 |
| **Módulo** | Sección de la app visible según permisos | §6.3 |
| **Clase de error** | De dominio (esperable), de dependencia (reintentable) o defecto (bug): decide nivel de log, estado del span y qué ve el cliente | observability-standards §10 |
| **Huella de error** | `pp.error.fingerprint`: agrupa ocurrencias del mismo defecto | observability-standards §10.7 |
| **Código de soporte** | El `request_id` que el usuario ve y copia ante un error inesperado | observability-standards §13.4 |
| **MCC** | Código de categoría del comercio, 4 dígitos (ISO 18245) | international-standards N-STD-35 |
| **Código interno** | Código de barras con prefijo `02` o `20`–`29`: válido solo dentro del negocio | international-standards N-STD-24 |

"dominio" = [`domain/domain-model.md`](domain/domain-model.md); "seguridad" = [`standards/security-standards.md`](standards/security-standards.md); "eventos" = [`standards/events-and-messaging.md`](standards/events-and-messaging.md).

## 5. Enums y estados

Valores sin prefijo. Las transiciones legales están en [`domain/domain-model.md`](domain/domain-model.md) §8; todo lo demás es `FAILED_PRECONDITION` `INVALID_STATE_TRANSITION`.

### 5.1 Enums de los contratos

| Enum | Archivo | Valores | Transiciones |
|---|---|---|---|
| `PaymentRail` | common | WALLET, YAPPY, TELERED_CLAVE, CARD, APPLE_PAY, GOOGLE_PAY, QR_INTEROP, CASH | — |
| `UserRole` | identity | PLATFORM_ADMIN, BUSINESS_OWNER, BUSINESS_STAFF, CUSTOMER | — |
| `TenantStatus` | identity | PENDING_REVIEW, ACTIVE, SUSPENDED, REJECTED | §8.15 |
| `AccountType` | ledger | ver §5.2 | — |
| `EntrySide` | ledger | DEBIT, CREDIT | — |
| `TransactionStatus` | ledger | POSTED, REVERSED | §8.5 |
| `HoldStatus` | ledger | ACTIVE, CAPTURED, RELEASED, EXPIRED | §8.4 |
| `PaymentStatus` | payments | CREATED, REQUIRES_ACTION, PROCESSING, AUTHORIZED, CAPTURED, FAILED, CANCELLED, EXPIRED, UNKNOWN | §8.1 |
| `AttemptStatus` | payments | CREATED, PROCESSING, AUTHORIZED, CAPTURED, FAILED, UNKNOWN | §8.2 |
| `LedgerPostingStatus` | payments | PENDING, POSTED, FAILED | §6.1 |
| `RefundStatus` | payments | PENDING, SUCCEEDED, FAILED | §8.3 |
| `FeeBearer` | payments | MERCHANT, CUSTOMER, PLATFORM | §4.2 |
| `BatchStatus` | settlement | OPEN, PROCESSING, PAID, FAILED | §8.6 |
| `PayoutFrequency` | settlement | DAILY, WEEKLY, MANUAL | — |
| `ReconciliationState` | settlement | MATCHED, UNMATCHED_INTERNAL, UNMATCHED_EXTERNAL, AMOUNT_MISMATCH, RESOLVED | §8.7 |
| `DocumentType` | fiscal_invoicing | FISCAL_INVOICE, CREDIT_NOTE, DEBIT_NOTE, INTERNAL_RECEIPT | — |
| `CheckoutPreference` | fiscal_invoicing | ALWAYS_FISCAL, INTERNAL_ONLY, ASK_ALWAYS, AUTO_THRESHOLD | §8.8 |
| `InvoiceStatus` | fiscal_invoicing | DRAFT, QUEUED, SENT, ACCEPTED, REJECTED, VOIDED | §8.8 |
| `ProductStatus` | catalog | ACTIVE, ARCHIVED | — |
| `MovementType` | inventory | RECEIPT, SALE, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN, RETURN, WRITE_OFF | — |
| `ReservationStatus` | inventory | ACTIVE, COMMITTED, RELEASED, EXPIRED | §8.13 |
| `PurchaseOrderStatus` | inventory | DRAFT, SENT, PARTIALLY_RECEIVED, RECEIVED, CANCELLED | §8.12 |
| `FulfillmentMethod` | orders | DELIVERY, PICKUP | — |
| `OrderStatus` | orders | PENDING_PAYMENT, PAID, PARTIALLY_FULFILLED, COMPLETED, CANCELLED, REFUNDED | §8.10 |
| `SubOrderStatus` | orders | PENDING_PAYMENT, AWAITING_ACCEPTANCE, ACCEPTED, READY, IN_DELIVERY, COMPLETED, REJECTED, CANCELLED | §8.10 |
| `SaleStatus` | pos | OPEN, PARKED, AWAITING_PAYMENT, PAID, VOIDED, PARTIALLY_REFUNDED, REFUNDED | §8.9 |
| `DeliveryStatus` | logistics | PENDING, ASSIGNED, PICKED_UP, IN_TRANSIT, ARRIVED, DELIVERED, FAILED, CANCELLED | §8.11 |
| `ClockMethod` | payroll | PIN, FACE, QR_DYNAMIC, NFC, FINGERPRINT, MANAGER_OVERRIDE | — |
| `ClockDirection` | payroll | IN, OUT | — |
| `PayrollRunStatus` | payroll | DRAFT, APPROVED, PAYING, PAID, PARTIALLY_FAILED | §8.14 |
| `Channel` | notifications | EMAIL, PUSH, WHATSAPP, SMS, IN_APP | — |
| `Priority` | notifications | LOW, NORMAL, HIGH, CRITICAL (ignora preferencias y horas de silencio) | — |
| `DeliveryState` | notifications | QUEUED, SENT, DELIVERED, FAILED, SUPPRESSED | — |
| `Granularity` | analytics | HOUR, DAY, WEEK, MONTH | — |

Nombres que se parecen y **no son lo mismo**: `DeliveryStatus` (una entrega física, logistics) y `DeliveryState` (el envío de una notificación); `PaymentStatus` (el cobro) y `AttemptStatus` (una llamada al riel); `TransactionStatus` (asiento del ledger) y `LedgerPostingStatus` (lo que payments-core sabe de su asiento).

### 5.2 Tipos de cuenta (`AccountType`)

WALLET, MERCHANT_PAYABLE, PLATFORM_FEES, TAX_PAYABLE, RAIL_RECEIVABLE, RAIL_FEES_PAYABLE, BANK_CASH, LOYALTY_POINTS, CUSTOMER_CREDIT, FUNDING_SOURCE, SUSPENSE. Una cuenta es `(party_id, type, currency, scope_id)`. Clase, party y si admite saldo negativo: dominio §5.1.

### 5.3 Plantillas de asiento

| Plantilla | Hecho | `transaction_type` | Clave de idempotencia |
|---|---|---|---|
| T1 | Recarga de wallet | `WALLET_TOPUP` | `topup:<payment_id>` |
| T2 | Cobro por riel externo | `PAYMENT_CAPTURE` | `pay:<payment_id>` |
| T3 | Cobro con wallet | `WALLET_PAYMENT` | `pay:<payment_id>` |
| T4 | Transferencia P2P | `P2P_TRANSFER` | `p2p:<transfer_id>` |
| T5 | Liquidación del riel | `RAIL_SETTLEMENT` | `railsettle:<statement_line_id>` |
| T6 | Pago al comercio por banco | `PAYOUT` | `payout:<batch_id>` |
| T6b | Pago al comercio a su wallet | `PAYOUT_TO_WALLET` | `payout:<batch_id>` |
| T7 | Reembolso | `REFUND` | `refund:<refund_id>` |
| T8 | Puntos de lealtad | `LOYALTY_ISSUE` / `LOYALTY_REDEEM` | `loyalty:<sale_id>` / `redeem:<id>` |
| T9 | Venta a crédito | `CREDIT_SALE` | `credit:<sale_id>` |
| T9b | Abono a crédito | `CREDIT_REPAYMENT` | `creditpay:<payment_or_cash_id>` |
| T10 | Pago de nómina | `PAYROLL_PAYMENT` | `payroll:<run_id>:<employee_id>` |
| REV | Reverso | `REVERSAL` | `rev:<transaction_id>` |

Líneas de débito y crédito de cada plantilla: dominio §5.2. Invariantes `I1`–`I7`: dominio §5.3.

### 5.4 Estados que viven solo en documentos (sin enum en proto)

Son internos de su dueño y no se exponen por API: `idempotency_keys.state` (`IN_PROGRESS`, `DONE`); estados internos del asiento `DRAFT` → `VALIDATING` (no visibles por API).

## 6. Identidad y autorización

### 6.1 Roles
- **Rol base** (`UserRole`): `PLATFORM_ADMIN`, `BUSINESS_OWNER`, `BUSINESS_STAFF`, `CUSTOMER`. En mayúsculas.
- **Presets de staff** (en minúsculas): `manager`, `cashier`, `stock_keeper`, `courier`, `accountant`. El dueño puede crear roles propios con subconjuntos del catálogo, nunca con `platform:*`.
- **Todo usuario recibe además los permisos de `CUSTOMER`**.

### 6.2 Permisos
Formato `<módulo>:<acción>[:<calificador>]`, en minúsculas. El sufijo `:self` limita al propio usuario. Catálogo (64 permisos): [`standards/security-standards.md`](standards/security-standards.md) §3.1; copia ejecutable en `identity/internal/auth/permissions.go`.

### 6.3 Módulos de la app
Ids, en orden de navegación: `wallet`, `marketplace`, `pos`, `catalog`, `inventory`, `orders`, `logistics`, `finance`, `payroll`, `analytics`, `admin`, `platform`. Los decide el servidor (`enabled_modules` de `GetUserPermissions`); la app muestra la intersección con su registro. Fuente: [`../identity/SPEC.md`](../identity/SPEC.md) R10, [`ux/screen-catalog.md`](ux/screen-catalog.md) §1.

No confundir el id de módulo con el contenedor: `marketplace` lo sirve `orders` + `catalog`; `finance` agrupa `payments-core`, `settlement` y `fiscal-invoicing`; `admin` y `platform` los sirve `identity` e `infra-management`.

### 6.4 Contexto de petición

| Cabecera HTTP (app → gateway) | Metadato gRPC (gateway → servicios) | Contenido |
|---|---|---|
| `Authorization: Bearer <access>` | `x-pp-user-id`, `x-pp-tenant-id`, `x-pp-role`, `x-pp-permissions` | Identidad validada. Tenant vacío = cliente final o plataforma |
| `X-Request-Id` | `x-pp-request-id` | UUIDv7 por petición; se propaga sin cambio y se devuelve |
| `Idempotency-Key` | campo `idempotency_key` del request | 16–100 caracteres |
| `X-Step-Up-Token` | `x-pp-step-up` | Token de confirmación fuerte |
| — | `x-pp-actor-service` | Contenedor que origina la llamada |
| `traceparent` | `traceparent` | W3C Trace Context |

**Tenant y actor salen de estos metadatos, nunca del cuerpo.** Un `tenant_id` o `party_id` en el cuerpo es un dato de negocio (a quién se liquida), no una fuente de autorización. Fuente: [`standards/grpc-conventions.md`](standards/grpc-conventions.md) §2, ADR 0011 y 0014.

### 6.5 Tokens
Access JWT de 15 min; refresh de 30 días con rotación en cada uso; step-up de un solo uso, 5 min, ligado a usuario + operación + monto. Fuente: seguridad §2 y §4.

## 7. Errores

### 7.1 Código gRPC ↔ HTTP

| Situación | gRPC | HTTP |
|---|---|---|
| Entrada inválida | `INVALID_ARGUMENT` | 400 |
| Sin identidad o token inválido | `UNAUTHENTICATED` | 401 |
| Sin permiso | `PERMISSION_DENIED` | 403 |
| Inexistente **o de otro tenant** | `NOT_FOUND` | 404 |
| Regla de negocio o transición inválida | `FAILED_PRECONDITION` | 409 |
| Duplicado o idempotency key reutilizada | `ALREADY_EXISTS` | 409 |
| Conflicto de concurrencia | `ABORTED` | 409 + `Retry-After` |
| Límite de tasa | `RESOURCE_EXHAUSTED` | 429 |
| Dependencia caída | `UNAVAILABLE` | 503 |
| Plazo vencido | `DEADLINE_EXCEEDED` | 504 |
| Bug del servidor | `INTERNAL` | 500 |
| No implementado | `UNIMPLEMENTED` | 501 |

### 7.2 Forma del error
- gRPC: `google.rpc.Status` con `ErrorInfo{reason, domain:"plentypay", metadata}`.
- HTTP: `{"error":"<mensaje en español>","reason":"<REASON>","request_id":"..."}`. La app traduce `reason` con ARB y nunca muestra el texto técnico.
- `reason` es `MAYUSCULAS_CON_GUION_BAJO`, estable y parte del contrato.

### 7.3 Catálogo de `reason`

Transversales (cualquier servicio): `IDEMPOTENCY_KEY_REUSED`, `TENANT_NOT_ACTIVE`, `STEP_UP_REQUIRED`, `STEP_UP_INVALID`, `INSUFFICIENT_FUNDS`, `OUT_OF_STOCK`, `INVALID_STATE_TRANSITION`, `AMOUNT_BELOW_FEES`, `CURRENCY_MISMATCH`, `UNBALANCED_TRANSACTION`, `RAIL_UNAVAILABLE`, `RATE_LIMITED`, `MAINTENANCE_MODE`.

| Dueño | `reason` propios |
|---|---|
| api-gateway | `TOKEN_INVALID`, `IDENTITY_UNAVAILABLE`, `INVALID_JSON`, `BODY_TOO_LARGE`, `IDEMPOTENCY_KEY_REQUIRED`, `RATE_LIMITED`, `MAINTENANCE_MODE` |
| identity | `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `EMAIL_TAKEN`, `INVALID_EMAIL`, `WEAK_PASSWORD`, `TOKEN_INVALID`, `TOKEN_REUSED`, `ALREADY_HAS_TENANT`, `INVALID_RUC`, `RUC_TAKEN`, `ROLE_NOT_FOUND`, `PRESET_READ_ONLY`, `UNKNOWN_PERMISSION`, `CANNOT_DEACTIVATE_OWNER`, `ALREADY_USED` |
| ledger | `UNKNOWN_TEMPLATE`, `UNBALANCED_TRANSACTION`, `CURRENCY_MISMATCH`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `DUPLICATE_CAPTURE`, `ALREADY_REVERSED`, `HOLD_NOT_ACTIVE`, `INVALID_RANGE` |
| payments-core | `AMOUNT_OUT_OF_RANGE`, `AMOUNT_BELOW_FEES`, `SPLITS_MISMATCH`, `FEE_POLICY_MISSING`, `RAIL_DISABLED`, `RAIL_UNAVAILABLE`, `TERMINAL_INACTIVE`, `PAYMENT_NOT_CAPTURED`, `REFUND_EXCEEDS_CAPTURED`, `MERCHANT_BALANCE_INSUFFICIENT`, `EVIDENCE_REQUIRED`, `SIGNATURE_INVALID` |
| settlement | `NOTHING_TO_SETTLE`, `BELOW_MINIMUM`, `INVALID_DESTINATION`, `ALREADY_IMPORTED`, `UNSUPPORTED_FORMAT`, `EVIDENCE_REQUIRED` |
| fiscal-invoicing | `PROFILE_MISSING`, `NOT_READY`, `INVALID_RUC`, `INVALID_TAXPAYER`, `TOTALS_MISMATCH`, `PAC_AUTH_FAILED`, `RELATED_NOT_ACCEPTED`, `EXCEEDS_ORIGINAL` |
| orders | `PRICE_CHANGED`, `LISTING_UNAVAILABLE`, `CART_LIMIT`, `ACCEPT_DEADLINE_PASSED`, `OUT_OF_STOCK` |
| pos | `PRICE_STALE`, `DISCOUNT_EXCEEDS_LIMIT`, `TENDERS_MISMATCH`, `SESSION_ALREADY_OPEN`, `SESSION_CLOSED`, `SALES_PENDING`, `HAS_CAPTURED_PAYMENTS`, `EXCEEDS_SOLD_QTY`, `CREDIT_LIMIT_EXCEEDED`, `INSUFFICIENT_POINTS` |
| normativos (declarados en `compliance/regulatory-framework.md`; se agregan a la columna *Errores* del SPEC dueño al implementar) | `KYC_REQUIRED`, `ACCOUNT_UNDER_REVIEW`, `CONSENT_REQUIRED`, `AGE_REQUIREMENT`, `INVALID_TAX_RATE`, `FISCAL_RECEIVER_REQUIRED`, `LEGAL_DISCOUNT_ID_REQUIRED`, `BELOW_MINIMUM_WAGE`, `DRIVER_DOCS_EXPIRED` |

Los contenedores sin fila (catalog, inventory, logistics, geolocation, payroll, notifications, analytics-bi, security, infra-management) aún no declaran `reason` propios en su SPEC; al declararlos se agregan aquí (paso F03.5).

Pares que se confunden:

| Nombre | Qué es | No confundir con |
|---|---|---|
| `TOKEN_REUSED` | `reason` de error de `identity.RefreshToken` | `TOKEN_REUSE`: tipo (`kind`) de evento en `security.ReportSecurityEvent`. `REFRESH_REUSE`: motivo dentro del evento `SessionRevoked` |
| `SIGNATURE_INVALID` | `reason` de `payments.HandleRailWebhook` (→ 401) | `WEBHOOK_BAD_SIGNATURE`: tipo de evento de seguridad |
| `PRICE_CHANGED` | orders: el total recotizado difiere del que vio el cliente | `PRICE_STALE`: pos, la caché de precios del cliente está vencida |
| `TENANT_NOT_ACTIVE` | el comercio no está `ACTIVE` | no existe `MERCHANT_NOT_ACTIVE` |
| `AMOUNT_BELOW_FEES` | el neto del comercio quedaría negativo | no existe `FEES_EXCEED_AMOUNT` |
| `NEGATIVE_STOCK` | **alerta** de inventory, no un `reason` | `OUT_OF_STOCK` |
| `LOGIN_FAILED` | tipo de evento de seguridad | `INVALID_CREDENTIALS`: el `reason` que ve el cliente |

Fuentes: [`standards/grpc-conventions.md`](standards/grpc-conventions.md) §4 y la sección 4 de cada `SPEC.md`.

## 8. Eventos y tiempo real

| Concepto | Forma canónica | Ejemplo |
|---|---|---|
| Subject | `pp.<dominio>.<entidad>.<hecho>.v<N>` | `pp.payments.payment.captured.v1` |
| `event_type` del sobre | igual que el subject, **sin** `pp.` y sin versión | `payments.payment.captured` |
| Mensaje | `<paquete>.<HechoEnPasado>` | `payments.PaymentCaptured` |
| Sobre | `plentypay.events.v1.EventEnvelope` | campos: `event_id`, `event_type`, `schema_version`, `producer`, `tenant_id`, `aggregate_id`, `occurred_at`, `trace_id`, `payload` |
| Stream | `PP_<GRUPO>` (columna de §1) | `PP_COMMERCE` |
| Consumidor durable | `<contenedor>-<propósito>` | `notifications-payment-captured` |
| Cola de descarte | `pp.dlq.<consumidor>` | — |
| Auditoría | `pp.audit.<contenedor>.recorded.v1` | lo publica cualquier contenedor |

`producer` lleva el nombre del **contenedor** (`payments-core`), no el del paquete. Catálogo de eventos con productor y consumidores: [`standards/events-and-messaging.md`](standards/events-and-messaging.md) §7.

Tiempo real hacia la app: un solo WebSocket `/v1/realtime`. Topics: `inbox`, `payment.status`, `delivery`, `customer_display`, `geo.subject`, `session`. Protocolo: [`../api-gateway/SPEC.md`](../api-gateway/SPEC.md) §5.

## 9. Configuración

| Variable | Significado |
|---|---|
| `<SERVICIO>_GRPC_ADDR` | Dirección donde escucha el propio servicio (`LEDGER_GRPC_ADDR=:50061`) |
| `<SERVICIO>_ADDR` | Dirección de una dependencia gRPC (`LEDGER_ADDR`, `IDENTITY_ADDR`) |
| `DATABASE_URL` | PostgreSQL del contenedor (vía PgBouncer) |
| `NATS_URL` | Bus de eventos |
| `SCYLLA_HOSTS` | ScyllaDB |
| `OBJECT_STORAGE_*` | Garage (S3) |
| `ADMIN_PORT` | Puerto de administración; por defecto `9100` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Colector de OpenTelemetry |
| `*_MS`, `*_SECONDS`, `*_MINUTES` | Duraciones: la unidad va en el nombre |
| `*_MINOR` | Monto en centavos (`STEP_UP_THRESHOLD_MINOR`) |

Excepciones ya implementadas, a alinear en F09.3: `api-gateway` e `identity` usan `PORT` en lugar de `<SERVICIO>_GRPC_ADDR`, y `api-gateway` usa `IDENTITY_SERVICE_URL` en lugar de `IDENTITY_ADDR`.

Rutas de administración (puerto `9100`, nunca publicado): `/healthz/live`, `/healthz/ready`, `/metrics`. La variable de cada contenedor está en la sección de configuración de su `SPEC.md`. Feature flags y límites en caliente: `infra-management` (p. ej. `rail.yappy.enabled`).

## 10. Convenciones de nombres

| Qué | Forma | Ejemplo |
|---|---|---|
| Paso del roadmap | `F<nn>.<m>` | `F10.3` |
| Regla de un SPEC | `R<n>` | `R4` |
| Invariante del ledger | `I<n>` | `I5` |
| Plantilla de asiento | `T<n>`, `REV` | `T3` |
| Vector de comisiones | letra o `R<n>` | `A`, `C-err`, `R2` |
| Flujo de dominio | `F<n>` de una cifra (dominio §7) | `F3` cobro QR. No confundir con la fase `F03` |
| Pregunta abierta | `Q-NN` | `Q-07` |
| Regla normativa | `N-<área>-<nn>`; áreas `FIS`, `AML`, `DAT`, `LAB`, `CON`, `COM`, `PAG`, `LOG`, `FMT` (Panamá) y `STD` (estándares internacionales) | `N-LAB-02`, `N-STD-10` |
| Pantalla | `S-<módulo>-<nn>` | `S-POS-02` |
| Requisito funcional | `RF-<módulo>-<nn>` | `RF-WAL-03` |
| Comportamiento común de pantalla | `C-<nn>` | `C-05` |
| Parámetro legal | `legal.pa.<área>.<nombre>` con `effective_from` | `legal.pa.css.employer_bps` |
| ADR | 4 dígitos | `0013` |
| Nivel de verificación | `L0`–`L4` | `L1` |
| Prueba | id de regla en el nombre | `TestR4_...`, `r4_...`, `test('R4 ...')` |
| Paquete proto | `plentypay.<dominio>.v1` | `plentypay.ledger.v1` |
| RPC | `VerboSustantivo` | `CreatePaymentIntent` |
| Mensajes | `<Rpc>Request` / `<Rpc>Response` | — |
| Migración | `NNNN_descripcion.up.sql` | `0003_holds.up.sql` |
| Commit | Conventional Commits, scope = contenedor | `feat(ledger): reject unbalanced entries (F10.3, R1)` |
| Widget del design system | prefijo `PP` | `PPButton` |

Idioma: identificadores, pruebas, commits, métricas y `reason` en **inglés**; documentación, comentarios y textos al usuario en **español** (`AGENTS.md` §6).

## 11. Constantes del sistema

Valores por defecto. Los marcados *configurable* se cambian en `infra-management` o por variable de entorno, nunca en código.

| Constante | Valor | Fuente |
|---|---|---|
| Moneda base | `USD` (Balboa paritario 1:1) | dominio §10.1 |
| Zona de fechas de negocio | `America/Panama` (UTC−5, sin horario de verano) | dominio §10.2 |
| Cobro único máximo | 10 000.00 USD *(configurable, Q-01)* | dominio §10.3 |
| Saldo máximo de wallet personal | 5 000.00 USD *(configurable, Q-01)* | dominio §10.3 |
| Umbral de step-up en pagos | 100.00 USD (`STEP_UP_THRESHOLD_MINOR=10000`) *(configurable hacia abajo)* | seguridad §4 |
| Expiración de un intent | 15 min (`INTENT_DEFAULT_TTL_SECONDS=900`) | dominio §6.1 |
| TTL de un hold | 15 min (`HOLD_DEFAULT_TTL_SECONDS=900`) | dominio §8.4 |
| TTL de reserva de inventario | expiración del intent + 5 min | dominio §8.13 |
| SLA de aceptación de sub-pedido | 15 min (`ACCEPT_SLA_MINUTES`) | dominio §8.10 |
| Intentos de entrega | máximo 3 | dominio §8.11 |
| Reintentos de UNKNOWN | 30 s, 1, 2, 5, 15, 30 min, 1 h, luego cada hora hasta 24 h | dominio §6.3 |
| Alerta por `CAPTURED` sin asiento | 5 min | dominio §6.2 |
| `SUSPENSE` debe volver a 0 | ≤ 5 días | dominio §5.1 |
| Precios de catálogo | incluyen ITBMS (`tax_included=true`) | dominio §10.4 |
| Access token / refresh token | 15 min / 30 días | seguridad §2 |
| Token de step-up | un uso, 5 min | seguridad §4 |
| Contraseña | 12 a 128 caracteres | seguridad §2 |
| `idempotency_key` | 16–100 caracteres, única por (tenant, RPC); en `ledger` es global | gRPC §3 |
| Retención de tablas estándar | `idempotency_keys` 72 h · `outbox` publicado 7 d · `processed_events` 14 d | datos §6 |
| Deadlines | lectura 3 s · escritura 10 s · riel externo 30 s | gRPC §5 |
| Reintento automático | backoff 100 ms ×2, tope 2 s, máximo 3 intentos | gRPC §5 |
| Entrega de eventos | `max_deliver=10`, `AckWait` 30 s | eventos §2 y §5 |
| Cuerpo HTTP máximo | 1 MiB (256 KB en webhooks, 10 MiB en importaciones) | gateway SPEC §3 |
| WebSocket | 20 suscripciones por conexión, ping cada 25 s | gateway SPEC §5 |

"gRPC" = [`standards/grpc-conventions.md`](standards/grpc-conventions.md); "datos" = [`standards/data-standards.md`](standards/data-standards.md).

## 12. Términos retirados

Aparecen en los documentos `00`–`04` y en `_legacy-typescript-reference/`. No se usan en código nuevo.

| Retirado | Usar |
|---|---|
| `SUPER_ADMIN` | `PLATFORM_ADMIN` |
| `CLIENT` (rol) | `CUSTOMER` |
| `ALWAYS_DGI` | `ALWAYS_FISCAL` |
| `Courier` (entidad) | `Driver` |
| `/readyz` y `/healthz` en el puerto admin | `/healthz/live`, `/healthz/ready` (el `GET /healthz` público del gateway en 8080 sigue vigente) |
