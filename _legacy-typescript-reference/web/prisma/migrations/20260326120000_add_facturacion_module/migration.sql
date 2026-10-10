-- Add facturacionEnabled module flag to clients table.
-- Facturación is now an optional module — accounts can be active with 0 modules.
-- Existing clients who had invoicing functionality get facturacionEnabled = true.
ALTER TABLE "clients" ADD COLUMN "facturacionEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing active clients that already had invoicing capability:
-- Any client that has approvalStatus = 'APPROVED' or has other modules enabled
-- was presumably already using facturación, so enable it for them.
UPDATE "clients"
SET "facturacionEnabled" = true
WHERE "approvalStatus" = 'APPROVED'
   OR "inventoryEnabled" = true
   OR "posEnabled" = true
   OR "paydayEnabled" = true
   OR "logisticsEnabled" = true;
