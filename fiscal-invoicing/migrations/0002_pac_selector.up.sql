-- PlentyPay - fiscal-invoicing: PAC seleccionable (ADR 0022). Cada documento recuerda con qué
-- adaptador y en qué sucursal se emitió (un cambio de perfil no altera lo ya numerado); el receptor
-- lleva dirección y código de ubicación de la DGI, y se admite el tipo GOBIERNO.
BEGIN;

ALTER TABLE invoices ADD COLUMN pac_provider text NOT NULL DEFAULT 'simulator';
ALTER TABLE invoices ADD COLUMN branch_code text NOT NULL DEFAULT '0000' CHECK (branch_code ~ '^[0-9]{4}$');

ALTER TABLE taxpayers ADD COLUMN address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 100);
ALTER TABLE taxpayers ADD COLUMN location_code text NOT NULL DEFAULT ''
  CHECK (location_code = '' OR location_code ~ '^[0-9]{1,2}-[0-9]{1,2}-[0-9]{1,2}$');
ALTER TABLE taxpayers DROP CONSTRAINT taxpayers_tax_id_type_check;
ALTER TABLE taxpayers ADD CONSTRAINT taxpayers_tax_id_type_check
  CHECK (tax_id_type IN ('RUC_JURIDICO', 'RUC_NATURAL', 'CEDULA', 'PASAPORTE', 'EXTRANJERO', 'GOBIERNO'));

COMMIT;
