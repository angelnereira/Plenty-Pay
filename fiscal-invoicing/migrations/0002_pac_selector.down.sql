-- PlentyPay - fiscal-invoicing: revertir 0002 (solo desarrollo).
BEGIN;
ALTER TABLE taxpayers DROP CONSTRAINT taxpayers_tax_id_type_check;
ALTER TABLE taxpayers ADD CONSTRAINT taxpayers_tax_id_type_check
  CHECK (tax_id_type IN ('RUC_JURIDICO', 'RUC_NATURAL', 'CEDULA', 'PASAPORTE', 'EXTRANJERO'));
ALTER TABLE taxpayers DROP COLUMN location_code, DROP COLUMN address;
ALTER TABLE invoices DROP COLUMN branch_code, DROP COLUMN pac_provider;
COMMIT;
