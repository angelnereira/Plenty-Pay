-- PlentyPay - identity: revertir login_attempts (F08.4)
BEGIN;

DROP TABLE IF EXISTS login_attempts;

COMMIT;
