# Modelo de dominio

Fuente de verdad de **las reglas de negocio transversales**: quién es quién, cómo se calcula el dinero, cómo se asienta, qué estados existen y qué transiciones son legales. Los SPEC de cada contenedor referencian secciones de aquí; las pruebas usan los vectores literales de §4 y las tablas de §8.

## 1. Contextos acotados (bounded contexts) y dueños

| Contexto | Dueño (contenedor) | Agregados raíz |
|---|---|---|
| Identidad y tenencia | identity | User, Tenant (Business), Session, Role, StepUpChallenge |
| Libro contable | ledger | Account, LedgerTransaction (+Entries), Hold |
| Pagos | payments-core | PaymentIntent, Payment, PaymentAttempt, Refund, Terminal, FeePolicy |
| Liquidación | settlement | SettlementBatch, PayoutSchedule, ReconciliationItem |
| Fiscal | fiscal-invoicing | FiscalProfile, Invoice (doc fiscal), FolioRange |
| Catálogo | catalog | Product, Variant, PriceList, Listing (marketplace), Category |
| Inventario | inventory | Warehouse, StockLevel, StockMovement, Lot, Reservation, PurchaseOrder, Supplier |
| Pedidos | orders | Cart, Order, SubOrder |
| Punto de venta | pos | Register, CashSession, Sale (+Lines, Tenders), CashMovement, CustomerAccount (crédito de la casa: detalle) |
| Logística | logistics | Delivery, Carrier (transportista), Driver (repartidor), DeliveryAttempt, TrackingLink |
| Geolocalización | geolocation | Subject location, Geofence |
| Nómina | payroll | Employee, Shift, AttendanceRecord, PayrollRun, Payslip |
| Notificaciones | notifications | Template, Message, InboxItem, ChannelPreference |
| Analítica | analytics-bi | proyecciones (no es fuente de verdad de nada) |
| Seguridad | security | Secret, DataKey, AuditEvent, Block |
| Plataforma | infra-management | FeatureFlag, ClientConfig, RateLimitPolicy, MaintenanceWindow |

Un agregado tiene **un** dueño. Otros contenedores guardan como mucho una **instantánea** (copia con fecha) o una referencia por id.

## 2. Glosario
Términos de negocio esenciales. El glosario completo del proyecto (tipos, enums, permisos, `reason`, eventos, variables y constantes) está en [`../glossary.md`](../glossary.md).

- **Party**: quien puede tener cuentas en el ledger. `user_id` (persona), `tenant_id` (comercio) o **PLATFORM** = `00000000-0000-0000-0000-000000000001` (PlentyPay).
- **Tenant**: comercio (negocio). Puede tener varias sucursales (`branch_id`) y bodegas.
- **Riel (rail)**: medio de pago externo o interno (`common.PaymentRail`): WALLET, YAPPY, TELERED_CLAVE, CARD, APPLE_PAY, GOOGLE_PAY, QR_INTEROP, CASH.
- **Monto bruto (gross)**: lo que paga el pagador al comercio antes de comisiones.
- **Neto del comercio (merchant_net)**: lo que el comercio recibe en `MERCHANT_PAYABLE`.
- **Captura**: el momento en que el dinero queda confirmado por el riel; dispara el asiento contable.
- **UNKNOWN**: no sabemos si el riel cobró (timeout, error ambiguo). Estado de primera clase.
- **Hold**: reserva de saldo disponible de una cuenta (wallet) mientras se completa algo.
- **Liquidación (settlement)**: transferir al comercio lo que se le debe.
- **Conciliación**: comparar registros internos contra extractos de rieles/bancos.
- **CUFE**: código único de factura electrónica de la DGI (Panamá).
- **PAC**: proveedor autorizado de certificación que transmite a la DGI.
- **ITBMS**: impuesto (7 % general) — aplicación sobre comisiones: pregunta abierta Q-07.
- **Step-up**: confirmación fuerte adicional (biometría/passkey) para una operación concreta.
- **Instantánea (snapshot)**: copia inmutable de datos de otro contexto en un momento (p. ej. precio y nombre del producto en una línea de pedido).

