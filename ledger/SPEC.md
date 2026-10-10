# SPEC — ledger

## 1. Responsabilidad
**Hace**: libro mayor de doble entrada de toda la plataforma: cuentas por (party, tipo, moneda, scope), transacciones balanceadas e inmutables, reversos, saldos, extractos y holds (reservas de saldo).
**No hace**: hablar con rieles, calcular comisiones (payments-core le pasa los montos), decidir si un pago procede, liquidar (settlement).

## 2. Ficha
| Campo | Valor |
|---|---|
| Lenguaje | **Rust** (`rust-standards.md`) |
| Puerto gRPC / admin | 50061 / 9100 |
| Contrato | `ledger.proto` (`plentypay.ledger.v1`) |
| Esquema | `ledger` (rol `ledger_svc`) |
| Otros | NATS (publica `TransactionPosted`, `HoldStatusChanged`) |
| Fase | F10 |
| Capa | L2 (hoja: no llama a nadie) |

**Estado**: 📋 sin código Rust. Especificación ejecutable de invariantes I1–I4 en `scripts/ledger-tests` (27 casos sobre la migración SQL del sistema de referencia) — portar a `tests/invariants.rs`.

## 3. Modelo de datos
```sql
CREATE TABLE ledger.accounts (
  id uuid PRIMARY KEY,
  party_id uuid NOT NULL, account_type smallint NOT NULL, currency char(3) NOT NULL,  -- 'PTS' para puntos
  scope_id text NOT NULL DEFAULT '',
  tenant_id uuid,                        -- para RLS: comercio dueño si aplica (NULL = persona/plataforma)
  allow_negative boolean NOT NULL,       -- derivado de domain-model §5.1 al crear
  balance_minor bigint NOT NULL DEFAULT 0,   -- saldo con signo según clase (cache transaccional)
  held_minor bigint NOT NULL DEFAULT 0 CHECK (held_minor >= 0),
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL,
  UNIQUE (party_id, account_type, currency, scope_id)
);
CREATE TABLE ledger.transactions (
  id uuid PRIMARY KEY, tenant_id uuid, transaction_type text NOT NULL,
  reference_type text NOT NULL, reference_id text NOT NULL,
  currency char(3) NOT NULL, description text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('DRAFT','POSTED','REVERSED')),
  reversal_of uuid UNIQUE REFERENCES ledger.transactions(id),  -- un reverso por transacción
  idempotency_key text NOT NULL UNIQUE, request_hash bytea NOT NULL,
  effective_at timestamptz NOT NULL, posted_at timestamptz, created_at timestamptz NOT NULL
) PARTITION BY RANGE (created_at);       -- particiones mensuales; UNIQUE globales vía tabla auxiliar si hace falta
CREATE UNIQUE INDEX one_capture_per_payment ON ledger.transactions (reference_type, reference_id)
  WHERE transaction_type IN ('PAYMENT_CAPTURE','WALLET_PAYMENT') AND status <> 'DRAFT';
CREATE TABLE ledger.entries (
  id uuid PRIMARY KEY, transaction_id uuid NOT NULL, account_id uuid NOT NULL,
  side char(1) NOT NULL CHECK (side IN ('D','C')), amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL, created_at timestamptz NOT NULL
) PARTITION BY RANGE (created_at);
CREATE INDEX entries_account_time ON ledger.entries (account_id, created_at DESC, id DESC);
CREATE TABLE ledger.holds (
  id uuid PRIMARY KEY, account_id uuid NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status text NOT NULL, reference_type text NOT NULL, reference_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  captured_transaction_id uuid, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE INDEX holds_active_expiry ON ledger.holds (expires_at) WHERE status = 'ACTIVE';
-- + outbox, processed_events (data-standards §6). idempotency: columna en transactions/holds (no tabla aparte).
```
**Triggers obligatorios** (segunda barrera de I1–I3, como en la referencia): (a) no UPDATE/DELETE de transacciones `POSTED` salvo `status → REVERSED` cuando se inserta su reverso; (b) no UPDATE/DELETE de entries; no INSERT de entries en transacción ya `POSTED`; (c) al pasar a `POSTED`: Σ D = Σ C, ≥ 2 entries, todas con la moneda de la transacción, montos > 0.
`balance_minor` y `held_minor` se actualizan en la **misma transacción** que inserta entries/holds; job diario recalcula desde entries y alerta si difiere (I7).

## 4. RPCs
| RPC | Llamadores permitidos | Idempotente | Comportamiento | Errores |
|---|---|---|---|---|
| PostTransaction | payments-core, settlement, pos (T8/T9 vía payments-core en MVP), payroll vía payments-core | sí (`idempotency_key` global) | valida plantilla (§5), crea cuentas perezosamente, bloquea cuentas en orden ascendente de id, verifica I5 y disponibles, inserta, marca POSTED, outbox `TransactionPosted` | `UNBALANCED`, `UNKNOWN_TEMPLATE`, `INVALID_AMOUNT`, `CURRENCY_MISMATCH`, `INSUFFICIENT_FUNDS`, `DUPLICATE_CAPTURE`, `IDEMPOTENCY_KEY_REUSED` |
| ReverseTransaction | payments-core, settlement, `platform:reconcile` vía gateway | sí (`rev:<id>`) | crea transacción espejo (lados invertidos), original → REVERSED | `ALREADY_REVERSED`, `NOT_FOUND`, `INSUFFICIENT_FUNDS` |
| GetTransaction / ListTransactions | servicios + gateway (lectura) | — | por id / por cuenta, referencia o rango; keyset | `NOT_FOUND` |
| GetBalance / ListBalances | servicios + gateway | — | saldo, retenido, disponible por cuenta | `NOT_FOUND` (cuenta inexistente → saldo 0, no error) |
| GetStatement | gateway (wallet, comercio) | — | movimientos con saldo corrido, rango ≤ 366 días | `INVALID_RANGE` |
| CreateHold | payments-core | sí | verifica disponible ≥ monto, crea hold ACTIVE con TTL (def. 15 min, máx. 7 días) | `INSUFFICIENT_FUNDS` |
| CaptureHold | payments-core | sí | en una transacción: hold → CAPTURED + PostTransaction con D sobre la cuenta del hold por el monto del hold y `legs` de crédito; Σ legs = monto | `HOLD_NOT_ACTIVE`, `UNBALANCED` |
| ReleaseHold | payments-core | sí por estado | ACTIVE → RELEASED; otros estados → devuelve el hold sin cambio | `NOT_FOUND` |
| GetHold | payments-core | — | | `NOT_FOUND` |

