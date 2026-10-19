CREATE SCHEMA IF NOT EXISTS settlement;

CREATE TABLE settlement.payout_schedules (
  tenant_id uuid PRIMARY KEY,
  frequency smallint NOT NULL,
  weekday smallint,
  cutoff_local time NOT NULL DEFAULT '17:00',
  destination_kind text NOT NULL CHECK (destination_kind IN ('BANK','WALLET')),
  destination_ref_ciphertext bytea,
  destination_key_version text,
  destination_last4 text,
  destination_verified_at timestamptz,
  minimum_payout_minor bigint NOT NULL DEFAULT 100,
  hold_days smallint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1
);

CREATE TABLE settlement.batches (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  status smallint NOT NULL,
  currency char(3) NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  gross_minor bigint NOT NULL,
  fees_minor bigint NOT NULL,
  refunds_minor bigint NOT NULL,
  net_minor bigint NOT NULL,
  destination_kind text NOT NULL,
  bank_reference text,
  failure_reason text,
  ledger_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_end)
);

CREATE TABLE settlement.batch_items (
  batch_id uuid NOT NULL REFERENCES settlement.batches(id),
  payment_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('PAYMENT','REFUND','ADJUSTMENT')),
  amount_minor bigint NOT NULL,
  PRIMARY KEY (batch_id, payment_id)
);
CREATE UNIQUE INDEX batch_items_payment_once ON settlement.batch_items (payment_id);

CREATE TABLE settlement.rail_statements (
  id uuid PRIMARY KEY,
  rail smallint NOT NULL,
  statement_date date NOT NULL,
  object_key text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid NOT NULL,
  UNIQUE (rail, statement_date)
);

CREATE TABLE settlement.reconciliation_items (
  id uuid PRIMARY KEY,
  statement_id uuid NOT NULL REFERENCES settlement.rail_statements(id),
  rail smallint NOT NULL,
  external_ref text,
  payment_id uuid,
  internal_amount_minor bigint,
  external_amount_minor bigint,
  state smallint NOT NULL,
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  evidence_ref text
);

CREATE TABLE settlement.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
