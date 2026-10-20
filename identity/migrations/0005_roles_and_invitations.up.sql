-- PlentyPay - identity: roles personalizados e invitaciones de staff (F08.6)
-- Reglas: R12 (roles personalizados: solo permisos del catalogo, nunca platform:*),
-- R13 (el dueno no se desactiva ni pierde admin:* mientras sea el unico dueno),
-- SPEC §4 (invitacion que vence a los 7 dias).

BEGIN;

-- Roles: los de sistema (presets) tienen tenant_id NULL y system=true.
CREATE TABLE IF NOT EXISTS roles (
  id          uuid PRIMARY KEY,
  tenant_id   uuid,                          -- NULL = preset de sistema
  name        text NOT NULL,
  system      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_tenant_name_uidx ON roles (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Permisos de cada rol (R12: validados en el dominio antes de insertar).
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission  text NOT NULL,
  PRIMARY KEY (role_id, permission)
);

-- Rol asignado a un usuario (un rol activo por usuario).
CREATE TABLE IF NOT EXISTS user_roles (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- Invitaciones de staff: expiran a los 7 dias (SPEC par. 4).
CREATE TABLE IF NOT EXISTS invitations (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  email       text NOT NULL,
  full_name   text NOT NULL DEFAULT '',
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  token_hash  bytea NOT NULL,
  invited_by  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_uidx ON invitations (token_hash);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations (lower(email), tenant_id);

-- Presets de sistema (security-standards.md par. 3.2). Idempotente.
INSERT INTO roles (id, tenant_id, name, system) VALUES
  ('00000000-0000-0000-0000-00000000ce01', NULL, 'cashier', true),
  ('00000000-0000-0000-0000-00000000ce02', NULL, 'stock_keeper', true),
  ('00000000-0000-0000-0000-00000000ce03', NULL, 'manager', true),
  ('00000000-0000-0000-0000-00000000ce04', NULL, 'accountant', true),
  ('00000000-0000-0000-0000-00000000ce05', NULL, 'courier', true),
  ('00000000-0000-0000-0000-00000000ce06', NULL, 'viewer', true),
  ('00000000-0000-0000-0000-00000000ce07', NULL, 'supervisor', true)
ON CONFLICT DO NOTHING;

-- Permisos de cada preset: coinciden con auth.PermissionsFor (fuente unica).
INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p FROM roles r
CROSS JOIN LATERAL unnest(ARRAY[
  'pos:sell', 'pos:session:manage', 'payments:charge', 'payments:read', 'catalog:read',
  'inventory:read', 'fiscal:issue', 'payroll:attendance:record', 'payroll:payslip:read:self'
]) AS p
WHERE r.id = '00000000-0000-0000-0000-00000000ce01'::uuid
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p FROM roles r
CROSS JOIN LATERAL unnest(ARRAY[
  'inventory:read', 'inventory:adjust', 'inventory:purchase:manage', 'inventory:receive',
  'catalog:read', 'payroll:attendance:record', 'payroll:payslip:read:self'
]) AS p
WHERE r.id = '00000000-0000-0000-0000-00000000ce02'::uuid
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p FROM roles r
CROSS JOIN LATERAL unnest(ARRAY[
  'catalog:read', 'catalog:write', 'catalog:import', 'catalog:listing:manage',
  'inventory:read', 'inventory:adjust', 'inventory:purchase:manage', 'inventory:receive',
  'pos:sell', 'pos:void', 'pos:refund', 'pos:session:manage', 'pos:settings:manage', 'pos:discount:apply',
  'orders:read', 'orders:manage', 'logistics:read', 'logistics:manage', 'logistics:deliver', 'logistics:geofence:manage',
  'payments:charge', 'payments:read', 'payments:refund',
  'settlement:read', 'fiscal:read', 'fiscal:issue', 'fiscal:note:issue',
  'analytics:read', 'payroll:attendance:read', 'payroll:employee:read', 'payroll:attendance:record', 'payroll:payslip:read:self'
]) AS p
WHERE r.id = '00000000-0000-0000-0000-00000000ce03'::uuid
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p FROM roles r
CROSS JOIN LATERAL unnest(ARRAY[
  'fiscal:read', 'fiscal:issue', 'fiscal:note:issue', 'settlement:read', 'settlement:reconcile',
  'payments:read', 'analytics:read', 'analytics:export', 'payroll:run:create',
  'payroll:attendance:record', 'payroll:payslip:read:self'
]) AS p
WHERE r.id = '00000000-0000-0000-0000-00000000ce04'::uuid
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p FROM roles r
CROSS JOIN LATERAL unnest(ARRAY[
  'logistics:deliver', 'logistics:read', 'payroll:attendance:record', 'payroll:payslip:read:self'
]) AS p
WHERE r.id = '00000000-0000-0000-0000-00000000ce05'::uuid
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p FROM roles r
CROSS JOIN LATERAL unnest(ARRAY[
  'catalog:read', 'inventory:read', 'orders:read', 'logistics:read', 'payments:read',
  'settlement:read', 'fiscal:read', 'payroll:attendance:read', 'analytics:read'
]) AS p
WHERE r.id = '00000000-0000-0000-0000-00000000ce06'::uuid
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p FROM roles r
CROSS JOIN LATERAL unnest(ARRAY[
  'pos:void', 'pos:refund', 'pos:discount:apply', 'pos:session:manage',
  'payroll:attendance:read', 'payroll:attendance:record', 'payroll:payslip:read:self'
]) AS p
WHERE r.id = '00000000-0000-0000-0000-00000000ce07'::uuid
ON CONFLICT DO NOTHING;

-- Desactivacion de usuarios (R13). Aditivo: los existentes quedan activos.
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- --- RLS ---------------------------------------------------------------------
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Los roles de sistema (tenant NULL) los ve cualquiera; los del tenant, su gente.
DROP POLICY IF EXISTS roles_tenencia ON roles;
CREATE POLICY roles_tenencia ON roles
  USING (
    tenant_id IS NULL
    OR coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = current_setting('app.tenant_id', true)
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = current_setting('app.user_id', true) AND u.tenant_id::text = roles.tenant_id::text
    )
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

DROP POLICY IF EXISTS role_permissions_tenencia ON role_permissions;
CREATE POLICY role_permissions_tenencia ON role_permissions
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND (
          r.tenant_id IS NULL
          OR coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
          OR r.tenant_id::text = current_setting('app.tenant_id', true)
        )
    )
  );

DROP POLICY IF EXISTS user_roles_tenencia ON user_roles;
CREATE POLICY user_roles_tenencia ON user_roles
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR user_id::text = current_setting('app.user_id', true)
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_roles.user_id
        AND (
          u.tenant_id::text = current_setting('app.tenant_id', true)
          OR u.id::text = current_setting('app.user_id', true)
        )
    )
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_roles.user_id AND u.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

DROP POLICY IF EXISTS invitations_tenencia ON invitations;
CREATE POLICY invitations_tenencia ON invitations
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Permisos DML para el rol de servicio (el DDL es de migrator_identity).
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.roles TO identity_svc;
GRANT SELECT, INSERT, DELETE ON identity.role_permissions TO identity_svc;
GRANT SELECT, INSERT, DELETE ON identity.user_roles TO identity_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.invitations TO identity_svc;

COMMIT;