## 3. Identidad y tenencia
1. Un **User** tiene un `UserRole` base (`PLATFORM_ADMIN`, `BUSINESS_OWNER`, `BUSINESS_STAFF`, `CUSTOMER`) y, si es staff, un `Role` personalizado del tenant con permisos (`security-standards.md` §3).
2. Un usuario pertenece como máximo a **un** tenant como staff/dueño (MVP). Una persona que es cliente y además dueño usa la misma cuenta: su wallet personal es `party=user_id`, la del negocio `party=tenant_id`.
3. **Tenant.status**: `PENDING_REVIEW` (puede configurar catálogo, no puede cobrar ni aparecer en marketplace) → `ACTIVE` | `REJECTED`; `ACTIVE` ↔ `SUSPENDED`. Solo `PLATFORM_ADMIN` cambia estados (`platform:tenants:review`). payments-core rechaza cobros de tenants no `ACTIVE` con `FAILED_PRECONDITION` `TENANT_NOT_ACTIVE`.
4. KYB mínimo para `ACTIVE`: RUC + DV, razón social, aviso de operación, representante legal (cédula cifrada), cuenta bancaria de liquidación verificada, aceptación de términos. Documentos en object-storage, datos sensibles cifrados (`security.Encrypt`).
5. El **tenant del contexto** es siempre el del usuario autenticado; un `PLATFORM_ADMIN` que actúa sobre un tenant lo hace con RPC de plataforma explícitos y auditados.

## 4. Motor de comisiones (fee engine) — payments-core

### 4.1 Selección de política
Para un cobro `(tenant, rail, amount)`: la `FeePolicy` activa más específica cuya `effective_from ≤ now`: (tenant, rail) > (tenant, cualquier riel) > (global, rail) > (global, cualquier riel). Debe existir siempre una global; si no → `FAILED_PRECONDITION` `FEE_POLICY_MISSING`. La política aplicada se **congela** en el Payment al capturar (`Payment.fees`).

### 4.2 Fórmula (enteros; nunca flotantes)
```
half_up(v, bps)   = (v * bps + 5000) / 10000        // división entera, v ≥ 0, cálculo en 128 bits
platform_fee      = fixed_fee_minor + half_up(gross, percentage_bps)
tax               = half_up(platform_fee, tax_rate_bps)              // ITBMS sobre la comisión (Q-07)
rail_fee          = rail_fixed_fee_minor + half_up(gross, rail_percentage_bps)
merchant_net      = gross − platform_fee − tax − rail_fee
```
Por portador (`FeeBearer`):
- **MERCHANT** (defecto): fórmula tal cual.
- **CUSTOMER**: comisión de plataforma e impuesto se suman al cobro: `total_charged = base + platform_fee + tax` (calculadas sobre `base`); `merchant_net = base − rail_fee`. La UI muestra el desglose antes de confirmar.
- **PLATFORM** (promoción): `platform_fee = 0`, `tax = 0`; el comercio sigue asumiendo `rail_fee`.

Reglas: `merchant_net ≥ 0` o el intent se rechaza con `FAILED_PRECONDITION` `AMOUNT_BELOW_FEES`. Invariante del `FeeBreakdown`: `gross == merchant_net + Σ lines` (líneas `PLATFORM`, `TAX`, `RAIL`). Todo residuo de redondeo queda en `merchant_net` (por construcción).

### 4.3 Repartos (marketplace, splits)
Con splits, la fórmula se aplica **por split** (cada comercio paga su comisión sobre su parte). `Σ splits.amount == intent.amount` o `INVALID_ARGUMENT` `SPLITS_MISMATCH`. Para repartir un monto por pesos (descuentos globales, envío compartido) se usa `allocate`: cada parte = `floor(total * w_i / Σw)`; el residuo se asigna de a 1 centavo a las partes de **mayor resto fraccional**, desempatando por orden de entrada.

