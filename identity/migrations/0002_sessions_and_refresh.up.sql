-- PlentyPay - identity: sesiones y refresh tokens rotativos (F08.3)
-- Reglas: R7 (access 15 min, refresh 30 dias), R8 (rotacion en cada uso; reuso
-- => revocar la familia + SessionRevoked + ReportSecurityEvent(TOKEN_REUSE)),
-- R9 (un access token de sesion revocada deja de validar).
-- El outbox es la tabla estandar de data-standards.md 6: los eventos se escriben
-- en la misma transaccion que el efecto; el relay los publica (F08.5).

BEGIN;

CREATE TABLE IF NOT EXISTS sessions (
  id              uuid PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  revoked_reason  text
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;

-- El refresh token se guarda solo como hash: si la base se filtra, los tokens
-- no sirven para autenticarse (sha256 del valor opaco recuperado del JWT).
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY,
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token_hash  bytea NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  used_at     timestamptz,          -- NULL = vigente; con fecha = ya rotado
  expires_at  timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_uidx ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_session_idx ON refresh_tokens (session_id);

-- Outbox estandar (data-standards.md 6, events-and-messaging.md 4).
CREATE TABLE IF NOT EXISTS outbox (
  id            uuid PRIMARY KEY,
  event_type    text NOT NULL,
  aggregate_id  uuid NOT NULL,
  tenant_id     uuid,
  payload       bytea NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);

CREATE INDEX IF NOT EXISTS outbox_pending ON outbox (created_at) WHERE published_at IS NULL;

-- --- RLS ---------------------------------------------------------------------
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessions_tenencia ON sessions;
CREATE POLICY sessions_tenencia ON sessions
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR user_id::text = current_setting('app.user_id', true)
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR user_id::text = current_setting('app.user_id', true)
  );

-- Los refresh tokens se alcanzan solo via la sesion del propio usuario.
DROP POLICY IF EXISTS refresh_tokens_tenencia ON refresh_tokens;
CREATE POLICY refresh_tokens_tenencia ON refresh_tokens
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = refresh_tokens.session_id
        AND (
          s.user_id::text = current_setting('app.user_id', true)
          OR coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
        )
    )
  );

DROP POLICY IF EXISTS outbox_tenencia ON outbox;
CREATE POLICY outbox_tenencia ON outbox
  USING (coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN');

-- Permisos DML para el rol de servicio (el DDL es de migrator_identity).
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.sessions TO identity_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.refresh_tokens TO identity_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.outbox TO identity_svc;

COMMIT;
