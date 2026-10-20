BEGIN;
DROP TABLE IF EXISTS outbox, movements, stock_levels, warehouses;
DROP FUNCTION IF EXISTS movements_immutable();
COMMIT;
