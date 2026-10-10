-- ============================================
-- MOTOR DE ENTIDADES & LEDGER FINANCIERO
-- ============================================
-- Subsistema tenant-scoped:
--   (a) Schema Builder de entidades con campos dinámicos (JSONB)
--   (b) Ledger financiero append-only con cargos, abonos, ajustes, lealtad
-- Acceso restringido a tenants con ClientModuleAssignment(moduleKey="motor", status=ACTIVE).
-- Todos los montos en BigInt (centavos PAB) — convención específica del Motor.
-- Esta migración debe revisarse manualmente y aplicarse a producción de forma controlada.

-- ============================================
-- Enums
-- ============================================

CREATE TYPE "MotorEntityKind" AS ENUM ('PERSON', 'COMPANY');

CREATE TYPE "MotorMovementType" AS ENUM (
    'CHARGE',
    'PAYMENT',
    'ADJUSTMENT_CREDIT',
    'ADJUSTMENT_DEBIT',
    'LOYALTY_GRANT',
    'LOYALTY_REDEEM'
);

CREATE TYPE "MotorLedgerSign" AS ENUM ('POSITIVE', 'NEGATIVE');

CREATE TYPE "MotorAssignmentStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TYPE "MotorFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');

CREATE TYPE "MotorFieldKindScope" AS ENUM ('PERSON', 'COMPANY', 'BOTH');

