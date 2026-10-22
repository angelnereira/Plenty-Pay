BEGIN;
DROP INDEX IF EXISTS movements_once;
ALTER TABLE movements ADD CONSTRAINT movements_once UNIQUE (tenant_id, idempotency_key, type, warehouse_id, product_id);
ALTER TABLE movements DROP COLUMN IF EXISTS lot_id;
DROP TABLE IF EXISTS lots;
COMMIT;
