-- PlentyPay - identity: intentos fallidos de login y bloqueo progresivo (F08.4)
-- Regla R5 del SPEC: 5 fallos -> 1 min, 10 -> 15 min, 20 -> 24 h + notificacion;
-- un login exitoso reinicia la cuenta. Politica propia de PlentyPay (N-STD-37
-- fija como maximo 100 intentos antes de deshabilitar: estos umbrales son mas
-- estrictos, no valores legales).
--
-- Cada fallo se reporta a `security` (LOGIN_FAILED), que ademas bloquea por IP
-- con su propio umbral (F05.5).

BEGIN;

CREATE TABLE IF NOT EXISTS login_attempts (
  user_id               uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_failure_at       timestamptz,
  blocked_until         timestamptz
);

COMMENT ON TABLE login_attempts IS 'Contadores de fallo consecutivos y bloqueo vigente (SPEC R5)';

-- --- RLS ---------------------------------------------------------------------
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS login_attempts_tenencia ON login_attempts;
CREATE POLICY login_attempts_tenencia ON login_attempts
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR user_id::text = current_setting('app.user_id', true)
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR user_id::text = current_setting('app.user_id', true)
  );

-- Permisos DML para el rol de servicio (el DDL es de migrator_identity).
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.login_attempts TO identity_svc;

COMMIT;
