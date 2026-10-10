-- AlterTable: add contingency fields to Invoice
-- tipoEmisionOverride: persists the emission type determined at offline creation time
-- fechaInicioContingencia: DGI field B04 — when contingency started (required if 02/04)
-- motivoContingencia: DGI field B05 — reason text 15-250 chars (required if 02/04)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tipoEmisionOverride" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "fechaInicioContingencia" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "motivoContingencia" TEXT;
