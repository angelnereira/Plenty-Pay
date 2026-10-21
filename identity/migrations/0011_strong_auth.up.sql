-- PlentyPay - identity: confirmación fuerte y passkeys (ADR 0020, identity/SPEC.md §3)
-- Reglas: R25 (aserción verificada en identity), R26 (usuario del token), R28 (PIN en el servidor),
-- R29 (contador de firmas), R30 (sesión con passkey), R32 (retos y tokens persistidos; del token
-- solo el SHA-256; consumo atómico).

BEGIN;

CREATE TABLE IF NOT EXISTS passkeys (
  id              uuid PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id   bytea NOT NULL UNIQUE,
  public_key      bytea NOT NULL,
  sign_count      bigint NOT NULL,
  aaguid          uuid,
  transports      text[] NOT NULL DEFAULT '{}',
  backup_eligible boolean NOT NULL,
  backup_state    boolean NOT NULL,
  device_label    text NOT NULL CHECK (char_length(device_label) BETWEEN 1 AND 60),
  created_at      timestamptz NOT NULL,
  last_used_at    timestamptz,
  revoked_at      timestamptz
);
CREATE INDEX IF NOT EXISTS passkeys_user_idx ON passkeys (user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id            uuid PRIMARY KEY,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,   -- NULL: inicio de sesión sin correo
  purpose       text NOT NULL CHECK (purpose IN ('REGISTER', 'LOGIN', 'STEP_UP')),
  challenge     bytea NOT NULL,
  session_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  operation     text,
  amount_minor  bigint,
  currency      char(3),
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS webauthn_challenges_expires_idx ON webauthn_challenges (expires_at);

CREATE TABLE IF NOT EXISTS step_up_tokens (
  token_hash    bytea PRIMARY KEY,                               -- SHA-256 del token; nunca el token
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation     text NOT NULL,
  amount_minor  bigint NOT NULL,
  currency      text NOT NULL,
  method        text NOT NULL CHECK (method IN ('PASSKEY', 'PIN', 'PASSWORD')),
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS step_up_tokens_expires_idx ON step_up_tokens (expires_at);

CREATE TABLE IF NOT EXISTS step_up_pins (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pin_hash         text NOT NULL,
  failed_attempts  int NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  updated_at       timestamptz NOT NULL
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'password'
  CHECK (auth_method IN ('password', 'passkey'));

-- --- RLS: cada fila es de su usuario; plataforma para el consumo entre servicios ----------------
ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_up_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_up_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS passkeys_owner ON passkeys;
CREATE POLICY passkeys_owner ON passkeys
  USING (coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
         OR user_id::text = current_setting('app.user_id', true))
  WITH CHECK (coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
         OR user_id::text = current_setting('app.user_id', true));

-- Un reto sin usuario (inicio de sesión con llave residente) no contiene datos de nadie.
DROP POLICY IF EXISTS webauthn_challenges_owner ON webauthn_challenges;
CREATE POLICY webauthn_challenges_owner ON webauthn_challenges
  USING (coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
         OR user_id IS NULL
         OR user_id::text = current_setting('app.user_id', true))
  WITH CHECK (coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
         OR user_id IS NULL
         OR user_id::text = current_setting('app.user_id', true));

DROP POLICY IF EXISTS step_up_tokens_owner ON step_up_tokens;
CREATE POLICY step_up_tokens_owner ON step_up_tokens
  USING (coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
         OR user_id::text = current_setting('app.user_id', true))
  WITH CHECK (coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
         OR user_id::text = current_setting('app.user_id', true));

DROP POLICY IF EXISTS step_up_pins_owner ON step_up_pins;
CREATE POLICY step_up_pins_owner ON step_up_pins
  USING (coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
         OR user_id::text = current_setting('app.user_id', true))
  WITH CHECK (coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
         OR user_id::text = current_setting('app.user_id', true));

GRANT SELECT, INSERT, UPDATE ON identity.passkeys TO identity_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.webauthn_challenges TO identity_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.step_up_tokens TO identity_svc;
GRANT SELECT, INSERT, UPDATE ON identity.step_up_pins TO identity_svc;

COMMIT;
