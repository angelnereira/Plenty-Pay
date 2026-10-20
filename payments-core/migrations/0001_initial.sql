-- PlentyPay - payments-core (SPEC §3). El esquema `payments` y sus USAGE/CREATE los crea
-- postgres-db/init; aquí solo tablas, índices, RLS (ADR 0014) y permisos de payments_svc.
-- Nada de dinero se borra: payments_svc no tiene DELETE.

CREATE TABLE payments.terminals (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  public_code text NOT NULL UNIQUE CHECK (public_code ~ '^[A-Za-z0-9_-]{16,64}$'),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE payments.intents (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  created_by uuid NOT NULL,
  payer_party_id uuid,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  rail smallint NOT NULL CHECK (rail BETWEEN 1 AND 8),
  status smallint NOT NULL CHECK (status BETWEEN 1 AND 9),
  terminal_id uuid REFERENCES payments.terminals (id),
  reference_type text NOT NULL DEFAULT '',
  reference_id text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}',
  splits jsonb NOT NULL,
  sandbox boolean NOT NULL,
  next_action jsonb,
  expires_at timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  request_hash bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  -- R1: la clave es del creador dentro del comercio (dos pagadores del mismo comercio no chocan).
  UNIQUE (tenant_id, created_by, idempotency_key)
);
CREATE INDEX intents_expiring ON payments.intents (expires_at) WHERE status IN (1, 2);
CREATE INDEX intents_payer ON payments.intents (payer_party_id, created_at DESC);

CREATE TABLE payments.payments (
  id uuid PRIMARY KEY,
  intent_id uuid NOT NULL UNIQUE REFERENCES payments.intents (id),
  tenant_id uuid NOT NULL,
  payer_party_id uuid,
  status smallint NOT NULL CHECK (status BETWEEN 1 AND 9),
  rail smallint NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  captured_minor bigint NOT NULL DEFAULT 0 CHECK (captured_minor >= 0),
  refunded_minor bigint NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
  currency char(3) NOT NULL,
  fees jsonb,                                    -- FeeBreakdown congelado al capturar (+ por split)
  fee_policy_id uuid,
  ledger_posting smallint NOT NULL DEFAULT 1 CHECK (ledger_posting BETWEEN 1 AND 3),
  ledger_transaction_id uuid,
  hold_id uuid,
  sandbox boolean NOT NULL,
  confirm_idempotency_key text NOT NULL,
  failure_code text,
  unknown_since timestamptz,
  next_check_at timestamptz,
  captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  CHECK (captured_minor <= amount_minor),
  CHECK (refunded_minor <= captured_minor),
  CHECK (status <> 5 OR (captured_minor > 0 AND fees IS NOT NULL AND captured_at IS NOT NULL))
);
CREATE INDEX payments_tenant_time ON payments.payments (tenant_id, created_at DESC, id DESC);
CREATE INDEX payments_payer_time ON payments.payments (payer_party_id, created_at DESC, id DESC);
CREATE INDEX payments_unknown ON payments.payments (next_check_at) WHERE status = 9;
CREATE INDEX payments_in_flight ON payments.payments (next_check_at) WHERE status = 3;
CREATE INDEX payments_posting_pending ON payments.payments (updated_at) WHERE ledger_posting = 1 AND status = 5;

