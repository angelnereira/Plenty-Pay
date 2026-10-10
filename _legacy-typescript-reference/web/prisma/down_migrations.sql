-- ============================================
-- PLENTYPAY — CENTRALIZED ROLLBACK SCRIPT (DOWN)
-- ============================================
-- Este script revierte los cambios realizados en las migraciones de Mayo 2026.
-- Ejecutar con precaución: eliminará datos de BI y Motor.
-- ============================================

-- 1. Revertir BI Pro (Dashboards, Widgets, Segments, Campaigns, Forecasts)
DROP TABLE IF EXISTS "bi_forecasts" CASCADE;
DROP TABLE IF EXISTS "bi_campaigns" CASCADE;
DROP TABLE IF EXISTS "bi_segments" CASCADE;
DROP TABLE IF EXISTS "bi_widgets" CASCADE;
DROP TABLE IF EXISTS "bi_dashboards" CASCADE;
DROP TABLE IF EXISTS "bi_alerts" CASCADE;

-- 2. Revertir BI Fase 1.5 (Vistas Materializadas)
DROP MATERIALIZED VIEW IF EXISTS "mv_bi_credit_aging" CASCADE;
DROP MATERIALIZED VIEW IF EXISTS "mv_bi_inventory_snapshot" CASCADE;
DROP FUNCTION IF EXISTS refresh_bi_views() CASCADE;

-- 3. Revertir Motor (Ledger, Entities, Relations, User Access)
-- NOTA: motor_ledger_entries tiene triggers que bloquean DELETE; este script asume privilegios de superuser para borrarlos.
DROP TABLE IF EXISTS "motor_ledger_entries" CASCADE;
DROP TABLE IF EXISTS "motor_entity_relations" CASCADE;
DROP TABLE IF EXISTS "motor_entity_field_definitions" CASCADE;
DROP TABLE IF EXISTS "motor_entities" CASCADE;
DROP TABLE IF EXISTS "motor_user_access" CASCADE;
DROP TABLE IF EXISTS "client_module_assignments" CASCADE;
DROP FUNCTION IF EXISTS motor_ledger_block_mutation() CASCADE;

-- 4. Revertir Logistics (Si fuera necesario, pero mantenemos core por ahora)
-- DROP TABLE IF EXISTS "delivery_events" CASCADE;
-- DROP TABLE IF EXISTS "qr_scan_logs" CASCADE;

-- 5. Revertir cambios estructurales
ALTER TABLE "clients" DROP COLUMN IF EXISTS "logisticsEnabled";
ALTER TABLE "users" DROP COLUMN IF EXISTS "metadata";

-- Limpiar tipos ENUM creados
DROP TYPE IF EXISTS "MotorAssignmentStatus" CASCADE;
DROP TYPE IF EXISTS "MotorEntityKind" CASCADE;
DROP TYPE IF EXISTS "MotorMovementType" CASCADE;
DROP TYPE IF EXISTS "MotorLedgerSign" CASCADE;
DROP TYPE IF EXISTS "MotorFieldType" CASCADE;
DROP TYPE IF EXISTS "MotorFieldKindScope" CASCADE;
