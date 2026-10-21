BEGIN;
DROP TABLE IF EXISTS purchase_receipts, purchase_order_lines, purchase_orders, suppliers;
ALTER TABLE movements DROP CONSTRAINT movements_once;
ALTER TABLE movements ADD CONSTRAINT movements_tenant_id_idempotency_key_type_key UNIQUE (tenant_id, idempotency_key, type);
COMMIT;
