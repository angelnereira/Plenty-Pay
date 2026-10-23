-- Revierte F16.9: las bodegas pierden su sucursal (el alcance deja de aplicarse en inventory).
BEGIN;
DROP INDEX warehouses_by_branch;
ALTER TABLE warehouses DROP COLUMN branch_id;
COMMIT;
