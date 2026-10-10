-- Periodicidad de cobro del plan: MONTHLY (default) o YEARLY (~17% descuento)
-- ============================================
-- Los addons recurring se siguen cobrando mensual aunque el plan sea anual.
-- El período aplica al "compromiso" del plan, no a los addons.

-- 1) Crear el enum si no existe
DO $$ BEGIN
    CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2) Columna en clients con default MONTHLY (todos los clientes existentes
--    se quedan en cobro mensual; ningún cliente migra automáticamente).
ALTER TABLE "clients"
    ADD COLUMN IF NOT EXISTS "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY';
