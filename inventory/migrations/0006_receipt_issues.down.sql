-- Revierte F16.12. Falla si hay órdenes CLOSED_SHORT (son historial: no se reescriben).
BEGIN;
DROP TABLE purchase_receipt_issues;
ALTER TABLE purchase_order_lines DROP CONSTRAINT purchase_order_lines_damaged_range;
ALTER TABLE purchase_order_lines DROP COLUMN damaged_milli;
ALTER TABLE purchase_orders DROP COLUMN close_reason;
ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status BETWEEN 1 AND 5);
COMMIT;
