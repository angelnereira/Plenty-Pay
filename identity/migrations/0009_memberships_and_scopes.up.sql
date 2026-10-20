-- PlentyPay - identity: membresias, alcances territoriales, cargos y ciclo de vida de roles/usuarios (ADR 0018, R22-R24)
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';
UPDATE users SET status = 'DEACTIVATED' WHERE active = false AND status = 'ACTIVE';

ALTER TABLE roles ADD COLUMN IF NOT EXISTS template_key text NOT NULL DEFAULT '';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS template_version int NOT NULL DEFAULT 1;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'TENANT';
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS branch_ids text[] NOT NULL DEFAULT '{}';
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS job_title text NOT NULL DEFAULT '';
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE TABLE IF NOT EXISTS memberships (
  id         uuid PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  base_role  text NOT NULL DEFAULT 'BUSINESS_STAFF' CHECK (base_role IN ('BUSINESS_OWNER','BUSINESS_STAFF')),
  role_id    uuid REFERENCES roles(id) ON DELETE SET NULL,
  scope      text NOT NULL DEFAULT 'TENANT' CHECK (scope IN ('TENANT','BRANCHES')),
  job_title  text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','DEACTIVATED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS memberships_tenant_idx ON memberships (tenant_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id);
-- MVP (domain-model.md §3.2, Q-31): una sola membresia activa por persona.
CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_active_uidx ON memberships (user_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS membership_branches (
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  branch_id     uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (membership_id, branch_id)
);

-- Backfill de miembros existentes desde users y user_roles (solo con negocio existente).
INSERT INTO memberships (id, user_id, tenant_id, base_role, role_id, scope, job_title, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  u.tenant_id,
  CASE WHEN u.role = 'BUSINESS_OWNER' THEN 'BUSINESS_OWNER' ELSE 'BUSINESS_STAFF' END,
  (SELECT ur.role_id FROM user_roles ur WHERE ur.user_id = u.id LIMIT 1),
  'TENANT',
  '',
  CASE WHEN u.active THEN 'ACTIVE' ELSE 'DEACTIVATED' END,
  u.created_at,
  u.updated_at
FROM users u
JOIN tenants t ON t.id = u.tenant_id  -- un tenant_id sin negocio (datos huérfanos) no recibe membresía
WHERE u.role IN ('BUSINESS_OWNER', 'BUSINESS_STAFF')
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Actualiza find_user_by_email para que devuelva el esquema actualizado de users.
DROP FUNCTION IF EXISTS find_user_by_email(text);
CREATE OR REPLACE FUNCTION find_user_by_email(p_email_normalized text)
RETURNS SETOF users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = identity, pg_temp
AS $$
  SELECT * FROM identity.users WHERE email_normalized = p_email_normalized;
$$;

ALTER FUNCTION find_user_by_email(text) OWNER TO migrator_identity;
REVOKE ALL ON FUNCTION find_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_user_by_email(text) TO identity_svc;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memberships_tenencia ON memberships;
CREATE POLICY memberships_tenencia ON memberships
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '__sin_tenant__')
    OR user_id::text = current_setting('app.user_id', true)
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '__sin_tenant__')
  );

DROP POLICY IF EXISTS membership_branches_tenencia ON membership_branches;
CREATE POLICY membership_branches_tenencia ON membership_branches
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = membership_branches.membership_id
        AND (
          m.tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '__sin_tenant__')
          OR m.user_id::text = current_setting('app.user_id', true)
        )
    )
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = membership_branches.membership_id
        AND m.tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '__sin_tenant__')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON identity.memberships TO identity_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.membership_branches TO identity_svc;

COMMIT;
