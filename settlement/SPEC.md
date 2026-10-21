# SPEC — settlement

## 1. Responsabilidad
**Hace**: calendarios de pago a comercios, lotes de liquidación (cuánto se le paga a cada comercio y cuándo), ejecución del pago (transferencia bancaria/ACH o acreditación en wallet del negocio), conciliación diaria contra extractos de rieles y bancos, gestión de excepciones.
**No hace**: cobrar (payments-core), llevar saldos (ledger — settlement solo pide asientos T5/T6/T6b), facturar comisiones (fiscal-invoicing, F13.8).

## 2. Ficha
| Campo | Valor |
|---|---|
| Lenguaje | **Rust** |
| Puerto / admin | 50063 / 9100 |
| Contrato | `settlement.proto` |
| Esquema | `settlement` |
| Otros | NATS; object-storage (extractos importados, reportes) |
| Fase | F12 |
| Capa | L4 |

## 3. Modelo de datos
Migración `0001_initial.sql` (F12.2–F12.4). RLS forzada por tenant en las cuatro tablas (ADR 0014); `settlement_svc` sin DELETE.
```sql
CREATE TABLE settlement.payout_schedules (
  tenant_id uuid PRIMARY KEY, frequency smallint NOT NULL,          -- 1 DAILY · 2 WEEKLY · 3 MANUAL (corte 17:00 America/Panama)
  weekday smallint NOT NULL DEFAULT 0, minimum_payout_minor bigint NOT NULL DEFAULT 100, hold_days smallint NOT NULL DEFAULT 1,
  destination_kind text NOT NULL CHECK (destination_kind IN ('BANK','WALLET')),
  destination_bank text, destination_account_type text,                -- 'CHECKING' | 'SAVINGS'
  destination_ciphertext bytea, destination_key_version text,          -- número cifrado por security (propósito payout_destination, AAD "<tenant>|payout")
  destination_last4 text, destination_holder text,
  payouts_blocked_until timestamptz,                                   -- R5
  idempotency_key text, updated_by uuid, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1
);
CREATE TABLE settlement.batches (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, status smallint NOT NULL, currency char(3) NOT NULL,
  sandbox boolean NOT NULL,                                            -- incluye cobros de prueba: solo a la billetera (R2)
  period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
  gross_minor bigint NOT NULL,                                         -- cobros acreditados al comercio (ya netos de comisión)
  refunds_minor bigint NOT NULL, net_minor bigint NOT NULL CHECK (net_minor = gross_minor - refunds_minor),
  destination_kind text NOT NULL, destination_last4 text, payout_external_ref text, failure_reason text,
  ledger_transaction_id uuid, idempotency_key text NOT NULL, created_by text NOT NULL,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, paid_at timestamptz,
  CHECK (sandbox = false OR destination_kind = 'WALLET'), UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE settlement.batch_items (
  batch_id uuid NOT NULL REFERENCES settlement.batches, tenant_id uuid NOT NULL,
  ledger_transaction_id uuid NOT NULL,                                 -- asiento de MERCHANT_PAYABLE que se liquida
  kind text NOT NULL CHECK (kind IN ('PAYMENT','REFUND')), reference_type text, reference_id text,
  amount_minor bigint NOT NULL, sandbox boolean NOT NULL, occurred_at timestamptz NOT NULL,
  released boolean NOT NULL DEFAULT false,                             -- lote FAILED: vuelve a ser elegible
  PRIMARY KEY (batch_id, ledger_transaction_id)
);
CREATE UNIQUE INDEX batch_items_once ON settlement.batch_items (ledger_transaction_id) WHERE NOT released;   -- R1
-- + outbox. Pendiente (F12.5–F12.6): rail_statements, reconciliation_items.
```

