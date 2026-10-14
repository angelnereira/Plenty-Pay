-- PlentyPay - identity: revertir password_resets (F08.7)
BEGIN;

DROP TABLE IF EXISTS password_resets;
ALTER TABLE users DROP COLUMN IF EXISTS password_changed_at;

COMMIT;
