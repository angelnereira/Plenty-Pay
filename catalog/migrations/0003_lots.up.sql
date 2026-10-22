-- PlentyPay - catalog: el producto controla lotes y vencimientos (F16.4, R5 de inventory).
BEGIN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tracks_lots boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD CONSTRAINT products_lots_need_inventory CHECK (NOT tracks_lots OR tracks_inventory);
COMMIT;
