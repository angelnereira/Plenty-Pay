-- PlentyPay - identity: tenants (negocios) (F08.5)
-- Reglas: R11 (PENDING_REVIEW no cobra ni publica), R17 (RUC + DV unicos),
-- dominio-model.md 3.3 (transiciones: PENDING_REVIEW -> ACTIVE | REJECTED;
-- ACTIVE <-> SUSPENDED; solo PLATFORM_ADMIN cambia estados).

BEGIN;

CREATE TABLE IF NOT EXISTS tenants (
  id           uuid PRIMARY KEY,
  legal_name   text NOT NULL,
  trade_name   text NOT NULL DEFAULT '',
  tax_id       text NOT NULL,                -- RUC
  dv           text NOT NULL DEFAULT '',     -- digito verificador (R17)
  status       text NOT NULL DEFAULT 'PENDING_REVIEW',
  country      text NOT NULL DEFAULT 'PA',
  review_notes text NOT NULL DEFAULT '',
  owner_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- R17: el RUC es unico (sin distinguir mayusculas ni espacios).
CREATE UNIQUE INDEX IF NOT EXISTS tenants_tax_id_uidx ON tenants (upper(replace(tax_id, ' ', '')));
-- dominio-model.md 3.2: como maximo un tenant por dueno (MVP).
CREATE UNIQUE INDEX IF NOT EXISTS tenants_owner_uidx ON tenants (owner_id);
CREATE INDEX IF NOT EXISTS tenants_status_idx ON tenants (status);

-- Los documentos KYB viven en object-storage; aqui solo las claves (SPEC §4 R1).
CREATE TABLE IF NOT EXISTS tenant_kyb_documents (
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  object_key   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, object_key)
);

-- --- RLS ---------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_kyb_documents ENABLE ROW LEVEL SECURITY;

-- Un miembro ve su tenant; la plataforma ve todos (consola de revision).
DROP POLICY IF EXISTS tenants_tenencia ON tenants;
CREATE POLICY tenants_tenencia ON tenants
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR owner_id::text = current_setting('app.user_id', true)
    OR id::text = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR owner_id::text = current_setting('app.user_id', true)
  );

DROP POLICY IF EXISTS tenant_kyb_documents_tenencia ON tenant_kyb_documents;
CREATE POLICY tenant_kyb_documents_tenencia ON tenant_kyb_documents
  USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = tenant_kyb_documents.tenant_id
        AND (
          t.owner_id::text = current_setting('app.user_id', true)
          OR t.id::text = current_setting('app.tenant_id', true)
          OR coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
        )
    )
  );

-- Permisos DML para el rol de servicio (el DDL es de migrator_identity).
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.tenants TO identity_svc;
GRANT SELECT, INSERT, DELETE ON identity.tenant_kyb_documents TO identity_svc;

COMMIT;
