# SPEC — payments-core

## 1. Responsabilidad
**Hace**: orquesta todo cobro electrónico: PaymentIntent → Payment → PaymentAttempt, adaptadores por riel (Wallet, Yappy, TELERED/Clave, tarjeta vía PSP, Apple Pay, Google Pay, QR interoperable), motor de comisiones, reembolsos, terminales (QR/NFC de cobro), webhooks de rieles, protocolo UNKNOWN, y pide al ledger los asientos de captura y reembolso.
**No hace**: llevar saldos (ledger), liquidar a comercios (settlement), carritos o ventas (orders/pos), recibir efectivo (pos lo registra como tender sin pasar por aquí).

## 2. Ficha
| Campo | Valor |
|---|---|
| Lenguaje | **Rust** |
| Puerto / admin | 50062 / 9100 |
| Contrato | `payments.proto` |
| Esquema | `payments` |
| Otros | NATS (publica/consume) |
| Fase | F11 (wallet + sandbox), F23 (rieles reales según credenciales), F28 (certificaciones) |
| Capa | L3 |

**Estado** (2026-10-20): 📝 F11.3 L2 ✅. Reescrito según `rust-standards.md` §3. Hechos:
- dominio: comisiones con vectores A–E y R1–R3, máquinas de estado §8.1/§8.2;
- migración con RLS y sin DELETE;
- intents y pagos wallet con hold y captura T3;
- outbox y relay;
- proyección de `TenantStatusChanged`;
- terminales;
- políticas de comisión;
- jobs R7/R9 y R14.

Evidencia: `./payments-core/test/test_l2.sh` contra ledger, identity e infra-management efímeros (25 L2, 18 unitarias, 15 vectores). Pendiente:
- rutas del gateway y despliegue (L4 de F11.3);
- reembolsos (F11.6);
- rieles externos sandbox y UNKNOWN de riel (F11.7);
- webhooks (F11.8);
- `PostMemoEntry` (F17).

## 3. Modelo de datos
```sql
CREATE TABLE payments.intents (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, payer_party_id uuid,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), currency char(3) NOT NULL,
  rail smallint NOT NULL, status smallint NOT NULL, terminal_id uuid,
  reference_type text, reference_id text, metadata jsonb NOT NULL DEFAULT '{}',
  splits jsonb NOT NULL DEFAULT '[]', sandbox boolean NOT NULL,
  next_action jsonb, expires_at timestamptz NOT NULL,
  idempotency_key text NOT NULL, request_hash bytea NOT NULL,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE payments.payments (
  id uuid PRIMARY KEY, intent_id uuid NOT NULL UNIQUE, tenant_id uuid NOT NULL,
  status smallint NOT NULL, rail smallint NOT NULL,
  amount_minor bigint NOT NULL, captured_minor bigint NOT NULL DEFAULT 0, refunded_minor bigint NOT NULL DEFAULT 0,
  currency char(3) NOT NULL, fees jsonb,                      -- FeeBreakdown congelado al capturar (+ por split)
  fee_policy_id uuid, ledger_posting smallint NOT NULL DEFAULT 1, ledger_transaction_id uuid,
  unknown_since timestamptz, next_check_at timestamptz,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1,
  CHECK (refunded_minor <= captured_minor)
);
CREATE INDEX payments_tenant_time ON payments.payments (tenant_id, created_at DESC, id DESC);
CREATE INDEX payments_unknown ON payments.payments (next_check_at) WHERE status = 9;
CREATE INDEX payments_posting_pending ON payments.payments (updated_at) WHERE ledger_posting = 1 AND status = 5;
CREATE TABLE payments.attempts (
  id uuid PRIMARY KEY, payment_id uuid NOT NULL, attempt_number int NOT NULL, rail smallint NOT NULL,
  status smallint NOT NULL, external_ref text, rail_idempotency_key text NOT NULL,
  error_code text, raw_response_ref text,          -- clave en object-storage si hace falta guardar respuesta (sin datos de tarjeta)
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  UNIQUE (payment_id, attempt_number)
) PARTITION BY RANGE (created_at);
CREATE UNIQUE INDEX one_captured_attempt ON payments.attempts (payment_id) WHERE status = 4;
CREATE INDEX attempts_external ON payments.attempts (rail, external_ref);
CREATE TABLE payments.refunds (
  id uuid PRIMARY KEY, payment_id uuid NOT NULL, tenant_id uuid NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status smallint NOT NULL, reason text, fee_reversal jsonb NOT NULL,   -- pf_r, tax_r, rf_r, merchant_debit
  external_ref text, ledger_transaction_id uuid, idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE payments.terminals (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, label text NOT NULL,
  public_code text NOT NULL UNIQUE CHECK (public_code ~ '^[A-Za-z0-9_-]{8,64}$'),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL
);
CREATE TABLE payments.fee_policies ( -- columnas = FeePolicy del .proto
  id uuid PRIMARY KEY, tenant_id uuid, rail smallint NOT NULL DEFAULT 0, fixed_fee_minor bigint NOT NULL,
  percentage_bps int NOT NULL CHECK (percentage_bps BETWEEN 0 AND 10000), bearer smallint NOT NULL,
  tax_rate_bps int NOT NULL, rail_fixed_fee_minor bigint NOT NULL DEFAULT 0, rail_percentage_bps int NOT NULL DEFAULT 0,
  rail_fee_refundable boolean NOT NULL DEFAULT false, active boolean NOT NULL, effective_from timestamptz NOT NULL
);
CREATE TABLE payments.webhook_events (rail smallint, provider_event_id text, received_at timestamptz NOT NULL,
  payload_ref text, PRIMARY KEY (rail, provider_event_id));
CREATE TABLE payments.tenant_status (tenant_id uuid PRIMARY KEY, status smallint NOT NULL, updated_at timestamptz NOT NULL); -- proyección de TenantStatusChanged
-- + outbox, processed_events
```
Diferencias de la migración `0001_initial.sql` con el modelo de arriba, decididas en F11.3:
- `intents`:
  - agrega `created_by`, `payer_party_id`, `amount_minor` y `currency`;
  - la clave única es `(tenant_id, created_by, idempotency_key)`, para que dos pagadores del mismo comercio no choquen (R1).
