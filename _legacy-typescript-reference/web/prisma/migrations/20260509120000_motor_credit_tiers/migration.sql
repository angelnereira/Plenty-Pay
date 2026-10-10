-- Tiers de pricing del Módulo de Créditos
-- ============================================
--   TIER_1: hasta 50  clientes con crédito  — $49.99 / mes
--   TIER_2: hasta 100 clientes con crédito  — $74.99 / mes
--   TIER_3: hasta 250 clientes con crédito  — $99.99 / mes
--
-- También revierte el "grandfather" de 20260509000000_add_creditos_enabled:
-- todos los tenants existentes quedan con creditosEnabled = false y
-- motorCreditTier = NULL. SUPER_ADMIN debe activarlos explícitamente
-- eligiendo un tier en el panel de administración. Los datos del Motor
-- (entidades, ledger, lealtad) NO se borran: solo se oculta el módulo.

CREATE TYPE "MotorCreditTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');

ALTER TABLE "clients"
    ADD COLUMN IF NOT EXISTS "motorCreditTier" "MotorCreditTier";

-- Apaga creditosEnabled para todos los tenants y voltea el default a false.
-- Defensivo: la migración 20260509000000_add_creditos_enabled creó la columna
-- con nombre snake_case ("creditos_enabled"), inconsistente con el resto de
-- la tabla "clients" que usa camelCase ("isActive", "facturacionEnabled",
-- "hkaEnabled", etc). Tolera ambos nombres por si la BD ya migró con el
-- nombre snake_case y el schema fue ajustado a través de @map después.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'clients'
          AND column_name  = 'creditos_enabled'
    ) THEN
        EXECUTE 'UPDATE "clients" SET "creditos_enabled" = false';
        EXECUTE 'ALTER TABLE "clients" ALTER COLUMN "creditos_enabled" SET DEFAULT false';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'clients'
          AND column_name  = 'creditosEnabled'
    ) THEN
        EXECUTE 'UPDATE "clients" SET "creditosEnabled" = false';
        EXECUTE 'ALTER TABLE "clients" ALTER COLUMN "creditosEnabled" SET DEFAULT false';
    ELSE
        RAISE NOTICE 'Ninguna columna creditosEnabled/creditos_enabled encontrada en clients; saltando flip';
    END IF;
END $$;
