-- Migration: Add POS stations limit, POS sessions table, and migrate Emprendedor plans
-- Date: 2026-01-16
-- Description: 
--   1. Add maxPosStations column to clients table
--   2. Create pos_sessions table for tracking concurrent POS usage
--   3. Migrate all EMPRENDEDOR plans to CRECIMIENTO
--   4. Set appropriate limits based on plan type

-- ============================================
-- Step 1: Add maxPosStations column if it doesn't exist
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'maxPosStations'
    ) THEN
        ALTER TABLE clients ADD COLUMN "maxPosStations" INTEGER NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added maxPosStations column to clients table';
    ELSE
        RAISE NOTICE 'maxPosStations column already exists';
    END IF;
END $$;

-- ============================================
-- Step 2: Create pos_sessions table
-- ============================================
CREATE TABLE IF NOT EXISTS pos_sessions (
    id TEXT PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stationName" TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    CONSTRAINT fk_pos_sessions_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for pos_sessions
CREATE INDEX IF NOT EXISTS idx_pos_sessions_client_status ON pos_sessions ("clientId", status);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_user ON pos_sessions ("userId");
CREATE INDEX IF NOT EXISTS idx_pos_sessions_activity ON pos_sessions ("lastActivity");

-- ============================================
-- Step 3: Migrate all EMPRENDEDOR plans to CRECIMIENTO
-- ============================================
UPDATE clients 
SET "planType" = 'CRECIMIENTO' 
WHERE "planType" = 'EMPRENDEDOR';

-- ============================================
-- Step 4: Set appropriate limits based on plan type
-- ============================================

-- CRECIMIENTO: 3 users, 1 POS station (default for new plan)
UPDATE clients 
SET "maxUsers" = GREATEST("maxUsers", 3), 
    "maxPosStations" = GREATEST("maxPosStations", 1)
WHERE "planType" = 'CRECIMIENTO';

-- PROFESIONAL: 10 users, 3 POS stations
UPDATE clients 
SET "maxUsers" = GREATEST("maxUsers", 10), 
    "maxPosStations" = GREATEST("maxPosStations", 3)
WHERE "planType" = 'PROFESIONAL';

-- EMPRESARIAL: 50 users, 5 POS stations
UPDATE clients 
SET "maxUsers" = GREATEST("maxUsers", 50), 
    "maxPosStations" = GREATEST("maxPosStations", 5)
WHERE "planType" = 'EMPRESARIAL';

-- ENTERPRISE: 100 users, 50 POS stations (can be customized further)
UPDATE clients 
SET "maxUsers" = GREATEST("maxUsers", 100), 
    "maxPosStations" = GREATEST("maxPosStations", 50)
WHERE "planType" = 'ENTERPRISE';

-- ============================================
-- Verification queries (run to check results)
-- ============================================
-- SELECT id, name, "planType", "maxUsers", "maxPosStations" FROM clients;
-- SELECT * FROM pos_sessions;

-- ============================================
-- Plan Pricing Reference (for documentation):
-- ============================================
-- CRECIMIENTO:  $49.99/mo  - 3 users, 1 POS station, 100 invoices/mo
-- PROFESIONAL:  $99.99/mo  - 10 users, 3 POS stations, 500 invoices/mo  
-- EMPRESARIAL:  $199.99/mo - 50 users, 5 POS stations, unlimited invoices
-- ENTERPRISE:   Custom     - 100+ users, 50+ POS stations, custom features
--
-- Extra users: +$10.00/user/month
-- Extra POS stations: +$15.00/station/month
-- Inventory module: +$29.00/month
-- POS module: +$39.00/month