### 4.4 Reembolsos
Para un reembolso `R` de un pago con `gross g`, comisiones `pf`, `tax`, `rf`:
```
pf_r  = half_up_ratio(pf,  R, g)      // round_half_up(pf * R / g) = (2*pf*R + g) / (2*g)
tax_r = half_up_ratio(tax, R, g)
rf_r  = rail_fee_refundable ? half_up_ratio(rf, R, g) : 0          // Q-06
merchant_debit = R − pf_r − tax_r − rf_r
```
- El **último** reembolso (el que completa el capturado) usa el remanente exacto (`pf − Σ pf_r previos`, etc.) para que nunca se devuelva más comisión que la cobrada.
- `Σ reembolsos ≤ captured` o `FAILED_PRECONDITION` `REFUND_EXCEEDS_CAPTURED`.
- Si el `MERCHANT_PAYABLE` disponible del comercio < `merchant_debit` → `FAILED_PRECONDITION` `MERCHANT_BALANCE_INSUFFICIENT` (salvo flag de plataforma `allow_negative_merchant_balance` para ese tenant).

### 4.5 Vectores de prueba (obligatorios, literales)
Verificados con aritmética entera de referencia.

| Id | Entrada | platform_fee | tax | rail_fee | merchant_net / resultado |
|---|---|---|---|---|---|
| **A** | gross 10000, YAPPY, fixed 0, pct 250, tax 700, rail 0+100 bps, MERCHANT | 250 | 18 | 100 | **9632** |
| **B** | gross 1234, fixed 0, pct 250, tax 700, rail 0, MERCHANT (half-up 30.85→31; 2.17→2) | 31 | 2 | 0 | **1201** |
| **C** | gross 25, fixed 10, pct 290, tax 700, rail 0 | 11 | 1 | 0 | **13** |
| **C-err** | gross 10, fixed 10, pct 290, tax 700, rail 0 | 10 | 1 | 0 | −1 → **AMOUNT_BELOW_FEES** |
| **D** | base 5000, fixed 10, pct 250, tax 700, rail 0, **CUSTOMER** | 135 | 9 | 0 | total_charged **5144**, merchant_net **5000** |
| **E** | intent 10000 con splits A=6000 y B=4000, pct 250, tax 700, rail 100 bps | A:150 / B:100 | A:11 / B:7 | A:60 / B:40 | A **5779**, B **3853** |
| **R1** | reembolso 2500 de A, rail no reembolsable | pf_r 63 | tax_r 5 | rf_r 0 | merchant_debit **2432** |
| **R2** | reembolso 2500 de A, rail reembolsable | pf_r 63 | tax_r 5 | rf_r 25 | merchant_debit **2407** |
| **R3** | reembolso total 10000 de A, rail no reembolsable | 250 | 18 | 0 | merchant_debit **9732** |

## 5. Ledger

### 5.1 Plan de cuentas
Una cuenta = `(party_id, type, currency, scope_id)`; se crea perezosamente. Lado normal: **activos** saldo = Σdébitos − Σcréditos; **pasivos/ingresos** saldo = Σcréditos − Σdébitos.

