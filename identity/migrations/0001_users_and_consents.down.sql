-- PlentyPay - identity: revertir esquema inicial (F08.2)
-- Solo hacia atras para recuperacion; no se usa en el flujo normal.
BEGIN;

DROP FUNCTION IF EXISTS find_user_by_email(text);
DROP TABLE IF EXISTS consents;
DROP TABLE IF EXISTS users;

COMMIT;
