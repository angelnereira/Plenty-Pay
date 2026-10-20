-- PlentyPay - catalog: listados del marketplace, vitrina y proyecciones (SPEC §3, F15.4–F15.5).
BEGIN;

-- Un producto se publica (o no) en el marketplace. Precio de marketplace opcional (si falta, el del
-- producto). R4: solo negocios ACTIVE publican.
CREATE TABLE listings (
  product_id     uuid PRIMARY KEY REFERENCES products (id),
  tenant_id      uuid NOT NULL,
  listed         boolean NOT NULL,
  price_minor    bigint CHECK (price_minor IS NULL OR price_minor > 0),
  delivery       boolean NOT NULL DEFAULT false,
  pickup         boolean NOT NULL DEFAULT true,
  published_at   timestamptz,
  updated_at     timestamptz NOT NULL,
  CHECK (NOT listed OR delivery OR pickup)
);
CREATE INDEX listings_listed ON listings (tenant_id) WHERE listed;

CREATE TABLE storefronts (
  tenant_id       uuid PRIMARY KEY,
  display_name    text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  description     text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  logo_object_key text NOT NULL DEFAULT '',
  address         jsonb NOT NULL DEFAULT '{}',
  published       boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL
);

-- Proyección de identity.TenantStatusChanged (R4, R7). Sin fila = desconocido: se consulta identity.
CREATE TABLE tenant_status (
  tenant_id  uuid PRIMARY KEY,
  status     smallint NOT NULL,       -- identity.TenantStatus
  updated_at timestamptz NOT NULL
);

-- Proyección de inventory.StockChanged (R5): disponible por bodega; in_stock = Σ > 0.
CREATE TABLE product_stock (
  tenant_id      uuid NOT NULL,
  product_id     uuid NOT NULL,
  warehouse_id   uuid NOT NULL,
  available_milli bigint NOT NULL,
  updated_at     timestamptz NOT NULL,
  PRIMARY KEY (product_id, warehouse_id)
);

CREATE TABLE processed_events (
  event_id     uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  processed_at timestamptz NOT NULL
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['listings','storefronts','tenant_status','product_stock','processed_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))
      WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))$p$, t || '_tenant', t);
  END LOOP;
END $$;
-- La lectura pública del marketplace cruza comercios: corre como SYSTEM y filtra por listed,
-- producto ACTIVE y negocio ACTIVE en la propia consulta (R7).

GRANT SELECT, INSERT, UPDATE ON listings, storefronts, tenant_status, product_stock TO catalog_svc;
GRANT SELECT, INSERT ON processed_events TO catalog_svc;

COMMIT;
