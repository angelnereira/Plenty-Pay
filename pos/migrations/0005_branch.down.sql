-- Revierte F17.12: las sesiones y ventas pierden su sucursal.
BEGIN;
DROP INDEX sales_by_branch;
ALTER TABLE sales DROP COLUMN branch_id;
ALTER TABLE cash_sessions DROP COLUMN branch_id;
COMMIT;
