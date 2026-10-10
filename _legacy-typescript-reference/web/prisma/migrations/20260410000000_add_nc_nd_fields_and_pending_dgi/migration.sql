-- Migration: add NC/ND fields, NoteSubtype enum, cufeLocal, dgiNotificationCode, and PENDING_DGI status
-- These fields were added to the schema without a corresponding migration.

-- 1. Create NoteSubtype enum
DO $$ BEGIN
  CREATE TYPE "NoteSubtype" AS ENUM ('REFERENCED', 'GENERIC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add PENDING_DGI to InvoiceStatus enum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PENDING_DGI';

-- 3. Add cufeLocal column (CUFE pre-generado localmente)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cufeLocal" TEXT;

-- 4. Add NC/ND fields
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "noteSubtype" "NoteSubtype";
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "referencedInvoiceId" TEXT;

-- 5. Add referenced emitter fields (gDFRef / B60)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "refEmitterType" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "refEmitterRuc" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "refEmitterDv" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "refEmitterName" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "refDocumentDate" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "refDocumentType" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "refCufe" TEXT;

-- 6. Add DGI notification code
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "dgiNotificationCode" TEXT;

-- 7. Add foreign key constraint for self-relation (NC/ND -> original invoice)
DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_referencedInvoiceId_fkey"
    FOREIGN KEY ("referencedInvoiceId")
    REFERENCES "invoices"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 8. Add index on referencedInvoiceId
CREATE INDEX IF NOT EXISTS "invoices_referencedInvoiceId_idx" ON "invoices"("referencedInvoiceId");
