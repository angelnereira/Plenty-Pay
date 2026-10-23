-- PlentyPay - pos: reporte Z guardado al cerrar la caja y conteo por denominación (F17.3, R16).
-- Las sesiones cerradas antes de F17.3 quedan sin reporte (historial; no se recalcula).
BEGIN;
ALTER TABLE cash_sessions ADD COLUMN z_report jsonb;
ALTER TABLE cash_sessions ADD COLUMN counted_by_denomination jsonb NOT NULL DEFAULT '[]';
-- La salida de efectivo de una devolución (F17.9) se liga a su devolución: el reporte Z la cuenta
-- en «refund:CASH» y no otra vez en «cash_out». El relleno de las anteriores va en 0007.
ALTER TABLE cash_movements ADD COLUMN refund_id uuid REFERENCES refunds (id);
COMMIT;
