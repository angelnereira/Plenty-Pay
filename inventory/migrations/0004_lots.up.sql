-- PlentyPay - inventory: lotes y vencimientos con salida FEFO (SPEC §5 R5, F16.4).
-- Un lote es (bodega, producto, código). Su existencia se mueve en la misma transacción que el
-- movimiento que lo toca; los movimientos siguen siendo inmutables (R1) y llevan su lote.
BEGIN;

CREATE TABLE lots (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL,
  warehouse_id  uuid NOT NULL REFERENCES warehouses (id),
  product_id    uuid NOT NULL,
  code          text NOT NULL CHECK (code ~ '^[A-Za-z0-9._/-]{1,40}$'),
  expires_on    date,
  on_hand_milli bigint NOT NULL DEFAULT 0 CHECK (on_hand_milli >= 0),
  created_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL,
  UNIQUE (tenant_id, warehouse_id, product_id, code)
);
CREATE INDEX lots_fefo ON lots (warehouse_id, product_id, expires_on NULLS LAST, code) WHERE on_hand_milli > 0;

ALTER TABLE movements ADD COLUMN lot_id uuid REFERENCES lots (id);

-- Una salida FEFO se reparte en varios lotes con la misma clave: la unicidad incluye el lote.
ALTER TABLE movements DROP CONSTRAINT movements_once;
CREATE UNIQUE INDEX movements_once ON movements (tenant_id, idempotency_key, type, warehouse_id, product_id,
  coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots FORCE ROW LEVEL SECURITY;
CREATE POLICY lots_tenant ON lots
  USING (current_setting('app.actor_role', true) = 'SYSTEM'
         OR tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
         OR tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON lots TO inventory_svc;

COMMIT;
