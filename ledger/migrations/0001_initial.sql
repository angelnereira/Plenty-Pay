CREATE SCHEMA IF NOT EXISTS ledger;

-- Ledger schema (F10.2). Triggers enforce invariants I1-I3 as second barrier.

CREATE TABLE ledger.accounts (
  id uuid PRIMARY KEY,
  party_id uuid NOT NULL,
  account_type smallint NOT NULL,
  currency char(3) NOT NULL,
  scope_id text NOT NULL DEFAULT '',
  tenant_id uuid,
  allow_negative boolean NOT NULL DEFAULT false,
  balance_minor bigint NOT NULL DEFAULT 0,
  held_minor bigint NOT NULL DEFAULT 0 CHECK (held_minor >= 0),
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, account_type, currency, scope_id)
);

CREATE TABLE ledger.transactions (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  transaction_type text NOT NULL,
  reference_type text NOT NULL,
  reference_id text NOT NULL,
  currency char(3) NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('DRAFT','POSTED','REVERSED')),
  reversal_of uuid UNIQUE REFERENCES ledger.transactions(id),
  idempotency_key text NOT NULL UNIQUE,
  request_hash bytea NOT NULL,
  effective_at timestamptz NOT NULL,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
 );

CREATE UNIQUE INDEX one_capture_per_payment
  ON ledger.transactions (reference_type, reference_id)
  WHERE transaction_type IN ('PAYMENT_CAPTURE','WALLET_PAYMENT') AND status <> 'DRAFT';

CREATE TABLE ledger.entries (
  id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES ledger.transactions(id),
  account_id uuid NOT NULL REFERENCES ledger.accounts(id),
  side char(1) NOT NULL CHECK (side IN ('D','C')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
 );

CREATE INDEX entries_account_time ON ledger.entries (account_id, created_at DESC, id DESC);

CREATE TABLE ledger.holds (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES ledger.accounts(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status text NOT NULL,
  reference_type text NOT NULL,
  reference_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  captured_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX holds_active_expiry ON ledger.holds (expires_at) WHERE status = 'ACTIVE';

-- Trigger: no UPDATE/DELETE of POSTED transactions except status->REVERSED when a reversal is inserted.
CREATE OR REPLACE FUNCTION ledger.trg_transactions_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'POSTED' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'cannot delete posted transaction';
    END IF;
    IF NEW.status <> OLD.status AND NOT (OLD.status='POSTED' AND NEW.status='REVERSED') THEN
      RAISE EXCEPTION 'cannot modify posted transaction';
    END IF;
    IF NEW.id <> OLD.id OR NEW.idempotency_key <> OLD.idempotency_key THEN
      RAISE EXCEPTION 'cannot modify posted transaction identity';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_immutable
  BEFORE UPDATE OR DELETE ON ledger.transactions
  FOR EACH ROW EXECUTE FUNCTION ledger.trg_transactions_immutable();

-- Trigger: no UPDATE/DELETE of entries; no INSERT into a POSTED transaction.
CREATE OR REPLACE FUNCTION ledger.trg_entries_immutable() RETURNS trigger AS $$
DECLARE
  tx_status text;
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'entries are immutable';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO tx_status FROM ledger.transactions WHERE id = NEW.transaction_id;
    IF tx_status = 'POSTED' THEN
      RAISE EXCEPTION 'cannot insert entry into posted transaction';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entries_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON ledger.entries
  FOR EACH ROW EXECUTE FUNCTION ledger.trg_entries_immutable();

-- Trigger: on POSTED, sum D == sum C, >= 2 entries, all same currency as transaction, amounts > 0.
CREATE OR REPLACE FUNCTION ledger.trg_transaction_posted_balance() RETURNS trigger AS $$
DECLARE
  d_sum bigint;
  c_sum bigint;
  n int;
  bad_currency int;
BEGIN
  IF NEW.status = 'POSTED' AND OLD.status <> 'POSTED' THEN
    SELECT COALESCE(SUM(CASE WHEN side='D' THEN amount_minor ELSE 0 END),0),
           COALESCE(SUM(CASE WHEN side='C' THEN amount_minor ELSE 0 END),0),
           COUNT(*)
      INTO d_sum, c_sum, n
      FROM ledger.entries WHERE transaction_id = NEW.id;
    IF n < 2 THEN
      RAISE EXCEPTION 'transaction must have at least 2 entries';
    END IF;
    IF d_sum <> c_sum THEN
      RAISE EXCEPTION 'unbalanced transaction: debits=%s credits=%s', d_sum, c_sum;
    END IF;
    SELECT COUNT(*) INTO bad_currency
      FROM ledger.entries WHERE transaction_id = NEW.id AND currency <> NEW.currency;
    IF bad_currency > 0 THEN
      RAISE EXCEPTION 'entry currency mismatch';
    END IF;
    NEW.posted_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_posted_balance
  BEFORE UPDATE ON ledger.transactions
  FOR EACH ROW EXECUTE FUNCTION ledger.trg_transaction_posted_balance();

CREATE TABLE ledger.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX outbox_unpublished ON ledger.outbox (created_at) WHERE published_at IS NULL;
