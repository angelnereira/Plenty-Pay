-- PlentyPay - pos: devoluciones (F17.9, R9, S-POS-08). Una devolución se escribe en una transacción
-- con la venta (cantidades devueltas en sus líneas), la salida de efectivo de la caja que devuelve,
-- las tareas de reingreso a inventario (RETURN) y las de reintegro al saldo PlentyPay.
BEGIN;

CREATE TABLE refunds (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  sale_id         uuid NOT NULL REFERENCES sales (id),
  session_id      uuid NOT NULL REFERENCES cash_sessions (id),
  reason          text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 300),
  restock         boolean NOT NULL,
  lines           jsonb NOT NULL,
  tenders         jsonb NOT NULL,
  total_minor     bigint NOT NULL CHECK (total_minor > 0),
  cash_minor      bigint NOT NULL CHECK (cash_minor >= 0),
  wallet_minor    bigint NOT NULL CHECK (wallet_minor >= 0),
  status          text NOT NULL CHECK (status IN ('PENDING','DONE','FAILED')),
  failure         text NOT NULL DEFAULT '',
  idempotency_key text NOT NULL,
  request_hash    bytea NOT NULL,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL,
  done_at         timestamptz,
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX refunds_by_sale ON refunds (sale_id, created_at);

-- Reintegro de la parte en saldo PlentyPay: payments.RefundPayment fuera de la transacción, con
-- reintento y la clave `posrefund:<devolución>:<medio>` (nunca dos reembolsos del mismo medio).
CREATE TABLE refund_tasks (
  id                uuid PRIMARY KEY,
  tenant_id         uuid NOT NULL,
  refund_id         uuid NOT NULL REFERENCES refunds (id),
  sale_id           uuid NOT NULL REFERENCES sales (id),
  payment_intent_id text NOT NULL,
  amount_minor      bigint NOT NULL CHECK (amount_minor > 0),
  idempotency_key   text NOT NULL UNIQUE,
  status            text NOT NULL CHECK (status IN ('PENDING','DONE','FAILED')),
  attempts          int NOT NULL DEFAULT 0,
  next_attempt_at   timestamptz NOT NULL,
  last_error        text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL,
  done_at           timestamptz
);
CREATE INDEX refund_tasks_due ON refund_tasks (next_attempt_at) WHERE status = 'PENDING';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['refunds','refund_tasks'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))
      WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))$p$, t || '_tenant', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON refunds, refund_tasks TO pos_svc;

COMMIT;