| Tipo | Clase | Party | Puede ser negativa |
|---|---|---|---|
| WALLET | pasivo | user / tenant | **no** (salvo sub-libro de puntos del emisor) |
| MERCHANT_PAYABLE | pasivo | tenant | no (salvo flag §4.4) |
| PLATFORM_FEES | ingreso | PLATFORM | sí (reembolsos de comisión) |
| TAX_PAYABLE | pasivo | PLATFORM | no |
| RAIL_RECEIVABLE | activo | PLATFORM (una por riel vía `scope_id = rail`) | sí transitoria (reembolsos antes de liquidación) |
| RAIL_FEES_PAYABLE | pasivo | PLATFORM (`scope_id = rail`) | no |
| BANK_CASH | activo | PLATFORM (`scope_id = cuenta bancaria`) | no |
| LOYALTY_POINTS | pasivo (memo, moneda `PTS`) | user / tenant emisor (`scope_id = tenant`) | emisor sí |
| CUSTOMER_CREDIT | activo (memo) | user deudor / tenant acreedor (`scope_id = tenant`) | acreedor sí |
| FUNDING_SOURCE | activo transitorio | PLATFORM (`scope_id = rail`) | sí |
| SUSPENSE | transitorio | PLATFORM | debe volver a 0 en ≤ 5 días (alerta) |

**Disponible** de una cuenta = saldo − Σ holds `ACTIVE` sobre ella.

### 5.2 Plantillas de asiento (las únicas permitidas; `template` se guarda en la transacción)
D = débito, C = crédito; todos los montos > 0; omitir líneas en 0.

| Id | Hecho | Asientos | Clave de idempotencia |
|---|---|---|---|
| **T1** recarga de wallet | riel externo confirma recarga `g` del usuario `u` | D RAIL_RECEIVABLE(PLATFORM, rail) g · C WALLET(u) g | `topup:<payment_id>` |
| **T2** cobro por riel externo | captura de `g` para comercio `m` | D RAIL_RECEIVABLE(PLATFORM, rail) g · C MERCHANT_PAYABLE(m) net · C PLATFORM_FEES pf · C TAX_PAYABLE tax · C RAIL_FEES_PAYABLE(rail) rf | `pay:<payment_id>` |
| **T3** cobro con wallet | pagador `u` paga `g` a `m` (requiere hold previo) | D WALLET(u) g · C MERCHANT_PAYABLE(m) net · C PLATFORM_FEES pf · C TAX_PAYABLE tax | `pay:<payment_id>` |
| **T4** transferencia P2P | `u1` envía `g` a `u2` | D WALLET(u1) g · C WALLET(u2) g | `p2p:<transfer_id>` |
| **T5** liquidación del riel | el riel deposita a PlentyPay lo cobrado (`g` bruto, `rf` comisión) | D BANK_CASH (g − rf) · D RAIL_FEES_PAYABLE(rail) rf · C RAIL_RECEIVABLE(rail) g | `railsettle:<statement_line_id>` |
| **T6** pago al comercio (banco) | settlement transfiere `x` a la cuenta bancaria de `m` | D MERCHANT_PAYABLE(m) x · C BANK_CASH x | `payout:<batch_id>` |
| **T6b** pago al comercio (wallet) | settlement acredita `x` en la wallet del negocio | D MERCHANT_PAYABLE(m) x · C WALLET(m) x | `payout:<batch_id>` |
| **T7** reembolso | reembolso `R` (§4.4) | D MERCHANT_PAYABLE(m) merchant_debit · D PLATFORM_FEES pf_r · D TAX_PAYABLE tax_r · D RAIL_FEES_PAYABLE rf_r · C RAIL_RECEIVABLE(rail) R *(o C WALLET(u) R si se pagó con wallet)* | `refund:<refund_id>` |
| **T8** puntos de lealtad | comercio `m` otorga `n` puntos a `u` (canje = inverso) | D LOYALTY_POINTS(m, scope m, PTS) n · C LOYALTY_POINTS(u, scope m, PTS) n | `loyalty:<sale_id>` / `redeem:<id>` |
| **T9** venta a crédito | `m` vende a crédito `x` a `u` | D CUSTOMER_CREDIT(u, scope m) x · C CUSTOMER_CREDIT(m, scope m) x | `credit:<sale_id>` |
| **T9b** abono a crédito | `u` abona `x` (en efectivo o vía un cobro T2/T3 separado) | D CUSTOMER_CREDIT(m, scope m) x · C CUSTOMER_CREDIT(u, scope m) x | `creditpay:<payment_or_cash_id>` |
| **T10** pago de nómina | comercio `m` paga `x` al empleado `u` desde su wallet | D WALLET(m) x · C WALLET(u) x | `payroll:<run_id>:<employee_id>` |
| **REV** reverso | corrige una transacción posteada | mismas líneas con lados invertidos, `reverses_transaction_id` | `rev:<transaction_id>` |