- `payments`: agrega `payer_party_id`, `hold_id`, `sandbox`, `confirm_idempotency_key`, `failure_code` y `captured_at`.
- `terminals`: agrega `created_by` e `idempotency_key`, única por negocio.
- `fee_policies`: agrega `created_by`, `idempotency_key` y `request_hash`.
- `attempts` todavía no está particionada: el índice único parcial por pago no convive con la clave de partición. Se particiona en F29.
- Triggers: un pago CAPTURED, FAILED, CANCELLED o EXPIRED no cambia ni de monto ni de comisiones (solo `refunded_minor` puede crecer). Los términos de un intent (monto, moneda, negocio, splits) son inmutables.
- RLS en las 10 tablas: el servicio ve todo; una lectura desde el gateway ve lo de su negocio o lo que pagó.
- `payments_svc` no tiene DELETE.

## 4. RPCs
| RPC | Permiso (metadatos) | Idemp. | Comportamiento | Errores |
|---|---|---|---|---|
| CreatePaymentIntent | `payments:charge` (comercio cobra) o `wallet:pay`/`wallet:topup`/`wallet:transfer` (persona) | sí | valida tenant ACTIVE, límites, splits, step-up si ≥ umbral; calcula cotización; crea intent `CREATED` (o `REQUIRES_ACTION` con `next_action` para rieles con aprobación del pagador) | `TENANT_NOT_ACTIVE`, `AMOUNT_OUT_OF_RANGE`, `SPLITS_MISMATCH`, `AMOUNT_BELOW_FEES`, `FEE_POLICY_MISSING`, `STEP_UP_REQUIRED`, `STEP_UP_INVALID`, `RAIL_DISABLED`, `TERMINAL_INACTIVE`, `CURRENCY_MISMATCH`, `INVALID_METADATA`, `INVALID_REFERENCE`, `INVALID_EXPIRATION`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_REUSED`, `DEPENDENCY_UNAVAILABLE` |
| ConfirmPaymentIntent | pagador | sí | crea Payment + Attempt y ejecuta el riel (§6). Un reintento con la misma clave devuelve el estado actual. Si otra confirmación del mismo intent está en curso, devuelve PROCESSING/UNKNOWN sin volver a llamar al ledger. Si el intent lo creó el comercio y el monto ≥ umbral, el token de step-up va en `confirmation_data["step_up_token"]` | `INVALID_STATE_TRANSITION`, `INSUFFICIENT_FUNDS`, `TENANT_NOT_ACTIVE`, `STEP_UP_REQUIRED`, `STEP_UP_INVALID`, `RAIL_DISABLED`, `IDEMPOTENCY_KEY_REQUIRED`, `DEPENDENCY_UNAVAILABLE` |
| CancelPaymentIntent | creador o comercio | por estado | §8.1 de domain-model | `INVALID_STATE_TRANSITION` |
| GetPaymentIntent / GetPayment / ListPayments | `payments:read` o pagador propio | — | lectura con filtro por tenant/pagador | `NOT_FOUND` |
| RefundPayment | `payments:refund` + step-up | sí | §4.4 de domain-model; riel → ledger T7 | `REFUND_EXCEEDS_CAPTURED`, `MERCHANT_BALANCE_INSUFFICIENT`, `PAYMENT_NOT_CAPTURED` |
| GetRefund | `payments:read` | — | | |
| CreateTerminal / ListTerminals / SetTerminalActive | `payments:terminal:manage` | sí / — / sí | `public_code` aleatorio de 22 chars base64url; el negocio debe estar ACTIVE | `TENANT_NOT_ACTIVE`, `INVALID_LABEL`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| ResolveTerminal | autenticado | — | devuelve **nombre verificado** del comercio (de identity, cacheado) y estado | `NOT_FOUND`, `TERMINAL_INACTIVE` |
| QuoteFees | cualquiera que pueda cobrar/pagar | — | aplica §4 sin persistir | `FEE_POLICY_MISSING` |
| UpsertFeePolicy / ListFeePolicies | `platform:flags:manage` / `payments:fees:read` | sí | nunca editar una política: se crea una nueva con `effective_from`. Política del riel WALLET: la comisión de riel se ignora, porque T3 no tiene línea RAIL | `INVALID_FEE_POLICY`, `IDEMPOTENCY_KEY_REUSED` |
| HandleRailWebhook | solo api-gateway | por `provider_event_id` | verifica firma del riel, deduplica, actualiza attempt/payment o marca discrepancia | `SIGNATURE_INVALID` (→ 401) |
| ResolveUnknownPayment | `platform:reconcile` | sí | resolución manual con evidencia obligatoria (§6.3 domain-model) | `INVALID_STATE_TRANSITION`, `EVIDENCE_REQUIRED` |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-AML-01, N-AML-03, N-AML-05, N-AML-06, N-AML-12, N-PAG-01, N-PAG-03, N-PAG-06 y N-CON-01. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Intent idempotente por `(tenant, creador, idempotency_key)`, con hash canónico del request (`grpc-conventions.md` §3). El hash excluye el token de step-up, que es de un solo uso, y ordena `metadata`. El reintento se responde **antes** de consumir el step-up.
- **R2** Tenant debe estar `ACTIVE` (proyección local de `TenantStatusChanged`; si no existe proyección → `identity.GetTenant` con caché 60 s).
- **R3** Comisiones exactamente según `domain-model.md` §4 (vectores A–E, R1–R3 como pruebas literales).
- **R4** `Σ splits = amount`; cada `merchant_party_id` de un split debe ser un tenant ACTIVE.
- **R5** Step-up obligatorio (consumido con `identity.ConsumeStepUp`) para pagos y transferencias ≥ umbral (`stepup.threshold_minor` de infra-management) y para todo reembolso. Operaciones del reto:
  - `payments.intent.create`: paga la persona del contexto, por ejemplo con una terminal;
  - `payments.intent.confirm`: el cobro lo creó el comercio y la persona confirma.
- **R6** Ninguna transacción de BD abarca la llamada al riel (persistir PROCESSING → llamar → persistir resultado).
- **R7** Respuesta ambigua/timeout del riel → `UNKNOWN` (nunca FAILED). Protocolo §6.3 de domain-model con job de resolución.
- **R8** Captura confirmada → misma transacción local: Payment `CAPTURED`, `fees` congeladas, `ledger_posting=PENDING`, outbox `PaymentCaptured`; worker asienta T2/T3 con `pay:<payment_id>` hasta POSTED (backoff 1 s…5 min); >5 min sin asiento → alerta crítica.
- **R9** Wallet: Confirm crea el hold (`ledger.CreateHold`, clave `hold:<payment_id>`, 15 min) y luego llama a `CaptureHold` con las piernas T3 (clave `pay:<payment_id>`) en la misma operación lógica.
  - Error definitivo en CaptureHold → ReleaseHold y Payment FAILED.
  - `INSUFFICIENT_FUNDS` en CreateHold → FAILED sin hold.
  - Respuesta ambigua → UNKNOWN y reintento idempotente.
  - Turno: solo el que tiene el turno del pago (`next_check_at`, 30 s) llama al ledger. Así, confirmaciones simultáneas y el job de reanudación (cada 10 s) no se pisan, y ninguna transacción de BD abarca la llamada (R6).
- **R10** Topup (T1): intent con `reference.type=topup`, riel externo, split único al propio usuario; P2P (T4): riel WALLET, `reference.type=transfer`, split único al usuario destino (debe existir y estar activo), política de comisión P2P (por defecto 0).
- **R11** Reembolso: suma ≤ capturado; asiento T7 con clave `refund:<refund_id>`; si el riel no soporta reembolso parcial → `FAILED_PRECONDITION RAIL_PARTIAL_REFUND_UNSUPPORTED`.
- **R12** Webhook: firma inválida → rechazo (fail-closed); duplicado → `accepted=true` sin efecto; webhook contradice la consulta activa → UNKNOWN + caso de conciliación.
- **R13** Rieles sin credenciales configuradas en security → modo **sandbox** (`sandbox=true` visible en UI y en el Payment); nunca se mezclan pagos sandbox en liquidaciones reales (settlement los excluye).
- **R14** Expiración: job cada 30 s pasa intents vencidos a `EXPIRED` y libera holds.
- **R15** Límites desde infra-management (`limits.payment.max_minor`, caché de 60 s), sin valor por defecto en código. Exceso → `AMOUNT_OUT_OF_RANGE`. Si falta el parámetro o infra-management no responde → `UNAVAILABLE DEPENDENCY_UNAVAILABLE` (fail-closed).
- **R13 (wallet)** Mientras `wallet.real_money` esté apagado (N-AML-01, Q-01), todo intent de wallet nace con `sandbox=true`.
- **R16** `ResolveTerminal` nunca devuelve datos del comercio más allá de nombre comercial, logo y estado.
- **R17** Un riel deshabilitado por flag (`rail.<nombre>.enabled=false`) → `RAIL_DISABLED` sin tocar el riel.

## 6. Adaptadores de riel (trait `RailAdapter`)
```rust
#[async_trait]
pub trait RailAdapter: Send + Sync {
    fn rail(&self) -> PaymentRail;
    fn capabilities(&self) -> RailCapabilities; // two_step, partial_refund, requires_payer_action, webhook
    async fn start(&self, req: StartPayment) -> Result<RailOutcome, RailError>;    // Approved{ext_ref} | Pending{next_action} | Declined{code}
    async fn capture(&self, ext_ref: &str, amount: Money) -> Result<RailOutcome, RailError>;
    async fn query(&self, ext_ref_or_key: &str) -> Result<RailOutcome, RailError>; // para UNKNOWN
    async fn refund(&self, ext_ref: &str, amount: Money, key: &str) -> Result<RailOutcome, RailError>;
    fn verify_webhook(&self, headers: &HeaderMap, raw: &[u8]) -> Result<WebhookEvent, RailError>;
}
```
`RailError::Ambiguous` ⇒ UNKNOWN; `RailError::Definitive` ⇒ FAILED. Cada adaptador tiene su doble `Sandbox<Rail>` con el mismo trait. Estado de especificaciones: WALLET (interno, F11), Yappy y TELERED (especificación privada del proveedor — **Q-02 BLOQUEANTE** para producción), tarjeta/Apple Pay/Google Pay vía PSP (**Q-03**), QR interoperable (Q-05).

## 7. Eventos
Publica: `PaymentCaptured`, `PaymentFailed`, `PaymentUnknown`, `RefundSucceeded`, `AuditRecorded` (reembolsos, resoluciones, políticas). Consume: `pp.identity.tenant.status_changed.v1` (proyección), `pp.ledger.hold.status_changed.v1` (hold expirado → intent EXPIRED si seguía esperando).

## 8. Dependencias
ledger (CreateHold/CaptureHold/ReleaseHold/PostTransaction; deadline 2 s; reintento idempotente), identity (GetTenant, ConsumeStepUp; 1 s), security (credenciales de riel `rails/<rail>/<tenant|platform>`; caché en memoria ≤ 1 h), infra-management (flags y límites; caché KV). Llamado por: gateway, orders, pos, payroll, settlement.

## 9. Configuración
| Variable | Por defecto | Uso |
|---|---|---|
| `DATABASE_URL` | obligatoria | rol `payments_svc`, directo a `postgres-db:5432`, porque sqlx usa sentencias preparadas |
| `PP_MIGRATE_DSN` | obligatoria para `migrate` | rol `migrator_payments` |
| `PORT` / `ADMIN_PORT` | 50062 / 9100 | gRPC / administración |
| `PP_LEDGER_ADDR`, `PP_IDENTITY_ADDR`, `PP_INFRA_ADDR` | obligatorias | `http://ledger:50061`, `http://identity:50060`, `http://infra-management:50074` |
| `PP_NATS_URL`, `PP_NATS_USER`, `PP_NATS_PASS` | vacío = sin eventos | relay del outbox y consumidor de `TenantStatusChanged` |
| `PP_INTENT_DEFAULT_TTL_SECONDS` | 900 | vida de un intent sin `expires_in_seconds` (máx. 86 400) |
| `PP_LEDGER_TIMEOUT_MS` / `PP_DEPENDENCY_TIMEOUT_MS` | 2000 / 1000 | plazos de §8 |
| `RUST_LOG` | info | nivel de log |

