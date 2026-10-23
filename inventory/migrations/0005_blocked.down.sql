-- Revierte F16.10. Falla si hay movimientos BLOCK/UNBLOCK (son historial: no se borran).
BEGIN;
DROP TABLE settings;
ALTER TABLE movements DROP CONSTRAINT movements_type_check;
ALTER TABLE movements ADD CONSTRAINT movements_type_check CHECK (type BETWEEN 1 AND 7);
ALTER TABLE lots DROP CONSTRAINT lots_blocked_range;
ALTER TABLE lots DROP COLUMN blocked_milli;
ALTER TABLE stock_levels DROP COLUMN blocked_milli;
COMMIT;
