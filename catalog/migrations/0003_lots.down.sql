BEGIN;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_lots_need_inventory;
ALTER TABLE products DROP COLUMN IF EXISTS tracks_lots;
COMMIT;
