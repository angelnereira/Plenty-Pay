-- PlentyPay - identity: revertir roles e invitaciones (F08.6)
BEGIN;

DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS roles;

COMMIT;