El umbral de step-up, el monto máximo y las flags (`payments.enabled`, `wallet.real_money`) **no** son variables de entorno: vienen de infra-management (AGENTS.md §2.13).

## 10. Observabilidad
Métricas de `observability-standards.md` §2.2 (payments). Implementadas: `pp_payments_total{rail,status}`, `pp_payments_amount_minor_total{rail,currency}`, `pp_rail_requests_total{rail,op,result}`, `pp_payments_unknown_current{rail}`, `pp_payments_captured_unposted_current` y `pp_payments_job_failures_total{job}`. Pendientes: `pp_payments_unknown_age_seconds_max`, `pp_webhook_rejected_total`, trazas OTel y reglas de alerta. Alertas: UNKNOWN > 15 min (warning), > 1 h (crítica); CAPTURED sin asiento > 5 min (crítica); riel con > 20 % fallos técnicos 10 min.

## 11. Seguridad
Nunca PAN/CVV (solo tokens del PSP); webhooks fail-closed; credenciales de riel solo en memoria; `metadata` sin datos sensibles (validación de claves prohibidas: `card`, `cvv`, `pan`, `password`).

## 12. Pruebas de aceptación
1. Pago wallet de 25.00 USD de A a comercio M: saldo A −2500, `MERCHANT_PAYABLE(M)` + neto según política, comisiones y TAX según vector; un solo asiento aunque Confirm se llame 3 veces con la misma key.
2. Riel sandbox que hace timeout → UNKNOWN; el job lo resuelve a CAPTURED cuando `query` responde; se asienta una sola vez.
3. Webhook duplicado 5 veces → un solo cambio de estado.
4. Reembolso de 2500 sobre vector A → `merchant_debit` 2432 y asiento T7 balanceado.
5. Tenant `PENDING_REVIEW` intenta cobrar → `TENANT_NOT_ACTIVE`.
6. Carga (F29): 1 000 intents/s con p95 ≤ 300 ms (sin tiempo de riel).

## 13. Plan
F11.1 proyecto + dominio (máquinas de estado, fee engine con vectores) → F11.2 migraciones → F11.3 intents/payments wallet + holds → F11.4 worker de asiento + outbox → F11.5 terminales + ResolveTerminal → F11.6 reembolsos → F11.7 adaptador sandbox genérico + UNKNOWN job → F11.8 webhooks → F11.9 pantallas Flutter (billetera, cobrar/pagar QR, terminales) → F23.x pagos presenciales NFC/billeteras del dispositivo (según Q-02/Q-03) → F28 certificación → F30.3 credenciales reales.

## 14. Riesgos y preguntas
Q-02 (especificaciones Yappy/TELERED), Q-03 (PSP para tarjetas/Tap to Pay), Q-05 (estándar QR interoperable), Q-06 (reembolso de comisión del riel), Q-07 (ITBMS sobre comisiones), Q-01 (licencia/regulación SBP para custodia de fondos en wallet).