-- Particionado por fecha (SPEC §3) queda para F29: un índice único parcial por pago no puede
-- convivir con la clave de partición.
CREATE TABLE payments.attempts (
  id uuid PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES payments.payments (id),
  attempt_number int NOT NULL CHECK (attempt_number > 0),
  rail smallint NOT NULL,
  status smallint NOT NULL CHECK (status BETWEEN 1 AND 6),
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
  payment_id uuid NOT NULL REFERENCES payments.payments (id),
  tenant_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status smallint NOT NULL CHECK (status BETWEEN 1 AND 3),
  reason text,
  fee_reversal jsonb NOT NULL,
  external_ref text,
  ledger_transaction_id uuid,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

-- Una política nunca se edita: se crea otra con `effective_from` (SPEC §4).
CREATE TABLE payments.fee_policies (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  rail smallint NOT NULL DEFAULT 0,
  fixed_fee_minor bigint NOT NULL CHECK (fixed_fee_minor >= 0),
  percentage_bps int NOT NULL CHECK (percentage_bps BETWEEN 0 AND 10000),
  bearer smallint NOT NULL CHECK (bearer BETWEEN 1 AND 3),
  tax_rate_bps int NOT NULL CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  rail_fixed_fee_minor bigint NOT NULL DEFAULT 0 CHECK (rail_fixed_fee_minor >= 0),
  rail_percentage_bps int NOT NULL DEFAULT 0 CHECK (rail_percentage_bps BETWEEN 0 AND 10000),
  rail_fee_refundable boolean NOT NULL DEFAULT false,
  active boolean NOT NULL,
  effective_from timestamptz NOT NULL,
  created_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  request_hash bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fee_policies_lookup ON payments.fee_policies (tenant_id, rail, effective_from DESC);

CREATE TABLE payments.webhook_events (
  rail smallint NOT NULL,
  provider_event_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_ref text,
  PRIMARY KEY (rail, provider_event_id)
);

-- Proyección de TenantStatusChanged (R2).
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
  tenant_id text NOT NULL DEFAULT '',
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX outbox_unpublished ON payments.outbox (created_at) WHERE published_at IS NULL;

CREATE TABLE payments.processed_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Un pago CAPTURED congela monto, comisiones y asiento; solo cambian reembolsado y el estado del
-- asiento (domain-model §8.1: CAPTURED es terminal y admite reembolsos).
CREATE FUNCTION payments.trg_payments_frozen() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN (5, 6, 7, 8) THEN
    IF NEW.status <> OLD.status
       OR NEW.amount_minor <> OLD.amount_minor
       OR NEW.captured_minor <> OLD.captured_minor
       OR NEW.fees IS DISTINCT FROM OLD.fees
       OR NEW.payer_party_id IS DISTINCT FROM OLD.payer_party_id
       OR (OLD.ledger_transaction_id IS NOT NULL AND NEW.ledger_transaction_id IS DISTINCT FROM OLD.ledger_transaction_id)
       OR NEW.refunded_minor < OLD.refunded_minor THEN
      RAISE EXCEPTION 'payment % is final', OLD.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER payments_frozen BEFORE UPDATE ON payments.payments
  FOR EACH ROW EXECUTE FUNCTION payments.trg_payments_frozen();

CREATE FUNCTION payments.trg_intents_final() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN (5, 6, 7, 8) AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'intent % is final', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.amount_minor <> OLD.amount_minor OR NEW.currency <> OLD.currency
     OR NEW.tenant_id <> OLD.tenant_id OR NEW.splits <> OLD.splits THEN
    RAISE EXCEPTION 'intent % terms are immutable', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER intents_final BEFORE UPDATE ON payments.intents
  FOR EACH ROW EXECUTE FUNCTION payments.trg_intents_final();

-- RLS como segunda barrera (ADR 0014): el servicio (app.actor = service) ve todo; una lectura
-- desde el gateway ve lo de su negocio (app.tenant_id) o lo que pagó (app.party_id).
CREATE FUNCTION payments.actor_is_service() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.actor', true), '') = 'service'
$$;

ALTER TABLE payments.terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.fee_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.tenant_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.processed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY terminals_access ON payments.terminals
  USING (payments.actor_is_service() OR tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (payments.actor_is_service());
CREATE POLICY intents_access ON payments.intents
  USING (payments.actor_is_service()
         OR tenant_id::text = current_setting('app.tenant_id', true)
         OR payer_party_id::text = current_setting('app.party_id', true))
  WITH CHECK (payments.actor_is_service());
CREATE POLICY payments_access ON payments.payments
  USING (payments.actor_is_service()
         OR tenant_id::text = current_setting('app.tenant_id', true)
         OR payer_party_id::text = current_setting('app.party_id', true))
  WITH CHECK (payments.actor_is_service());
CREATE POLICY attempts_access ON payments.attempts
  USING (payments.actor_is_service()
         OR EXISTS (SELECT 1 FROM payments.payments p WHERE p.id = attempts.payment_id
                      AND (p.tenant_id::text = current_setting('app.tenant_id', true)
                           OR p.payer_party_id::text = current_setting('app.party_id', true))))
  WITH CHECK (payments.actor_is_service());
CREATE POLICY refunds_access ON payments.refunds
  USING (payments.actor_is_service() OR tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (payments.actor_is_service());
CREATE POLICY fee_policies_access ON payments.fee_policies
  USING (payments.actor_is_service() OR tenant_id IS NULL
         OR tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (payments.actor_is_service());
CREATE POLICY webhook_events_access ON payments.webhook_events
  USING (payments.actor_is_service()) WITH CHECK (payments.actor_is_service());
CREATE POLICY tenant_status_access ON payments.tenant_status
  USING (payments.actor_is_service()) WITH CHECK (payments.actor_is_service());
CREATE POLICY outbox_access ON payments.outbox
  USING (payments.actor_is_service()) WITH CHECK (payments.actor_is_service());
CREATE POLICY processed_events_access ON payments.processed_events
  USING (payments.actor_is_service()) WITH CHECK (payments.actor_is_service());

GRANT SELECT, INSERT, UPDATE ON payments.terminals, payments.intents, payments.payments,
  payments.attempts, payments.refunds, payments.fee_policies, payments.webhook_events,
  payments.tenant_status, payments.outbox, payments.processed_events TO payments_svc;
GRANT EXECUTE ON FUNCTION payments.actor_is_service() TO payments_svc;