**Correspondencia plantilla ↔ `PostTransactionRequest.transaction_type`** (valor que se guarda y se valida en ledger): T1 `WALLET_TOPUP` · T2 `PAYMENT_CAPTURE` · T3 `WALLET_PAYMENT` · T4 `P2P_TRANSFER` · T5 `RAIL_SETTLEMENT` · T6 `PAYOUT` · T6b `PAYOUT_TO_WALLET` · T7 `REFUND` · T8 `LOYALTY_ISSUE` / `LOYALTY_REDEEM` · T9 `CREDIT_SALE` · T9b `CREDIT_REPAYMENT` · T10 `PAYROLL_PAYMENT` · REV `REVERSAL`. El ledger valida la **forma** de cada tipo (qué tipos de cuenta y lados admite) además del balance.

Cualquier asiento que no siga una plantilla es rechazado por ledger (`INVALID_ARGUMENT` `UNKNOWN_TEMPLATE`). Plantillas nuevas = cambio a este documento + ADR si afectan dinero real.

### 5.3 Invariantes (comprobadas en código **y** en la BD con triggers/índices)
- **I1** Cada transacción balancea **por moneda**: Σ débitos = Σ créditos; mínimo 2 asientos.
- **I2** Todo `amount_minor > 0`; el sentido lo da `side`.
- **I3** `POSTED` es inmutable: ni UPDATE ni DELETE de transacción ni de asientos; no se agregan asientos a una transacción posteada. Corrección = **REV** (una transacción solo puede revertirse una vez).
- **I4** Exactamente una vez: `UNIQUE (idempotency_key)`; además índice único parcial "una captura por pago" (`transaction_type IN ('PAYMENT_CAPTURE','WALLET_PAYMENT') → UNIQUE(reference_type, reference_id)`).
- **I5** Cuentas que no pueden ser negativas (tabla §5.1) se validan con bloqueo de fila y orden ascendente por `account_id`; si el disponible no alcanza → `FAILED_PRECONDITION` `INSUFFICIENT_FUNDS`.
- **I6** Una transacción no mezcla cuentas de distinto `tenant` salvo party PLATFORM (excepto T4/T10, donde ambos parties están en la misma moneda y la operación lleva actor autorizado).
- **I7** Suma global por moneda de todos los saldos (con signo por clase) = 0 (job diario; alerta crítica si ≠ 0).
Especificación ejecutable de referencia de I1–I4: `scripts/ledger-tests` (27 casos).

## 6. Pagos (payments-core)

### 6.1 Modelo
- **PaymentIntent**: la intención de cobrar (monto, riel, splits, referencia, expiración 15 min por defecto). Idempotente por `(tenant, idempotency_key)`.
- **Payment**: el cobro concreto (uno por intent en MVP). Estado §8.1, `captured`, `refunded`, `fees` congeladas.
- **PaymentAttempt**: cada llamada a un riel (reintentos, cambios de método). Estado §8.2. Guarda `external_ref` del riel.
- **Refund**: §8.3.
- `ledger_posting_status` del Payment: `PENDING` → `POSTED` | `FAILED`.

