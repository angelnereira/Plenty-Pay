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
```sql
CREATE TABLE settlement.payout_schedules (
  tenant_id uuid PRIMARY KEY, frequency smallint NOT NULL,       -- DAILY|WEEKLY|MANUAL
  weekday smallint, cutoff_local time NOT NULL DEFAULT '17:00',   -- America/Panama
  destination_kind text NOT NULL CHECK (destination_kind IN ('BANK','WALLET')),
  destination_ref_ciphertext bytea, destination_key_version text,  -- cuenta bancaria cifrada (security.Encrypt, propósito payout_destination)
  destination_last4 text, destination_verified_at timestamptz,
  minimum_payout_minor bigint NOT NULL DEFAULT 100, hold_days smallint NOT NULL DEFAULT 1,  -- reserva de riesgo (T+N)
  updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1
);
CREATE TABLE settlement.batches (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, status smallint NOT NULL, currency char(3) NOT NULL,
  period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
  gross_minor bigint NOT NULL, fees_minor bigint NOT NULL, refunds_minor bigint NOT NULL, net_minor bigint NOT NULL,
  destination_kind text NOT NULL, bank_reference text, failure_reason text,
  ledger_transaction_id uuid, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  UNIQUE (tenant_id, period_end)
);
CREATE TABLE settlement.batch_items (
  batch_id uuid NOT NULL, payment_id uuid NOT NULL UNIQUE,      -- un pago se liquida una sola vez
  kind text NOT NULL CHECK (kind IN ('PAYMENT','REFUND','ADJUSTMENT')), amount_minor bigint NOT NULL,
  PRIMARY KEY (batch_id, payment_id)
);
CREATE TABLE settlement.rail_statements (id uuid PRIMARY KEY, rail smallint NOT NULL, statement_date date NOT NULL,
  object_key text NOT NULL, imported_at timestamptz NOT NULL, imported_by uuid NOT NULL, UNIQUE (rail, statement_date));
CREATE TABLE settlement.reconciliation_items (
  id uuid PRIMARY KEY, statement_id uuid NOT NULL, rail smallint NOT NULL, external_ref text,
  payment_id uuid, internal_amount_minor bigint, external_amount_minor bigint,
  state smallint NOT NULL, resolution_note text, resolved_by uuid, resolved_at timestamptz, evidence_ref text
);
-- + idempotency_keys, outbox, processed_events
```

## 4. RPCs
| RPC | Permiso | Idemp. | Comportamiento | Errores |
|---|---|---|---|---|
| GetPayoutSchedule / SetPayoutSchedule | `settlement:read` / `settlement:schedule:manage` + step-up si cambia el destino | sí | destino bancario se cifra; un cambio de destino deja `destination_verified_at=NULL` y bloquea pagos 48 h + notificación al dueño | `STEP_UP_REQUIRED`, `INVALID_DESTINATION` |
| CreateBatch | job interno / `settlement:schedule:manage` (manual) | sí (`tenant+period_end`) | toma pagos CAPTURED con `ledger_posting=POSTED`, no sandbox, no liquidados, capturados antes de `cutoff − hold_days`; descuenta reembolsos del periodo; verifica que `net ≤ disponible de MERCHANT_PAYABLE`; lote `OPEN` → `PROCESSING` | `NOTHING_TO_SETTLE`, `BELOW_MINIMUM` |
| GetBatch / ListBatches | `settlement:read` | — | | `NOT_FOUND` |
| ConfirmPayout | job del conector bancario / `platform:reconcile` | sí | `PROCESSING → PAID`; asiento T6 (`payout:<batch_id>`) o T6b para wallet; evento `BatchPaid` | `INVALID_STATE_TRANSITION` |
| FailPayout | ídem | sí | `PROCESSING → FAILED` con motivo; sin asiento; notifica | |
| ImportRailStatement | `platform:reconcile` | sí (`rail+date`) | parsea extracto (CSV/formatos por riel), guarda original en object-storage, concilia, asienta T5 por líneas MATCHED, crea excepciones | `UNSUPPORTED_FORMAT`, `ALREADY_IMPORTED` |
| GetReconciliationReport / ListReconciliationExceptions | `platform:reconcile` / `settlement:reconcile` (solo su tenant) | — | | |
| ResolveException | `platform:reconcile` | sí | `→ RESOLVED` con nota y evidencia; puede ordenar asiento de ajuste vía SUSPENSE | `EVIDENCE_REQUIRED` |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-AML-11, N-PAG-04 y N-PAG-07. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Un pago se liquida **una sola vez** (`UNIQUE payment_id` en items).
- **R2** Solo pagos con asiento POSTED y no sandbox entran a un lote.
- **R3** `net = gross − fees − refunds (+ ajustes)` del periodo; `net` nunca supera el disponible de `MERCHANT_PAYABLE(tenant)` (consulta a ledger en la misma operación; si no alcanza → lote por el disponible y el resto queda para el siguiente).
- **R4** Retención de riesgo `hold_days` (por defecto T+1); tenants nuevos (< 30 días) T+3 configurable por plataforma.
- **R5** Cambio de destino de pago: step-up + bloqueo de 48 h + notificación a todos los correos del dueño (antifraude).
- **R6** Lotes por debajo de `minimum_payout_minor` se acumulan.
- **R7** Conciliación: match por `(rail, external_ref)`; montos distintos → AMOUNT_MISMATCH; existe solo en PlentyPay → UNMATCHED_INTERNAL (tras 3 días hábiles); solo en extracto → UNMATCHED_EXTERNAL.
- **R8** T5 se asienta solo por líneas MATCHED; diferencias van a SUSPENSE y generan excepción; SUSPENSE ≠ 0 por > 5 días → alerta.
- **R9** Calendario en `America/Panama`; no se procesan pagos bancarios en feriados nacionales (tabla de feriados en infra-management config `holidays.pa`).
- **R10** Toda resolución manual queda auditada con evidencia.

## 6. Eventos
Publica: `BatchPaid`, `ReconciliationExceptionRaised`, `AuditRecorded`. Consume: `pp.ledger.transaction.posted.v1` (marca pagos asentados como elegibles), `pp.payments.refund.succeeded.v1`.

## 7. Dependencias
ledger (GetBalance, PostTransaction; 2 s), payments-core (ListPayments/GetPayment para el periodo; 3 s), identity (GetTenant), security (Encrypt/Decrypt destino). Conector bancario: **Q-10** (ACH Xpress de TELERED u otro; hasta definirlo, `ConfirmPayout` manual por plataforma con referencia bancaria).

## 8. Configuración
`SETTLEMENT_GRPC_ADDR`, `DATABASE_URL`, `NATS_URL`, `LEDGER_ADDR`, `PAYMENTS_ADDR`, `IDENTITY_ADDR`, `SECURITY_ADDR`, `OBJECT_STORAGE_*`, `BATCH_CRON` (`0 18 * * *` hora Panamá).

## 9. Observabilidad
`pp_settlement_batches_total{status}`, `pp_settlement_net_minor_total{currency}`, `pp_reconciliation_mismatches_current`, `pp_suspense_balance_minor`. Alertas: lote FAILED; excepciones abiertas > 3 días; SUSPENSE ≠ 0 > 5 días.

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
