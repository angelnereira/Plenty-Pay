-- PlentyPay - pos: sesiones de caja, ventas, tareas de stock, outbox (SPEC §3, F17.1–F17.5).
-- Las líneas y los medios de pago se guardan como instantánea jsonb de la venta (R3 de catalog:
-- un cambio de precio posterior no las toca). Devoluciones, crédito de la casa y ventas offline
-- llegan con F17.6–F17.9 en migraciones aditivas.
BEGIN;

CREATE TABLE cash_sessions (
  id                uuid PRIMARY KEY,
  tenant_id         uuid NOT NULL,
  terminal_label    text NOT NULL CHECK (length(terminal_label) BETWEEN 1 AND 40),
  cashier_id        uuid NOT NULL,
  status            text NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  opening_float     bigint NOT NULL CHECK (opening_float >= 0),
  expected_cash     bigint NOT NULL,
  counted_cash      bigint,
  difference_minor  bigint,
  close_notes       text NOT NULL DEFAULT '',
  currency          char(3) NOT NULL,
  opened_at         timestamptz NOT NULL,
  closed_at         timestamptz,
  closed_by         uuid
);
-- R1: una sola sesión abierta por caja.
CREATE UNIQUE INDEX one_open_session_per_terminal ON cash_sessions (tenant_id, lower(terminal_label)) WHERE status = 'OPEN';
CREATE INDEX cash_sessions_cashier ON cash_sessions (tenant_id, cashier_id, opened_at DESC);

CREATE TABLE cash_movements (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  session_id   uuid NOT NULL REFERENCES cash_sessions (id),
  direction    text NOT NULL CHECK (direction IN ('IN','OUT')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  reason       text NOT NULL,
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL
);

CREATE TABLE sales (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL,
  session_id     uuid NOT NULL REFERENCES cash_sessions (id),
  cashier_id     uuid NOT NULL,
  status         smallint NOT NULL CHECK (status BETWEEN 1 AND 7),
  lines          jsonb NOT NULL DEFAULT '[]',
  tenders        jsonb NOT NULL DEFAULT '[]',
  subtotal_minor bigint NOT NULL DEFAULT 0,
  tax_minor      bigint NOT NULL DEFAULT 0,
  total_minor    bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  change_minor   bigint NOT NULL DEFAULT 0 CHECK (change_minor >= 0),
  currency       char(3) NOT NULL,
  receipt_number bigint,
  client_sale_id text NOT NULL DEFAULT '',
  needs_review   boolean NOT NULL DEFAULT false,
  void_reason    text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL,
  paid_at        timestamptz,
  version        int NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX sales_client_id ON sales (tenant_id, client_sale_id) WHERE client_sale_id <> '';
CREATE UNIQUE INDEX sales_receipt ON sales (tenant_id, receipt_number) WHERE receipt_number IS NOT NULL;
CREATE INDEX sales_history ON sales (tenant_id, created_at DESC, id DESC);
CREATE INDEX sales_by_session ON sales (session_id, status);

-- R10: número de recibo consecutivo por tenant (independiente del folio fiscal).
CREATE TABLE receipt_counters (
  tenant_id uuid PRIMARY KEY,
  last      bigint NOT NULL
);

-- Descuento de existencias de una venta pagada. Nace en la MISMA transacción que el pago y un
-- worker lo entrega a inventory con la clave `sale:<sale_id>:<line_id>` (SPEC §7: si inventory
-- cae, el movimiento queda diferido y se reintenta; nunca se pierde ni se duplica).
CREATE TABLE stock_tasks (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  sale_id         uuid NOT NULL REFERENCES sales (id),
  line_id         uuid NOT NULL,
  product_id      uuid NOT NULL,
  qty_milli       bigint NOT NULL CHECK (qty_milli > 0),
  movement_type   smallint NOT NULL CHECK (movement_type IN (2, 6)),  -- SALE | RETURN
  idempotency_key text NOT NULL,
  status          text NOT NULL CHECK (status IN ('PENDING','DONE','FAILED')),
  attempts        int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL,
  last_error      text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL,
  done_at         timestamptz,
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX stock_tasks_due ON stock_tasks (next_attempt_at) WHERE status = 'PENDING';

CREATE TABLE outbox (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  aggregate_id uuid NOT NULL,
  subject      text NOT NULL,
  payload      bytea NOT NULL,
  created_at   timestamptz NOT NULL,
  published_at timestamptz
);
CREATE INDEX outbox_pending ON outbox (created_at) WHERE published_at IS NULL;

-- Consumidores idempotentes (ADR 0012): el event_id se registra en la misma transacción que su efecto.
CREATE TABLE processed_events (
  event_id     uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  processed_at timestamptz NOT NULL
);

CREATE TABLE idempotency_keys (
  tenant_id    uuid NOT NULL,
  rpc          text NOT NULL,
  key          text NOT NULL,
  request_hash bytea NOT NULL,
  response     bytea,
  state        text NOT NULL CHECK (state IN ('IN_PROGRESS','DONE')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, rpc, key)
);
CREATE INDEX idempotency_keys_created ON idempotency_keys (created_at);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cash_sessions','cash_movements','sales','receipt_counters','stock_tasks','outbox',
                           'processed_events','idempotency_keys'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))
      WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))$p$, t || '_tenant', t);
  END LOOP;
END $$;

-- Nada financiero se borra (ventas, medios, arqueos, movimientos de caja): solo la clave de
-- idempotencia vencida se purga.
GRANT SELECT, INSERT, UPDATE ON cash_sessions, sales, receipt_counters, stock_tasks, outbox TO pos_svc;
GRANT SELECT, INSERT ON cash_movements, processed_events TO pos_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO pos_svc;

COMMIT;
