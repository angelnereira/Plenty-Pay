-- PlentyPay - inventory: incidencias de recepción (F16.12, R10).
-- Lo dañado entra con RECEIPT y se aparta con BLOCK en la misma transacción; cada dañado y cada
-- faltante al «Cerrar con faltante» queda como incidencia inmutable. CLOSED_SHORT (6) es final.
BEGIN;

ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status BETWEEN 1 AND 6);
ALTER TABLE purchase_orders ADD COLUMN close_reason text NOT NULL DEFAULT '' CHECK (char_length(close_reason) <= 300);

ALTER TABLE purchase_order_lines ADD COLUMN damaged_milli bigint NOT NULL DEFAULT 0;
ALTER TABLE purchase_order_lines ADD CONSTRAINT purchase_order_lines_damaged_range
  CHECK (damaged_milli >= 0 AND damaged_milli <= received_milli);

CREATE TABLE purchase_receipt_issues (
  id                uuid PRIMARY KEY,
  tenant_id         uuid NOT NULL,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders (id),
  receipt_id        uuid REFERENCES purchase_receipts (id),     -- vacío en un faltante (cierre)
  product_id        uuid NOT NULL,
  kind              smallint NOT NULL CHECK (kind IN (1, 2)),   -- 1 DAMAGED, 2 SHORT
  qty_milli         bigint NOT NULL CHECK (qty_milli > 0),
  reason            text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 300),
  created_by        uuid,
  created_at        timestamptz NOT NULL
);
CREATE INDEX purchase_receipt_issues_by_order ON purchase_receipt_issues (tenant_id, purchase_order_id);
ALTER TABLE purchase_receipt_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipt_issues FORCE ROW LEVEL SECURITY;
CREATE POLICY purchase_receipt_issues_tenant ON purchase_receipt_issues
  USING (current_setting('app.actor_role', true) = 'SYSTEM'
         OR tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
         OR tenant_id::text = current_setting('app.tenant_id', true));
-- Inmutables: sin UPDATE ni DELETE.
GRANT SELECT, INSERT ON purchase_receipt_issues TO inventory_svc;

COMMIT;
