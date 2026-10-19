CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE inventory.warehouses (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory.stock_levels (
  variant_id uuid NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES inventory.warehouses(id),
  tenant_id uuid NOT NULL,
  on_hand bigint NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved bigint NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  available bigint GENERATED ALWAYS AS (on_hand - reserved) STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, warehouse_id)
);

CREATE TABLE inventory.movements (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  movement_type text NOT NULL,
  qty bigint NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory.reservations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  qty bigint NOT NULL CHECK (qty > 0),
  status text NOT NULL DEFAULT 'ACTIVE',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservations_active_expiry ON inventory.reservations (expires_at) WHERE status = 'ACTIVE';

CREATE TABLE inventory.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
