-- PlentyPay - settlement (SPEC §3): calendarios, lotes y partidas de liquidación, y outbox.
-- El esquema `settlement` y sus permisos de base los dan postgres-db/init (o
-- scripts/db-grant-schema.sh en la base de producción); aquí, tablas, índices, RLS (ADR 0014) y
-- permisos de settlement_svc. Nada de dinero se borra: settlement_svc no tiene DELETE.
-- La conciliación con extractos (rail_statements, reconciliation_items) llega en una migración
-- posterior (F12.5–F12.6).

CREATE TABLE settlement.payout_schedules (
  tenant_id                 uuid PRIMARY KEY,
  frequency                 smallint NOT NULL CHECK (frequency BETWEEN 1 AND 3),   -- DAILY|WEEKLY|MANUAL
  weekday                   smallint NOT NULL DEFAULT 0 CHECK (weekday BETWEEN 0 AND 7),
  minimum_payout_minor      bigint NOT NULL DEFAULT 100 CHECK (minimum_payout_minor >= 0),
  hold_days                 smallint NOT NULL DEFAULT 1 CHECK (hold_days BETWEEN 0 AND 30),   -- R4
  destination_kind          text NOT NULL CHECK (destination_kind IN ('BANK', 'WALLET')),
  destination_bank          text NOT NULL DEFAULT '',
  destination_account_type  text NOT NULL DEFAULT '' CHECK (destination_account_type IN ('', 'CHECKING', 'SAVINGS')),
  destination_ciphertext    bytea,                          -- número de cuenta cifrado por security
  destination_key_version   text NOT NULL DEFAULT '',
  destination_last4         text NOT NULL DEFAULT '',
  destination_holder        text NOT NULL DEFAULT '',
  payouts_blocked_until     timestamptz,                    -- R5: 48 h tras cambiar el destino
  idempotency_key           text NOT NULL DEFAULT '',       -- la última configuración
  updated_by                uuid,
  updated_at                timestamptz NOT NULL,
  version                   int NOT NULL DEFAULT 1,
  CHECK (destination_kind = 'WALLET' OR destination_ciphertext IS NOT NULL)
);

CREATE TABLE settlement.batches (
  id                     uuid PRIMARY KEY,
  tenant_id              uuid NOT NULL,
  status                 smallint NOT NULL CHECK (status BETWEEN 1 AND 4),
  currency               char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  sandbox                boolean NOT NULL,                 -- incluye cobros de prueba (R2)
  period_start           timestamptz NOT NULL,
  period_end             timestamptz NOT NULL,
  gross_minor            bigint NOT NULL CHECK (gross_minor >= 0),    -- cobros acreditados al comercio (netos de comisión)
  refunds_minor          bigint NOT NULL CHECK (refunds_minor >= 0),
  net_minor              bigint NOT NULL CHECK (net_minor > 0 AND net_minor = gross_minor - refunds_minor),   -- R3
  destination_kind       text NOT NULL CHECK (destination_kind IN ('BANK', 'WALLET')),
  destination_last4      text NOT NULL DEFAULT '',
  payout_external_ref    text,
  failure_reason         text,
  ledger_transaction_id  uuid,
  idempotency_key        text NOT NULL,
  created_by             text NOT NULL,                    -- user_id o 'job'
  created_at             timestamptz NOT NULL,
  updated_at             timestamptz NOT NULL,
  paid_at                timestamptz,
  CHECK (sandbox = false OR destination_kind = 'WALLET'),  -- R2: dinero de prueba nunca a un banco
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX batches_tenant_created ON settlement.batches (tenant_id, created_at DESC, id DESC);
CREATE INDEX batches_processing ON settlement.batches (updated_at) WHERE status = 2;

CREATE TABLE settlement.batch_items (
  batch_id               uuid NOT NULL REFERENCES settlement.batches (id),
  tenant_id              uuid NOT NULL,
  ledger_transaction_id  uuid NOT NULL,
  kind                   text NOT NULL CHECK (kind IN ('PAYMENT', 'REFUND')),
  reference_type         text NOT NULL,
  reference_id           text NOT NULL,
  amount_minor           bigint NOT NULL CHECK (amount_minor > 0),
  sandbox                boolean NOT NULL,
  occurred_at            timestamptz NOT NULL,
  released               boolean NOT NULL DEFAULT false,   -- lote FAILED: la partida vuelve a ser elegible
  PRIMARY KEY (batch_id, ledger_transaction_id)
);
-- R1: un asiento se liquida una sola vez (salvo que su lote haya fallado).
CREATE UNIQUE INDEX batch_items_once ON settlement.batch_items (ledger_transaction_id) WHERE NOT released;
CREATE INDEX batch_items_tenant ON settlement.batch_items (tenant_id, occurred_at);

CREATE TABLE settlement.outbox (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL,
  aggregate_id  uuid NOT NULL,
  event_type    text NOT NULL,
  payload       bytea NOT NULL,
  created_at    timestamptz NOT NULL,
  published_at  timestamptz
);
CREATE INDEX outbox_pending ON settlement.outbox (created_at) WHERE published_at IS NULL;

CREATE FUNCTION settlement.actor_is_service() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.actor', true), '') = 'service'
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payout_schedules', 'batches', 'batch_items', 'outbox'] LOOP
    EXECUTE format('ALTER TABLE settlement.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE settlement.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON settlement.%I
      USING (settlement.actor_is_service() OR tenant_id::text = current_setting('app.tenant_id', true))
      WITH CHECK (settlement.actor_is_service() OR tenant_id::text = current_setting('app.tenant_id', true))$p$,
      t || '_tenant', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON settlement.payout_schedules, settlement.batches, settlement.batch_items,
  settlement.outbox TO settlement_svc;
GRANT EXECUTE ON FUNCTION settlement.actor_is_service() TO settlement_svc;
