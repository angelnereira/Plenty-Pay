-- PlentyPay - catalog: productos, categorías, outbox e idempotencia (SPEC §3, F15.1–F15.2).
-- Un producto lleva su variante única (sku, código de barras, precio): las variantes múltiples
-- llegan con F15.1b sin cambiar estas columnas (catalog.proto `Product` es plano).
BEGIN;

CREATE TABLE categories (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL,
  parent_id  uuid REFERENCES categories (id),
  name       text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  depth      smallint NOT NULL CHECK (depth BETWEEN 1 AND 4),          -- R: árbol ≤ 4 niveles
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX categories_name ON categories (tenant_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'), lower(name));

CREATE TABLE products (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL,
  sku              text NOT NULL CHECK (length(sku) BETWEEN 1 AND 64),
  barcode          text CHECK (barcode IS NULL OR barcode ~ '^[0-9]{8,14}$'),
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  description      text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  category_id      uuid REFERENCES categories (id),
  brand            text NOT NULL DEFAULT '',
  unit_type        text NOT NULL CHECK (unit_type IN ('UNIT','KG','LITER','METER')),
  price_minor      bigint NOT NULL CHECK (price_minor >= 0),            -- R2: entero ≥ 0
  currency         char(3) NOT NULL,
  tax_rate_bps     int NOT NULL CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  cpbs_code        text NOT NULL DEFAULT '',
  image_object_keys text[] NOT NULL DEFAULT '{}',
  attributes       jsonb NOT NULL DEFAULT '{}',
  status           smallint NOT NULL CHECK (status IN (1, 2)),           -- ACTIVE | ARCHIVED
  tracks_inventory boolean NOT NULL,
  created_by       uuid,
  created_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL,
  version          int NOT NULL DEFAULT 1,
  search           tsvector GENERATED ALWAYS AS (
                     to_tsvector('spanish', name || ' ' || brand || ' ' || sku || ' ' || coalesce(barcode, ''))) STORED
);
CREATE UNIQUE INDEX products_sku ON products (tenant_id, sku);                                   -- R1
CREATE UNIQUE INDEX products_barcode ON products (tenant_id, barcode) WHERE barcode IS NOT NULL; -- R1
CREATE INDEX products_list ON products (tenant_id, status, lower(name), id);
CREATE INDEX products_search ON products USING gin (search);

-- Outbox (ADR 0012): la fila se escribe en la MISMA transacción que el cambio.
CREATE TABLE outbox (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  aggregate_id uuid NOT NULL,
  subject      text NOT NULL,
  payload      bytea NOT NULL,         -- mensaje proto serializado
  created_at   timestamptz NOT NULL,
  published_at timestamptz
);
CREATE INDEX outbox_pending ON outbox (created_at) WHERE published_at IS NULL;

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

-- RLS (ADR 0014): segunda barrera. `app.tenant_id` lo fija cada transacción del servicio;
-- `app.actor_role = SYSTEM` es solo para el relay del outbox y la purga.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','outbox','idempotency_keys'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))
      WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))$p$, t || '_tenant', t);
  END LOOP;
END $$;

-- Nada financiero ni de catálogo se borra: archivar es un cambio de estado (R: ArchiveProduct).
GRANT SELECT, INSERT, UPDATE ON categories, products, outbox TO catalog_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO catalog_svc;

COMMIT;
