CREATE SCHEMA IF NOT EXISTS payments;

CREATE TABLE payments.intents (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  created_by uuid NOT NULL,
  rail smallint NOT NULL,
  status smallint NOT NULL,
  terminal_id uuid,
  reference_type text,
  reference_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  splits jsonb NOT NULL DEFAULT '[]',
  sandbox boolean NOT NULL DEFAULT true,
  next_action jsonb,
  expires_at timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  request_hash bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE payments.payments (
  id uuid PRIMARY KEY,
  intent_id uuid NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  status smallint NOT NULL,
  rail smallint NOT NULL,
  amount_minor bigint NOT NULL,
  captured_minor bigint NOT NULL DEFAULT 0,
  refunded_minor bigint NOT NULL DEFAULT 0,
  currency char(3) NOT NULL,
  fees jsonb,
  fee_policy_id uuid,
  ledger_posting smallint NOT NULL DEFAULT 1,
  ledger_transaction_id uuid,
  unknown_since timestamptz,
  next_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  CHECK (refunded_minor <= captured_minor)
);
CREATE INDEX payments_tenant_time ON payments.payments (tenant_id, created_at DESC, id DESC);
CREATE INDEX payments_unknown ON payments.payments (next_check_at) WHERE status = 9;
CREATE INDEX payments_posting_pending ON payments.payments (updated_at) WHERE ledger_posting = 1 AND status = 5;

CREATE TABLE payments.attempts (
  id uuid PRIMARY KEY,
  payment_id uuid NOT NULL,
  attempt_number int NOT NULL,
  rail smallint NOT NULL,
  status smallint NOT NULL,
  external_ref text,
  rail_idempotency_key text NOT NULL,
  error_code text,
  raw_response_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, attempt_number)
);
CREATE UNIQUE INDEX one_captured_attempt ON payments.attempts (payment_id) WHERE status = 4;
CREATE INDEX attempts_external ON payments.attempts (rail, external_ref);

CREATE TABLE payments.refunds (
  id uuid PRIMARY KEY,
  payment_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status smallint NOT NULL,
  reason text,
  fee_reversal jsonb NOT NULL DEFAULT '{}',
  external_ref text,
  ledger_transaction_id uuid,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE payments.terminals (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  label text NOT NULL,
  public_code text NOT NULL UNIQUE CHECK (public_code ~ '^[A-Za-z0-9_-]{8,64}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments.fee_policies (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  rail smallint NOT NULL DEFAULT 0,
  fixed_fee_minor bigint NOT NULL,
  percentage_bps int NOT NULL CHECK (percentage_bps BETWEEN 0 AND 10000),
  bearer smallint NOT NULL,
  tax_rate_bps int NOT NULL,
  rail_fixed_fee_minor bigint NOT NULL DEFAULT 0,
  rail_percentage_bps int NOT NULL DEFAULT 0,
  rail_fee_refundable boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments.webhook_events (
  rail smallint NOT NULL,
  provider_event_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_ref text,
  PRIMARY KEY (rail, provider_event_id)
);

CREATE TABLE payments.tenant_status (
  tenant_id uuid PRIMARY KEY,
  status smallint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX payments_outbox_unpublished ON payments.outbox (created_at) WHERE published_at IS NULL;
