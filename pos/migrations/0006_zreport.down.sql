-- Revierte F17.3: las sesiones pierden su reporte Z y su conteo por denominación.
BEGIN;
ALTER TABLE cash_movements DROP COLUMN refund_id;
ALTER TABLE cash_sessions DROP COLUMN counted_by_denomination;
ALTER TABLE cash_sessions DROP COLUMN z_report;
COMMIT;
