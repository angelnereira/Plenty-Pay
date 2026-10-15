-- PlentyPay - identity: revertir tenants (F08.5)
BEGIN;

DROP TABLE IF EXISTS tenant_kyb_documents;
DROP TABLE IF EXISTS tenants;

COMMIT;
