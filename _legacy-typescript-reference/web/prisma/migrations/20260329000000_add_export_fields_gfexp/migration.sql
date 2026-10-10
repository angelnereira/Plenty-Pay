-- AlterTable: Add export (gFExp) fields to invoices for Factura de Exportación (tipoDocumento 03)
ALTER TABLE "invoices" ADD COLUMN "exportIncoterm" TEXT;
ALTER TABLE "invoices" ADD COLUMN "exportCurrency" TEXT;
ALTER TABLE "invoices" ADD COLUMN "exportCurrencyDesc" TEXT;
ALTER TABLE "invoices" ADD COLUMN "exportExchangeRate" DECIMAL(11,4);
ALTER TABLE "invoices" ADD COLUMN "exportForeignAmount" DECIMAL(20,4);
ALTER TABLE "invoices" ADD COLUMN "exportPort" TEXT;