## 4. RPCs
| RPC | Permiso | Idemp. | Comportamiento | Errores |
|---|---|---|---|---|
| GetPayoutSchedule / SetPayoutSchedule | `settlement:read` / `settlement:schedule:manage` + step-up si cambia el destino | sí | destino bancario se cifra; un cambio de destino deja `destination_verified_at=NULL` y bloquea pagos 48 h + notificación al dueño | `STEP_UP_REQUIRED`, `INVALID_DESTINATION` |
| CreateBatch | job interno (clave `job:<tenant>:<fecha>`) / `settlement:schedule:manage` («Liquidar ahora») | sí (`tenant+idempotency_key`) | toma del extracto de `MERCHANT_PAYABLE` del ledger los cobros (`PAYMENT_CAPTURE`/`WALLET_PAYMENT`, referencia `payment`) y reembolsos (`REFUND`) asentados antes de `ahora − hold_days` y aún no liquidados; payments-core dice si cada cobro fue de prueba; lote `PROCESSING`. Con destino billetera asienta T6b y queda `PAID` al instante; con banco espera la confirmación de la plataforma | `NOTHING_TO_SETTLE`, `BELOW_MINIMUM`, `SANDBOX_FUNDS`, `PAYOUTS_BLOCKED`, `CONCURRENT_BATCH` |
| GetPayoutSummary | `settlement:read` | — | por liquidar = disponible en `MERCHANT_PAYABLE` − lotes en proceso; en proceso; próxima liquidación automática | |
| GetBatch / ListBatches | `settlement:read` | — | | `NOT_FOUND` |
| ConfirmPayout | job del conector bancario / `platform:reconcile` | sí | lote bancario `PROCESSING → PAID` con la referencia de la transferencia; asiento T6 (`payout:<batch_id>`); evento `BatchPaid`. T6 acredita `BANK_CASH`: sin los depósitos del riel asentados (T5) el ledger lo rechaza | `INVALID_STATE_TRANSITION`, `BANK_FUNDS_PENDING` |
| FailPayout | ídem | sí | `PROCESSING → FAILED` con motivo; sin asiento; las partidas vuelven a ser elegibles; evento `BatchFailed` | |
| ImportRailStatement | `platform:reconcile` | sí (`rail+date`) | parsea extracto (CSV/formatos por riel), guarda original en object-storage, concilia, asienta T5 por líneas MATCHED, crea excepciones | `UNSUPPORTED_FORMAT`, `ALREADY_IMPORTED` |
| GetReconciliationReport / ListReconciliationExceptions | `platform:reconcile` / `settlement:reconcile` (solo su tenant) | — | | |
| ResolveException | `platform:reconcile` | sí | `→ RESOLVED` con nota y evidencia; puede ordenar asiento de ajuste vía SUSPENSE | `EVIDENCE_REQUIRED` |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-AML-11, N-PAG-04 y N-PAG-07. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Un pago se liquida **una sola vez** (`UNIQUE payment_id` en items).
- **R2** Solo pagos con asiento POSTED y no sandbox entran a un lote.
- **R3** `net = gross − fees − refunds (+ ajustes)` del periodo; `net` nunca supera el disponible de `MERCHANT_PAYABLE(tenant)` (consulta a ledger en la misma operación; si no alcanza → lote por el disponible y el resto queda para el siguiente).
- **R4** Retención de riesgo `hold_days` (por defecto T+1); tenants nuevos (< 30 días) T+3 configurable por plataforma.
- **R5** Cambio de destino de pago: step-up `settlement.destination.update` (validado antes de consumirlo) + bloqueo de 48 h si el destino es bancario + evento `PayoutDestinationChanged` para que notifications avise al dueño (antifraude; el aviso llega cuando notifications esté desplegado).
- **R6** Lotes por debajo de `minimum_payout_minor` se acumulan.
- **R7** Conciliación: match por `(rail, external_ref)`; montos distintos → AMOUNT_MISMATCH; existe solo en PlentyPay → UNMATCHED_INTERNAL (tras 3 días hábiles); solo en extracto → UNMATCHED_EXTERNAL.
- **R8** T5 se asienta solo por líneas MATCHED; diferencias van a SUSPENSE y generan excepción; SUSPENSE ≠ 0 por > 5 días → alerta.
- **R9** Calendario en `America/Panama` (UTC−5): diaria o semanal a las 17:00. *Pendiente*: no procesar pagos bancarios en feriados nacionales (`holidays.pa` de infra-management); hoy la transferencia bancaria la confirma una persona de la plataforma (Q-10).
- **R10** Toda resolución manual queda auditada con evidencia.

