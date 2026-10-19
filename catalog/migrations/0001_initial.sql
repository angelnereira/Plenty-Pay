CREATE SCHEMA IF NOT EXISTS catalog;

CREATE TABLE catalog.categories (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  parent_id uuid,
  name text NOT NULL,
  slug text NOT NULL,
  position int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE catalog.products (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  description text,
  category_id uuid,
  global_category_id uuid,
  status smallint NOT NULL DEFAULT 1,
  tax_rate_bps int NOT NULL DEFAULT 700,
  tax_included boolean NOT NULL DEFAULT true,
  track_inventory boolean NOT NULL DEFAULT true,
  unit text NOT NULL DEFAULT 'unit',
  images text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1
);

CREATE TABLE catalog.variants (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  sku text NOT NULL,
  barcode text,
  option_values jsonb NOT NULL DEFAULT '{}',
  price_minor bigint NOT NULL CHECK (price_minor >= 0),
  cost_minor bigint,
  currency char(3) NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, sku)
);
CREATE UNIQUE INDEX variants_barcode ON catalog.variants (tenant_id, barcode) WHERE barcode IS NOT NULL;
