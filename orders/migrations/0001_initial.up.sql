-- PlentyPay - orders: carrito, cotizaciones, pedidos multi-comercio y tareas de la saga
-- (SPEC §3, F15.6–F15.9, ADR 0017). RLS: el comprador ve lo suyo (`app.user_id`); el comercio, sus
-- sub-pedidos (`app.tenant_id`); el propio servicio (`app.actor_role = SYSTEM`) conduce la saga.
BEGIN;

CREATE TABLE cart_items (
  user_id      uuid NOT NULL,
  product_id   uuid NOT NULL,
  tenant_id    uuid NOT NULL,
  qty_milli    bigint NOT NULL CHECK (qty_milli > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  name         text NOT NULL,
  added_at     timestamptz NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE quotes (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL,
  merchants   jsonb NOT NULL,
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  currency    char(3) NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL
);

CREATE TABLE orders (
  id                uuid PRIMARY KEY,
  user_id           uuid NOT NULL,                 -- comprador
  status            smallint NOT NULL CHECK (status BETWEEN 1 AND 6),
  currency          char(3) NOT NULL,
  total_minor       bigint NOT NULL CHECK (total_minor > 0),
  fulfillment       smallint NOT NULL CHECK (fulfillment IN (1, 2)),
  payment_intent_id uuid,
  payment_id        uuid,
  idempotency_key   text NOT NULL,
  cancel_reason     text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL,
  updated_at        timestamptz NOT NULL,
  version           int NOT NULL DEFAULT 1,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX orders_mine ON orders (user_id, created_at DESC, id DESC);
CREATE INDEX orders_pending ON orders (created_at) WHERE status = 1;

CREATE TABLE sub_orders (
  id              uuid PRIMARY KEY,
  order_id        uuid NOT NULL REFERENCES orders (id),
  tenant_id       uuid NOT NULL,                   -- comercio
  user_id         uuid NOT NULL,                   -- comprador (RLS)
  status          smallint NOT NULL CHECK (status BETWEEN 1 AND 8),
  fulfillment     smallint NOT NULL CHECK (fulfillment IN (1, 2)),
  lines           jsonb NOT NULL,                  -- R1: instantánea
  total_minor     bigint NOT NULL CHECK (total_minor > 0),
  reservation_id  uuid,
  pickup_code     text NOT NULL DEFAULT '',
  reject_reason   text NOT NULL DEFAULT '',
  accept_deadline timestamptz,
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL,
  version         int NOT NULL DEFAULT 1
);
CREATE INDEX sub_orders_tenant_status ON sub_orders (tenant_id, status, created_at DESC);
CREATE INDEX sub_orders_accept_deadline ON sub_orders (accept_deadline) WHERE status = 2;
CREATE INDEX sub_orders_order ON sub_orders (order_id);

-- Compensaciones y efectos externos de la saga: liberar/confirmar reservas, devolver stock y
-- reembolsar. Nacen en la MISMA transacción que el cambio de estado; un worker las entrega con su
-- clave determinista (nunca se pierden ni se duplican).
CREATE TABLE saga_tasks (
  id              uuid PRIMARY KEY,
  order_id        uuid NOT NULL REFERENCES orders (id),
  sub_order_id    uuid REFERENCES sub_orders (id),
  tenant_id       uuid NOT NULL,
  user_id         uuid NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('RELEASE','COMMIT','RETURN','REFUND')),
  idempotency_key text NOT NULL UNIQUE,
  status          text NOT NULL CHECK (status IN ('PENDING','DONE','FAILED')),
  attempts        int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL,
  last_error      text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL,
  done_at         timestamptz
);
CREATE INDEX saga_tasks_due ON saga_tasks (next_attempt_at) WHERE status = 'PENDING';

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

CREATE TABLE processed_events (
  event_id     uuid PRIMARY KEY,
  processed_at timestamptz NOT NULL
);

-- RLS por comprador (carrito, cotizaciones, pedidos) y por comprador o comercio (sub-pedidos).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cart_items','quotes','orders'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (current_setting('app.actor_role', true) = 'SYSTEM' OR user_id::text = current_setting('app.user_id', true))
      WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM' OR user_id::text = current_setting('app.user_id', true))$p$,
      t || '_owner', t);
  END LOOP;
END $$;
ALTER TABLE sub_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY sub_orders_access ON sub_orders
  USING (current_setting('app.actor_role', true) = 'SYSTEM'
         OR user_id::text = current_setting('app.user_id', true)
         OR tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM');
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['saga_tasks','outbox','processed_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I USING (current_setting('app.actor_role', true) = 'SYSTEM')
      WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM')$p$, t || '_system', t);
  END LOOP;
END $$;

-- El carrito es del comprador (se vacía); nada financiero se borra.
GRANT SELECT, INSERT, UPDATE, DELETE ON cart_items TO orders_svc;
GRANT SELECT, INSERT ON quotes, processed_events TO orders_svc;
GRANT SELECT, INSERT, UPDATE ON orders, sub_orders, saga_tasks, outbox TO orders_svc;

COMMIT;
