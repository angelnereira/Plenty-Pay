-- PlentyPay - identity: revertir confirmación fuerte y passkeys (ADR 0020)
BEGIN;

ALTER TABLE sessions DROP COLUMN IF EXISTS auth_method;
DROP TABLE IF EXISTS step_up_pins;
DROP TABLE IF EXISTS step_up_tokens;
DROP TABLE IF EXISTS webauthn_challenges;
DROP TABLE IF EXISTS passkeys;

COMMIT;
