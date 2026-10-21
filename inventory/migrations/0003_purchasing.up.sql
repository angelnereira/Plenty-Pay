-- PlentyPay - inventory: proveedores, órdenes de compra y recepciones (SPEC §3, F16.5).
-- Las líneas van en su propia tabla para poder bloquear y sumar lo recibido; cada recepción queda
-- registrada (idempotente por clave) y genera movimientos RECEIPT en la misma transacción.
BEGIN;

-- Una recepción mueve varias líneas con la misma clave: la unicidad de un movimiento pasa a ser por
-- (clave, tipo, bodega, producto). Sigue detectando el reintento concurrente de la misma operación.
ALTER TABLE movements DROP CONSTRAINT movements_tenant_id_idempotency_key_type_key;
ALTER TABLE movements ADD CONSTRAINT movements_once UNIQUE (tenant_id, idempotency_key, type, warehouse_id, product_id);

CREATE TABLE suppliers (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  tax_id          text NOT NULL DEFAULT '',
  check_digit     text NOT NULL DEFAULT '' CHECK (check_digit = '' OR check_digit ~ '^[0-9]{2}$'),
  email           text NOT NULL DEFAULT '',
  phone           text NOT NULL DEFAULT '',
  lead_time_days  int NOT NULL DEFAULT 7 CHECK (lead_time_days BETWEEN 0 AND 365),
  active          boolean NOT NULL DEFAULT true,
  idempotency_key text NOT NULL,
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL,
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX suppliers_by_name ON suppliers (tenant_id, lower(name));

CREATE TABLE purchase_orders (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  supplier_id     uuid NOT NULL REFERENCES suppliers (id),
  warehouse_id    uuid NOT NULL REFERENCES warehouses (id),
  status          smallint NOT NULL CHECK (status BETWEEN 1 AND 5),   -- domain-model §8.12
  expected_at     timestamptz,
  total_minor     bigint NOT NULL CHECK (total_minor >= 0),
  currency        char(3) NOT NULL DEFAULT 'USD',
  idempotency_key text NOT NULL,
  request_hash    bytea NOT NULL,
  created_by      uuid,
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL,
  version         int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX purchase_orders_by_tenant ON purchase_orders (tenant_id, created_at DESC, id DESC);

CREATE TABLE purchase_order_lines (
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders (id),
  tenant_id         uuid NOT NULL,
  product_id        uuid NOT NULL,
  ordered_milli     bigint NOT NULL CHECK (ordered_milli > 0),
  received_milli    bigint NOT NULL DEFAULT 0 CHECK (received_milli >= 0 AND received_milli <= ordered_milli),
  unit_cost_minor   bigint NOT NULL CHECK (unit_cost_minor >= 0),
  PRIMARY KEY (purchase_order_id, product_id)
);
CREATE INDEX purchase_order_lines_product ON purchase_order_lines (tenant_id, product_id);

CREATE TABLE purchase_receipts (
  id                uuid PRIMARY KEY,
  tenant_id         uuid NOT NULL,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders (id),
  supplier_invoice  text NOT NULL DEFAULT '',
  idempotency_key   text NOT NULL,
  request_hash      bytea NOT NULL,
  created_by        uuid,
  created_at        timestamptz NOT NULL,
  UNIQUE (tenant_id, idempotency_key)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','purchase_orders','purchase_order_lines','purchase_receipts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))
      WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))$p$, t || '_tenant', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON suppliers, purchase_orders, purchase_order_lines TO inventory_svc;
GRANT SELECT, INSERT ON purchase_receipts TO inventory_svc;

COMMIT;