### 6.2 Reglas
1. payments-core es el **único** que habla con rieles y el **único** que pide asientos de cobro/reembolso al ledger.
2. Ninguna transacción de BD abarca una llamada a riel: se persiste el attempt `PROCESSING` → se llama al riel → se persiste el resultado.
3. Captura confirmada ⇒ en la misma transacción local: Payment `CAPTURED`, `ledger_posting=PENDING`, outbox `PaymentCaptured`. Un worker llama `ledger.PostTransaction` con clave `pay:<payment_id>` hasta `POSTED` (reintentos con backoff). `CAPTURED` sin asiento > 5 min = alerta crítica.
4. Wallet (T3): `CreateHold` al autorizar → `CaptureHold` + asiento T3 en una sola llamada a ledger (`PostTransaction` con `hold_id`) → el hold pasa a `CAPTURED` atómicamente.
5. Un webhook y la consulta activa son fuentes de la misma verdad; si discrepan → estado `UNKNOWN` + caso de conciliación.

### 6.3 Protocolo UNKNOWN
1. Se entra a `UNKNOWN` cuando el riel no responde dentro del deadline, devuelve error ambiguo (5xx, timeout, conexión cortada después de enviar) o webhook/consulta se contradicen.
2. **Nunca** se trata como `FAILED` (el cliente podría haber pagado) ni como `CAPTURED` (podría no haber pagado). La UI muestra "Confirmando tu pago".
3. Resolución activa con backoff: 30 s, 1 min, 2 min, 5 min, 15 min, 30 min, 1 h, luego cada hora hasta 24 h (consulta de estado al riel por `external_ref` o por idempotency del riel).
4. Alertas: warning a 15 min, crítica a 1 h.
5. A las 24 h sin resolución: caso manual en la consola de plataforma; resolución con **evidencia** (extracto, captura del riel) por `platform:reconcile`, auditada; transición a `CAPTURED` (con asiento) o `FAILED`.
6. El comercio ve el pago como "en verificación"; no entrega bienes de alto valor hasta resolución (recomendación en UI).

## 7. Flujos principales (resumen; detalle de pasos en cada SPEC)
- **F1 Registro e ingreso**: Flutter → gateway `/v1/auth/register` → identity (`CUSTOMER`) → tokens → `/v1/me/permissions` → módulos visibles.
- **F2 Alta de negocio**: usuario → `CreateBusiness` → tenant `PENDING_REVIEW` → KYB → plataforma `ReviewBusiness` → `ACTIVE` → evento `TenantStatusChanged` → payments-core habilita cobros, catalog habilita listados.
- **F3 Cobro QR/NFC en mostrador**: comercio crea terminal (código público) → cliente escanea QR o toca tag NDEF → app `GET /v1/pay-links/<code>` (nombre verificado) → monto → biometría/step-up → `CreatePaymentIntent` + `ConfirmPayment` (riel wallet o externo) → resultado por WebSocket → recibo (fiscal si aplica).
- **F4 Venta POS multi-pago**: cajero abre sesión de caja → arma venta (catalog) → tenders (efectivo + tarjeta + wallet) → cada tender electrónico es un Payment → `SalePaid` cuando Σ tenders = total → inventory descuenta → fiscal emite → recibo/customer display.
- **F5 Marketplace multi-comercio**: carrito con productos de A y B → `orders.Checkout` → reserva inventario por comercio → un PaymentIntent con splits → captura → Order `PAID`, SubOrders `AWAITING_ACCEPTANCE` → cada comercio acepta (15 min) o rechaza (reembolso parcial automático) → logistics → entrega → `COMPLETED`.
- **F6 Liquidación**: settlement agrupa `MERCHANT_PAYABLE` disponible por comercio según calendario → lote `OPEN` → `PROCESSING` (transferencia bancaria/ACH o wallet) → T6/T6b → `PAID`; conciliación diaria contra extractos (T5).
- **F7 Nómina**: turnos → marcajes (biometría/QR dinámico/NFC + geocerca) → `PayrollRun DRAFT` → revisión → `APPROVED` (step-up) → `PAYING` (T10 por empleado vía payments-core) → `PAID` / `PARTIALLY_FAILED`.
- **F8 Facturación**: venta/pedido pagado → preferencia fiscal del tenant (§8.8) → Invoice `DRAFT` → `QUEUED` → PAC → `ACCEPTED` (CUFE + QR) o `REJECTED` (corregir y reemitir) → PDF/XML a object-storage → notificación al cliente.