## 6. Eventos
Publica: `BatchPaid` (`pp.settlement.batch.paid.v1`), `BatchFailed` (`pp.settlement.batch.failed.v1`), `PayoutDestinationChanged` (`pp.settlement.payout_destination.changed.v1`), `ReconciliationExceptionRaised`, `AuditRecorded`. Consume: ninguno por ahora; lo elegible sale del extracto del ledger en el momento de armar el lote (R2), que ya refleja cobros, reembolsos y repartos del marketplace.

## 7. Dependencias
ledger (GetStatement de `MERCHANT_PAYABLE` con la referencia de cada asiento, GetBalance, PostTransaction T6/T6b; 2 s), payments-core (GetPayment/GetRefund: ¿el cobro fue de prueba?; settlement es lector interno, no cobra; 3 s), identity (GetTenant para validar el titular; ConsumeStepUp), security (Encrypt del destino). Conector bancario: **Q-10** (ACH Xpress de TELERED u otro; hasta definirlo, `ConfirmPayout` manual por plataforma con referencia bancaria).

## 8. Configuración
`PORT` (50063), `ADMIN_PORT` (9100), `DATABASE_URL`, `PP_MIGRATE_DSN`, `PP_NATS_URL`/`USER`/`PASS`, `PP_LEDGER_ADDR`, `PP_PAYMENTS_ADDR`, `PP_IDENTITY_ADDR`, `PP_SECURITY_ADDR`, `PP_LEDGER_TIMEOUT_MS` (2000), `PP_DEPENDENCY_TIMEOUT_MS` (3000), `PP_SCHEDULE_EVERY_SECONDS` (300: cada cuánto el job revisa los calendarios vencidos). `OBJECT_STORAGE_*` llega con los extractos (F12.5).

## 9. Observabilidad
`pp_settlement_batches_total{status}`, `pp_settlement_net_minor_total{currency}`, `pp_settlement_processing_current`, `pp_settlement_job_failures_total{job}`; con la conciliación: `pp_reconciliation_mismatches_current`, `pp_suspense_balance_minor`. Logs JSON con `pp.tenant_id`, `pp.batch_id` y `request_id`; un T6b sin respuesta del ledger queda en proceso y el job lo reintenta con la misma clave. Alertas: lote FAILED; excepciones abiertas > 3 días; SUSPENSE ≠ 0 > 5 días.

## 10. Seguridad
Destino bancario cifrado y nunca devuelto completo (solo últimos 4); exportes con marca de agua de usuario.

## 11. Pruebas de aceptación
1. 3 pagos capturados (vector A) y 1 reembolso R1 → lote con `net = 3×9632 − 2432`; asiento T6 por ese monto; segundo CreateBatch del mismo periodo no duplica.
2. Extracto con una línea con monto distinto → AMOUNT_MISMATCH y T5 solo por las demás.
3. Cambiar destino sin step-up → `STEP_UP_REQUIRED`; con step-up → pagos bloqueados 48 h.

## 12. Plan
F12.1 dominio + migraciones → F12.2 calendarios y destino cifrado → F12.3 CreateBatch + items → F12.4 Confirm/FailPayout + T6/T6b → F12.5 importación de extractos (formato CSV genérico) → F12.6 conciliación + T5 + excepciones → F12.7 jobs y alertas → F12.8 pantallas Flutter (finanzas del comercio, consola de conciliación).

## 13. Riesgos
Q-10 conector bancario; Q-01 requisitos SBP de segregación de fondos de clientes (cuenta fiduciaria).
