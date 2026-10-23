-- PlentyPay - pos: sucursal de cada sesión de caja y de cada venta (F17.12, R15, ADR 0018).
-- Lo anterior a F17.12 queda sin sucursal (historial; no se reescribe).
BEGIN;
ALTER TABLE cash_sessions ADD COLUMN branch_id uuid;
ALTER TABLE sales ADD COLUMN branch_id uuid;
CREATE INDEX sales_by_branch ON sales (tenant_id, branch_id, created_at DESC);
COMMIT;