## 8. Máquinas de estado (transiciones legales; todo lo demás es `FAILED_PRECONDITION` `INVALID_STATE_TRANSITION`)

### 8.1 Payment (`PaymentStatus`)
| Desde | Evento | Hacia |
|---|---|---|
| CREATED | requiere acción del pagador | REQUIRES_ACTION |
| CREATED / REQUIRES_ACTION | enviado al riel | PROCESSING |
| PROCESSING | riel autoriza (dos pasos) | AUTHORIZED |
| PROCESSING / AUTHORIZED | riel confirma captura | CAPTURED |
| PROCESSING / REQUIRES_ACTION | riel rechaza | FAILED |
| PROCESSING / AUTHORIZED | timeout o respuesta ambigua | UNKNOWN |
| UNKNOWN | consulta confirma captura / rechazo | CAPTURED / FAILED |
| CREATED / REQUIRES_ACTION / AUTHORIZED | cancelación del comercio o pagador | CANCELLED (AUTHORIZED libera fondos en el riel) |
| CREATED / REQUIRES_ACTION | vence `expires_at` | EXPIRED |
Terminales: CAPTURED (admite reembolsos sin cambiar de estado; `refunded` acumula), FAILED, CANCELLED, EXPIRED.

### 8.2 PaymentAttempt (`AttemptStatus`)
CREATED → PROCESSING → AUTHORIZED → CAPTURED; PROCESSING → FAILED; PROCESSING/AUTHORIZED → UNKNOWN → CAPTURED/FAILED. Un Payment puede tener varios attempts FAILED y como máximo **uno** CAPTURED.

### 8.3 Refund (`RefundStatus`)
PENDING → SUCCEEDED (asiento T7 posteado) | FAILED (riel rechaza; sin asiento). PENDING con respuesta ambigua sigue PENDING y aplica el protocolo UNKNOWN (§6.3) sobre el reembolso.

### 8.4 Hold (`HoldStatus`)
ACTIVE → CAPTURED (con su asiento) | RELEASED (cancelación) | EXPIRED (TTL, por defecto 15 min, job cada minuto). Ningún estado vuelve a ACTIVE.

### 8.5 LedgerTransaction
(interno DRAFT → VALIDATING) → POSTED → REVERSED (cuando existe su REV). POSTED es el único estado visible por API además de REVERSED.

### 8.6 SettlementBatch (`BatchStatus`)
OPEN → PROCESSING → PAID | FAILED; FAILED → PROCESSING (reintento manual con `settlement:schedule:manage`) . OPEN acepta nuevos ítems hasta el corte; PROCESSING congela ítems.

### 8.7 ReconciliationItem (`ReconciliationState`)
MATCHED (terminal); UNMATCHED_INTERNAL / UNMATCHED_EXTERNAL / AMOUNT_MISMATCH → RESOLVED (con nota y evidencia, `settlement:reconcile`).

### 8.8 Invoice (`InvoiceStatus`)
DRAFT → QUEUED → SENT → ACCEPTED | REJECTED; REJECTED → QUEUED (corregido); ACCEPTED → VOIDED (solo mediante nota de crédito por el total aceptada). Preferencia fiscal del tenant (`CheckoutPreference`): ALWAYS_FISCAL, INTERNAL_ONLY (recibo interno), ASK_ALWAYS (cajero elige), AUTO_THRESHOLD (fiscal si total ≥ umbral del perfil o si el cliente aporta RUC/cédula).

