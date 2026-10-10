-- Add missing DGI document types to DocumentType enum
-- 02=Importación, 08=Zona Franca, 09=Reembolso, 10=Operación Extranjera
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'FACTURA_IMPORTACION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'FACTURA_ZONA_FRANCA';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'REEMBOLSO';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'FACTURA_EXTRANJERA';
