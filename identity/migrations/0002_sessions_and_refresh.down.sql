-- PlentyPay - identity: revertir sesiones y refresh tokens (F08.2/F08.3)
BEGIN;

DROP TABLE IF EXISTS outbox;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS sessions;

COMMIT;