### 8.9 Sale (`SaleStatus`, pos)
OPEN ↔ PARKED; OPEN → AWAITING_PAYMENT → PAID; AWAITING_PAYMENT → OPEN (se quitan tenders no capturados); OPEN/PARKED/AWAITING_PAYMENT → VOIDED (`pos:void`, sin pagos capturados; si hay, primero reembolsar); PAID → PARTIALLY_REFUNDED → REFUNDED; PAID → REFUNDED.

### 8.10 Order (`OrderStatus`) y SubOrder (`SubOrderStatus`)
Order: PENDING_PAYMENT → PAID | CANCELLED (pago fallido/expirado); PAID → PARTIALLY_FULFILLED → COMPLETED; PAID → REFUNDED (todos los sub-pedidos rechazados/cancelados). Estado de Order se **deriva** de sus SubOrders.
SubOrder: PENDING_PAYMENT → AWAITING_ACCEPTANCE → ACCEPTED → READY → IN_DELIVERY → COMPLETED; AWAITING_ACCEPTANCE → REJECTED (comercio rechaza o **SLA de aceptación 15 min** vence) ⇒ reembolso automático de su split; ACCEPTED/READY → CANCELLED (con reembolso); retiro en tienda: READY → COMPLETED.

### 8.11 Delivery (`DeliveryStatus`)
PENDING → ASSIGNED → PICKED_UP → IN_TRANSIT → ARRIVED → DELIVERED (prueba: código del cliente, foto o firma); ARRIVED/IN_TRANSIT → FAILED (intento fallido; nuevo intento vuelve a ASSIGNED, **máximo 3 intentos**, luego FAILED terminal y devolución); PENDING/ASSIGNED → CANCELLED.

### 8.12 PurchaseOrder
DRAFT → SENT → PARTIALLY_RECEIVED → RECEIVED; SENT → RECEIVED; DRAFT/SENT → CANCELLED. Recepción genera `StockMovement RECEIPT`.

### 8.13 Reservation (inventario)
ACTIVE → COMMITTED (venta/pedido pagado: genera movimiento SALE) | RELEASED | EXPIRED (TTL = expiración del intent + 5 min).

### 8.14 PayrollRun
DRAFT → APPROVED (step-up, `payroll:run:approve`) → PAYING (`payroll:run:pay`) → PAID | PARTIALLY_FAILED; PARTIALLY_FAILED → PAYING (reintento de los fallidos); DRAFT editable, APPROVED no.

### 8.15 Tenant
PENDING_REVIEW → ACTIVE | REJECTED; ACTIVE ↔ SUSPENDED; REJECTED → PENDING_REVIEW (reenvío de documentos).

## 9. Referencias entre contextos (`common.Reference.type`)
`payment`, `payment_intent`, `refund`, `sale`, `order`, `sub_order`, `invoice`, `settlement_batch`, `payroll_run`, `payslip`, `delivery`, `purchase_order`, `transfer`, `topup`, `terminal`, `cash_session`, `stock_movement`. Ningún otro valor sin actualizar esta lista.

## 10. Reglas transversales
1. Moneda base **USD** (el Balboa B/. es paritario 1:1; se muestra "$" o "B/." según preferencia del tenant). Multimoneda real fuera del MVP; el modelo ya la soporta (cuenta por moneda, I1 por moneda).
2. Fechas de negocio y cortes (cierre de caja, liquidación diaria, quincenas) en `America/Panama` (UTC−5, sin horario de verano).
3. Montos máximos por defecto: cobro único ≤ 10 000.00 USD; wallet de persona ≤ 5 000.00 USD de saldo (límites regulatorios a confirmar con SBP, Q-01); configurables en infra-management.
4. Precios en catálogo **incluyen** ITBMS por defecto (`tax_included=true`); el detalle de impuesto por línea lo calcula pos/orders con `half_up` por línea y lo envía a fiscal.
5. Cantidades de inventario en milésimas (`*_milli`) para productos a granel.