Autorización: ledger confía en la identidad de servicio (mTLS) para escrituras; **solo** payments-core y settlement pueden escribir (§3 de `service-dependencies.md`). Lecturas desde el gateway exigen que el `party_id` pedido sea el usuario (`wallet:read`) o el tenant del contexto (`settlement:read`/`payments:read`); PLATFORM solo con `platform:*`.

## 5. Reglas
- **R1** I1: balance por moneda; ≥ 2 entries.
- **R2** I2: `amount_minor > 0`.
- **R3** I3: POSTED inmutable; corrección solo por ReverseTransaction; un reverso por transacción.
- **R4** I4: misma `idempotency_key` + mismo hash → transacción original; hash distinto → `ALREADY_EXISTS IDEMPOTENCY_KEY_REUSED`.
- **R5** Una captura por pago: segundo `PAYMENT_CAPTURE`/`WALLET_PAYMENT` con la misma referencia → `ALREADY_EXISTS DUPLICATE_CAPTURE` (índice parcial).
- **R6** I5: cuentas con `allow_negative=false` no quedan con disponible < 0 (saldo − holds).
- **R7** Bloqueo de cuentas en orden ascendente de `account_id` (sin deadlocks con 2 transacciones cruzadas A→B y B→A; prueba de concurrencia).
- **R8** `transaction_type` debe ser de la lista de `domain-model.md` §5.2 y su **forma** cumplir la plantilla (tipos de cuenta y lados permitidos por tipo). Tabla de formas en `src/domain/templates.rs` generada de este SPEC.
- **R9** Holds: TTL vencido → EXPIRED por job cada 30 s (`HoldStatusChanged`); capturar un hold vencido → `HOLD_NOT_ACTIVE`.
- **R10** CaptureHold es atómico: o hold CAPTURED + transacción POSTED, o nada.
- **R11** I7: job diario por moneda: Σ saldos con signo de clase = 0 y `balance_minor` = recomputado; diferencia → métrica `pp_ledger_invariant_violations_total` + alerta crítica.
- **R12** Montos ≤ 10^15 (protección de overflow); suma con `checked_add` en i128.
- **R13** `effective_at` no puede estar > 5 min en el futuro ni > 35 días en el pasado (asientos tardíos de conciliación usan `SUSPENSE`).

## 6. Eventos
Publica: `pp.ledger.transaction.posted.v1` (`TransactionPosted`, sin entries completas: id, tipo, referencia, moneda, total, cuentas afectadas), `pp.ledger.hold.status_changed.v1`. Consume: ninguno.

## 7. Dependencias
Ninguna síncrona. Es llamado por payments-core, settlement y gateway (lecturas).

## 8. Configuración
`LEDGER_GRPC_ADDR` (`:50061`), `DATABASE_URL`, `DB_MAX_CONNECTIONS` (20), `NATS_URL`, `HOLD_DEFAULT_TTL_SECONDS` (900), `OTEL_EXPORTER_OTLP_ENDPOINT`.

## 9. Observabilidad
`pp_ledger_transactions_total{type}`, `pp_ledger_post_duration_seconds`, `pp_ledger_holds_active`, `pp_ledger_invariant_violations_total` (alerta crítica > 0), `pp_ledger_lock_wait_seconds`. SLO: PostTransaction p99 ≤ 50 ms.

## 10. Seguridad
Rol de BD sin privilegios de UPDATE/DELETE sobre `entries`; triggers como barrera aun para un servicio comprometido; auditoría de reversos (`AuditRecorded`).

## 11. Pruebas de aceptación
1. Los 27 casos de `scripts/ledger-tests` pasan contra las migraciones Rust (L2).
2. Plantillas T1–T10 con los vectores A, D, E, R1–R3 de `domain-model.md` §4.5 producen saldos esperados.
3. Propiedad: secuencias aleatorias de transacciones válidas + reversos mantienen I1, I5, I7.
4. Concurrencia: 1 000 transferencias T4 cruzadas entre 10 wallets en 50 tareas → saldo total constante, ninguna negativa, sin deadlocks.
5. Carga (F29): 2 000 PostTransaction/s sostenidos con p99 ≤ 50 ms en hardware de referencia.

## 12. Plan
F10.1 proyecto Rust + dominio `Money`/plantillas (L1, proptest) → F10.2 migraciones + triggers + port de los 27 casos (L2) → F10.3 PostTransaction/Reverse → F10.4 saldos/extractos → F10.5 holds + job de expiración → F10.6 outbox + eventos → F10.7 job I7 + métricas → F10.8 carga básica.

## 13. Riesgos
Particionado con unicidad global (`idempotency_key`): usar tabla `ledger.idempotency_index` no particionada si PostgreSQL no permite el UNIQUE en la tabla particionada sin incluir la clave de partición.
