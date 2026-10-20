-- PlentyPay - identity: claves de idempotencia de las mutaciones reintentables
-- (grpc-conventions.md §3, data-standards.md §6, AGENTS.md §2.8).
BEGIN;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  tenant_id     uuid        NOT NULL,      -- '00000000-0000-0000-0000-000000000000' si no hay tenant
  rpc           text        NOT NULL,
  key           text        NOT NULL,
  request_hash  bytea       NOT NULL,      -- SHA-256 del request canónico sin la clave (proto determinista)
  response      bytea,                     -- google.protobuf.Any serializado; NULL mientras corre
  resource_id   uuid,
  state         text        NOT NULL CHECK (state IN ('IN_PROGRESS','DONE')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, rpc, key)
);

-- Purga de > 72 h (data-standards.md §6).
CREATE INDEX IF NOT EXISTS idempotency_keys_created_idx ON idempotency_keys (created_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idempotency_keys_tenencia ON idempotency_keys;
CREATE POLICY idempotency_keys_tenencia ON idempotency_keys
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON identity.idempotency_keys TO identity_svc;

COMMIT;
