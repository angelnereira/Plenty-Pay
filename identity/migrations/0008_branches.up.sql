-- PlentyPay - identity: sucursales del comercio con codigo fiscal DGI (ADR 0018, R24)
BEGIN;

CREATE TABLE IF NOT EXISTS branches (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code               text NOT NULL,                      -- 4 digitos DGI ("0000" = Casa Matriz)
  name               text NOT NULL,
  address            text NOT NULL DEFAULT '',
  latitude_e6        int NOT NULL DEFAULT 0,
  longitude_e6       int NOT NULL DEFAULT 0,
  opening_hours_json text NOT NULL DEFAULT '{}',
  active             boolean NOT NULL DEFAULT true,
  version            int NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS branches_tenant_code_uidx ON branches (tenant_id, code);
CREATE INDEX IF NOT EXISTS branches_tenant_active_idx ON branches (tenant_id) WHERE active = true;

-- Backfill: todo comercio existente sin sucursal recibe su Casa Matriz "0000".
INSERT INTO branches (id, tenant_id, code, name, active, version, created_at, updated_at)
SELECT gen_random_uuid(), t.id, '0000', 'Casa Matriz', true, 1, now(), now()
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.tenant_id = t.id)
ON CONFLICT (tenant_id, code) DO NOTHING;

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branches_tenencia ON branches;
CREATE POLICY branches_tenencia ON branches
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '__sin_tenant__')
    OR EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = branches.tenant_id
        AND t.owner_id::text = current_setting('app.user_id', true)
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = current_setting('app.user_id', true)
        AND u.tenant_id = branches.tenant_id
    )
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '__sin_tenant__')
    OR EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = branches.tenant_id
        AND t.owner_id::text = current_setting('app.user_id', true)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON identity.branches TO identity_svc;

COMMIT;
