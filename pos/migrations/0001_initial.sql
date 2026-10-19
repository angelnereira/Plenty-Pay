CREATE SCHEMA IF NOT EXISTS pos;

CREATE TABLE pos.registers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  label text NOT NULL,
  terminal_id uuid,
  display_pairing_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pos.cash_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  register_id uuid NOT NULL,
  opened_by uuid NOT NULL,
  closed_by uuid,
  opening_float_minor bigint NOT NULL,
  expected_cash_minor bigint,
  counted_cash_minor bigint,
  difference_minor bigint,
  status text NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  totals jsonb
);
CREATE UNIQUE INDEX one_open_session_per_register ON pos.cash_sessions (register_id) WHERE status = 'OPEN';

CREATE TABLE pos.sales (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  register_id uuid NOT NULL,
  session_id uuid NOT NULL,
  cashier_id uuid NOT NULL,
  status smallint NOT NULL DEFAULT 1,
  subtotal_minor bigint NOT NULL,
  discount_minor bigint NOT NULL DEFAULT 0,
  tax_minor bigint NOT NULL,
  total_minor bigint NOT NULL,
  paid_minor bigint NOT NULL DEFAULT 0,
  refunded_minor bigint NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'USD',
  client_txn_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1
);

CREATE TABLE pos.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
