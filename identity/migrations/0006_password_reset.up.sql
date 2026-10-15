-- PlentyPay - identity: recuperacion y cambio de contrasena (F08.7)
-- Reglas: R16 (cambiar la contrasena o hacer reset revoca las sesiones),
-- R14 (el cambio exige step-up; el token se consume como los de sesion),
-- SPEC §4 (reset: siempre ok, token de 30 min y un solo uso).

BEGIN;

-- Tokens de reset: se guardan hasheados y se consumen atomicamente.
CREATE TABLE IF NOT EXISTS password_resets (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  bytea NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_resets_token_uidx ON password_resets (token_hash);

-- Marca de cambio de contrasena: un access token emitido ANTES de ella deja de
-- validar (R16 tambien alcanza a los tokens vigentes, no solo a los refresh).
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

-- --- RLS ---------------------------------------------------------------------
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS password_resets_tenencia ON password_resets;
CREATE POLICY password_resets_tenencia ON password_resets
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR user_id::text = current_setting('app.user_id', true)
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR user_id::text = current_setting('app.user_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON identity.password_resets TO identity_svc;

COMMIT;
