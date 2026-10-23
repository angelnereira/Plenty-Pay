-- PlentyPay - pos: configuración de caja por comercio (F17.11, R14).
-- Sin fila rigen los valores por defecto del dominio. `version` da la concurrencia optimista.
BEGIN;

CREATE TABLE pos_settings (
  tenant_id  uuid PRIMARY KEY,
  settings   jsonb NOT NULL,
  version    int NOT NULL CHECK (version >= 1),
  updated_by uuid,
  updated_at timestamptz NOT NULL
);
ALTER TABLE pos_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY pos_settings_tenant ON pos_settings
  USING (current_setting('app.actor_role', true) = 'SYSTEM'
         OR tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
         OR tenant_id::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE ON pos_settings TO pos_svc;

COMMIT;
