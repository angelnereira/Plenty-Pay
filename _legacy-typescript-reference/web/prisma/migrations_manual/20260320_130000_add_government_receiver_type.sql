-- Add GOVERNMENT to ReceiverType enum
-- This is required for Panama government invoicing (tipoClienteFE = 03)
ALTER TYPE "ReceiverType" ADD VALUE IF NOT EXISTS 'GOVERNMENT' AFTER 'FINAL_CONSUMER';
