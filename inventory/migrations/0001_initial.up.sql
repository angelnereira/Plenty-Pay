-- PlentyPay - inventory: bodegas, existencias y movimientos inmutables (SPEC §3, F16.1–F16.2, F16.4).
-- Reservas, lotes, proveedores y órdenes de compra llegan en F16.3/F16.5 con migraciones aditivas.
-- Desviación registrada: `movements` aún no se particiona por fecha (la clave única de
-- idempotencia tendría que incluir la columna de partición); se hará al superar el volumen de F16.
BEGIN;

CREATE TABLE warehouses (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  branch_code text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL
);
CREATE UNIQUE INDEX warehouses_one_default ON warehouses (tenant_id) WHERE is_default;
CREATE UNIQUE INDEX warehouses_name ON warehouses (tenant_id, lower(name));

CREATE TABLE stock_levels (
  tenant_id           uuid NOT NULL,
  warehouse_id        uuid NOT NULL REFERENCES warehouses (id),
  product_id          uuid NOT NULL,
  on_hand_milli       bigint NOT NULL DEFAULT 0,
  reserved_milli      bigint NOT NULL DEFAULT 0 CHECK (reserved_milli >= 0),
  reorder_point_milli bigint NOT NULL DEFAULT 0 CHECK (reorder_point_milli >= 0),
  low_notified_on     date,
  version             bigint NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL,
  PRIMARY KEY (warehouse_id, product_id)
);
CREATE INDEX stock_levels_tenant ON stock_levels (tenant_id, warehouse_id, product_id);

-- R1: inmutables. `on_hand` = Σ delta_milli (verificable en cualquier momento).
CREATE TABLE movements (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  warehouse_id    uuid NOT NULL REFERENCES warehouses (id),
  product_id      uuid NOT NULL,
  type            smallint NOT NULL CHECK (type BETWEEN 1 AND 7),
  delta_milli     bigint NOT NULL CHECK (delta_milli <> 0),
  reason          text NOT NULL DEFAULT '',
  reference_type  text NOT NULL DEFAULT '',
  reference_id    text NOT NULL DEFAULT '',
  actor_user_id   uuid,
  actor_service   text NOT NULL DEFAULT '',
  idempotency_key text NOT NULL,
  request_hash    bytea NOT NULL,
  created_at      timestamptz NOT NULL,
  UNIQUE (tenant_id, idempotency_key, type)
);
CREATE INDEX movements_by_product ON movements (tenant_id, product_id, created_at DESC, id DESC);
CREATE INDEX movements_by_warehouse ON movements (tenant_id, warehouse_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION movements_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'inventory.movements es inmutable (R1): corrige con un movimiento nuevo';
END $$;
CREATE TRIGGER movements_no_update BEFORE UPDATE OR DELETE ON movements
  FOR EACH ROW EXECUTE FUNCTION movements_immutable();

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

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['warehouses','stock_levels','movements','outbox'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))
      WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))$p$, t || '_tenant', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON warehouses, stock_levels, outbox TO inventory_svc;
GRANT SELECT, INSERT ON movements TO inventory_svc;

COMMIT;
