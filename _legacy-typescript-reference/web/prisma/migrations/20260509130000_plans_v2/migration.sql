-- Planes v2: START / BUSINESS / ENTERPRISE
-- ============================================
-- Reemplaza el modelo viejo (CRECIMIENTO/PROFESIONAL/EMPRESARIAL/ENTERPRISE
-- con "facturas ilimitadas") por 3 planes alineados al mercado panameño y
-- al costo real de folios HKA.
--
-- Migración:
--   1) Nuevas columnas en clients (maxBranches, extraBranches, apiAccessEnabled
--      y los timestamps del soft-cap de facturas).
--   2) Nuevas columnas en upgrade_requests (requestedCreditTier, requestedApiAccess,
--      requestedExtraBranches).
--   3) UPDATE planType: CRECIMIENTO→START, PROFESIONAL→BUSINESS, EMPRESARIAL→BUSINESS,
--      ENTERPRISE→ENTERPRISE. Default flip a 'START'.
--   4) Reajuste de límites a los del nuevo plan (solo si el cliente está al
--      default antiguo — no toca clientes con upgrades pagados de límites).
--   5) ENTERPRISE enciende los flags de los addons incluidos (logistics, apiAccess).

-- ============================================
-- 1) Columnas nuevas en clients
-- ============================================

ALTER TABLE "clients"
    ADD COLUMN IF NOT EXISTS "maxBranches"   INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "extraBranches" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "apiAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "lastInvoiceCapWarning80At"  TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lastInvoiceCapWarning100At" TIMESTAMP(3);

-- ============================================
-- 2) Columnas nuevas en upgrade_requests
-- ============================================

ALTER TABLE "upgrade_requests"
    ADD COLUMN IF NOT EXISTS "requestedCreditTier"    "MotorCreditTier",
    ADD COLUMN IF NOT EXISTS "requestedApiAccess"     BOOLEAN,
    ADD COLUMN IF NOT EXISTS "requestedExtraBranches" INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- 3) Migrar planType a los planes nuevos + flip default
-- ============================================

UPDATE "clients"
SET "planType" = CASE
    WHEN "planType" = 'CRECIMIENTO' THEN 'START'
    WHEN "planType" = 'PROFESIONAL' THEN 'BUSINESS'
    WHEN "planType" = 'EMPRESARIAL' THEN 'BUSINESS'
    WHEN "planType" = 'ENTERPRISE'  THEN 'ENTERPRISE'
    ELSE 'START'
END
WHERE "planType" IN ('CRECIMIENTO', 'PROFESIONAL', 'EMPRESARIAL', 'ENTERPRISE')
   OR "planType" NOT IN ('START', 'BUSINESS', 'ENTERPRISE');

ALTER TABLE "clients" ALTER COLUMN "planType" SET DEFAULT 'START';

-- ============================================
-- 4) Reajuste de límites al nuevo plan — solo si están al default antiguo
-- ============================================
-- Plan viejo CRECIMIENTO usaba 3/1, BUSINESS antiguo 10/3, EMPRESARIAL 50/10.
-- Para no pisar upgrades pagados, solo bajamos cuando el cliente esté en el
-- default exacto del plan viejo correspondiente y no haya pagado por más.

UPDATE "clients" SET "maxUsers" = 3,   "maxPosStations" = 1
    WHERE "planType" = 'START'      AND "maxUsers" <= 3   AND "maxPosStations" <= 1;

UPDATE "clients" SET "maxUsers" = 10,  "maxPosStations" = 3
    WHERE "planType" = 'BUSINESS'   AND "maxUsers" <= 10  AND "maxPosStations" <= 3;

UPDATE "clients" SET "maxUsers" = 100, "maxPosStations" = 5, "maxBranches" = 999
    WHERE "planType" = 'ENTERPRISE' AND "maxUsers" <= 100 AND "maxPosStations" <= 5;

-- ============================================
-- 5) ENTERPRISE: encender addons incluidos por plan
-- ============================================

UPDATE "clients"
SET "apiAccessEnabled" = true,
    "logisticsEnabled" = true
WHERE "planType" = 'ENTERPRISE';