-- ============================================
-- Tabla: client_module_assignments
-- ============================================
CREATE TABLE "client_module_assignments" (
    "id"         TEXT NOT NULL,
    "clientId"   TEXT NOT NULL,
    "moduleKey"  TEXT NOT NULL,
    "status"     "MotorAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"  TIMESTAMP(3),
    "assignedBy" TEXT NOT NULL,
    "notes"      TEXT,
    CONSTRAINT "client_module_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_module_assignments_clientId_moduleKey_key"
    ON "client_module_assignments" ("clientId", "moduleKey");
CREATE INDEX "client_module_assignments_clientId_status_idx"
    ON "client_module_assignments" ("clientId", "status");
CREATE INDEX "client_module_assignments_moduleKey_status_idx"
    ON "client_module_assignments" ("moduleKey", "status");

ALTER TABLE "client_module_assignments"
    ADD CONSTRAINT "client_module_assignments_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Tabla: motor_entities
-- ============================================
CREATE TABLE "motor_entities" (
    "id"                 TEXT NOT NULL,
    "clientId"           TEXT NOT NULL,
    "kind"               "MotorEntityKind" NOT NULL,
    "displayName"        TEXT NOT NULL,
    "documentType"       TEXT,
    "documentNumber"     TEXT,
    "primaryEmail"       TEXT,
    "primaryPhone"       TEXT,
    "isActive"           BOOLEAN NOT NULL DEFAULT true,
    "creditLimitCents"   BIGINT,
    "paymentDueAt"       TIMESTAMP(3),
    "loyaltyPointsCents" BIGINT NOT NULL DEFAULT 0,
    "customFields"       JSONB,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    "deletedAt"          TIMESTAMP(3),
    CONSTRAINT "motor_entities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "motor_entities_clientId_kind_deletedAt_idx"
    ON "motor_entities" ("clientId", "kind", "deletedAt");
CREATE INDEX "motor_entities_clientId_displayName_idx"
    ON "motor_entities" ("clientId", "displayName");
CREATE INDEX "motor_entities_clientId_documentNumber_idx"
    ON "motor_entities" ("clientId", "documentNumber");
CREATE INDEX "motor_entities_clientId_isActive_idx"
    ON "motor_entities" ("clientId", "isActive");

-- GIN index para queryability de customFields
CREATE INDEX "motor_entities_customFields_gin_idx"
    ON "motor_entities" USING GIN ("customFields" jsonb_path_ops);

ALTER TABLE "motor_entities"
    ADD CONSTRAINT "motor_entities_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Tabla: motor_entity_field_definitions
-- ============================================
CREATE TABLE "motor_entity_field_definitions" (
    "id"        TEXT NOT NULL,
    "clientId"  TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "type"      "MotorFieldType" NOT NULL,
    "required"  BOOLEAN NOT NULL DEFAULT false,
    "options"   JSONB,
    "kindScope" "MotorFieldKindScope" NOT NULL DEFAULT 'BOTH',
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "motor_entity_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "motor_entity_field_definitions_clientId_slug_key"
    ON "motor_entity_field_definitions" ("clientId", "slug");
CREATE INDEX "motor_entity_field_definitions_clientId_isActive_kindScope_idx"
    ON "motor_entity_field_definitions" ("clientId", "isActive", "kindScope");

ALTER TABLE "motor_entity_field_definitions"
    ADD CONSTRAINT "motor_entity_field_definitions_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Tabla: motor_entity_relations
-- ============================================
CREATE TABLE "motor_entity_relations" (
    "id"           TEXT NOT NULL,
    "clientId"     TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId"   TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "metadata"     JSONB,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById"  TEXT NOT NULL,
    CONSTRAINT "motor_entity_relations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "motor_entity_relations_uniq"
    ON "motor_entity_relations" ("clientId", "fromEntityId", "toEntityId", "relationType");
CREATE INDEX "motor_entity_relations_clientId_fromEntityId_idx"
    ON "motor_entity_relations" ("clientId", "fromEntityId");
CREATE INDEX "motor_entity_relations_clientId_toEntityId_idx"
    ON "motor_entity_relations" ("clientId", "toEntityId");

ALTER TABLE "motor_entity_relations"
    ADD CONSTRAINT "motor_entity_relations_fromEntityId_fkey"
    FOREIGN KEY ("fromEntityId") REFERENCES "motor_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "motor_entity_relations"
    ADD CONSTRAINT "motor_entity_relations_toEntityId_fkey"
    FOREIGN KEY ("toEntityId") REFERENCES "motor_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "motor_entity_relations"
    ADD CONSTRAINT "motor_entity_relations_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Tabla: motor_ledger_entries (APPEND-ONLY)
-- ============================================
CREATE TABLE "motor_ledger_entries" (
    "id"                  TEXT NOT NULL,
    "clientId"            TEXT NOT NULL,
    "entityId"            TEXT NOT NULL,
    "movementType"        "MotorMovementType" NOT NULL,
    "sign"                "MotorLedgerSign" NOT NULL,
    "amountCents"         BIGINT NOT NULL,
    "runningBalanceCents" BIGINT NOT NULL,
    "currency"            TEXT NOT NULL DEFAULT 'PAB',
    "reference"           TEXT,
    "description"         TEXT,
    "metadata"            JSONB,
    "compensatesEntryId"  TEXT,
    "createdById"         TEXT NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "motor_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "motor_ledger_entries_clientId_entityId_createdAt_idx"
    ON "motor_ledger_entries" ("clientId", "entityId", "createdAt");
CREATE INDEX "motor_ledger_entries_clientId_movementType_createdAt_idx"
    ON "motor_ledger_entries" ("clientId", "movementType", "createdAt");
CREATE INDEX "motor_ledger_entries_clientId_compensatesEntryId_idx"
    ON "motor_ledger_entries" ("clientId", "compensatesEntryId");

ALTER TABLE "motor_ledger_entries"
    ADD CONSTRAINT "motor_ledger_entries_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "motor_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "motor_ledger_entries"
    ADD CONSTRAINT "motor_ledger_entries_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "motor_ledger_entries"
    ADD CONSTRAINT "motor_ledger_entries_compensatesEntryId_fkey"
    FOREIGN KEY ("compensatesEntryId") REFERENCES "motor_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- TRIGGERS DE INMUTABILIDAD (defensa en profundidad)
-- ============================================
-- El ledger es append-only por diseño. Bloqueamos UPDATE/DELETE a nivel DB
-- para protegernos de migraciones, scripts ad-hoc o errores de aplicación.
-- IMPORTANTE: si una futura migración recrea la tabla, este trigger se pierde.
-- Mantener prisma/migrations_manual/motor_ledger_triggers.sql como respaldo
-- y reaplicar tras cualquier cambio estructural en motor_ledger_entries.
CREATE OR REPLACE FUNCTION motor_ledger_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'motor_ledger_entries es append-only; UPDATE bloqueado (id=%)', OLD."id"
            USING ERRCODE = 'check_violation';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'motor_ledger_entries es append-only; DELETE bloqueado (id=%)', OLD."id"
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS motor_ledger_no_update ON "motor_ledger_entries";
CREATE TRIGGER motor_ledger_no_update
    BEFORE UPDATE ON "motor_ledger_entries"
    FOR EACH ROW EXECUTE FUNCTION motor_ledger_block_mutation();

DROP TRIGGER IF EXISTS motor_ledger_no_delete ON "motor_ledger_entries";
CREATE TRIGGER motor_ledger_no_delete
    BEFORE DELETE ON "motor_ledger_entries"
    FOR EACH ROW EXECUTE FUNCTION motor_ledger_block_mutation();
