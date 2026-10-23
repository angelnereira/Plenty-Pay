-- PlentyPay - inventory: existencias bloqueadas y aviso de vencimiento (F16.10).
-- Bloqueado = físico que no se vende (dañado, en revisión, retirado). No cambia on_hand:
-- disponible = on_hand − reservado − bloqueado. BLOCK (8) y UNBLOCK (9) son movimientos
-- inmutables como los demás (R1: on_hand = Σ físicos; bloqueado = Σ BLOCK/UNBLOCK).
BEGIN;

ALTER TABLE stock_levels ADD COLUMN blocked_milli bigint NOT NULL DEFAULT 0 CHECK (blocked_milli >= 0);

ALTER TABLE lots ADD COLUMN blocked_milli bigint NOT NULL DEFAULT 0;
ALTER TABLE lots ADD CONSTRAINT lots_blocked_range CHECK (blocked_milli >= 0 AND blocked_milli <= on_hand_milli);

ALTER TABLE movements DROP CONSTRAINT movements_type_check;
ALTER TABLE movements ADD CONSTRAINT movements_type_check CHECK (type BETWEEN 1 AND 9);

-- Parámetros de inventario del comercio. Sin fila = valores por defecto (30 días de aviso).
CREATE TABLE settings (
  tenant_id         uuid PRIMARY KEY,
  expiry_alert_days int NOT NULL CHECK (expiry_alert_days BETWEEN 1 AND 365),
  updated_by        uuid,
  updated_at        timestamptz NOT NULL
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings FORCE ROW LEVEL SECURITY;
CREATE POLICY settings_tenant ON settings
  USING (current_setting('app.actor_role', true) = 'SYSTEM'
         OR tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
         OR tenant_id::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE ON settings TO inventory_svc;

COMMIT;
