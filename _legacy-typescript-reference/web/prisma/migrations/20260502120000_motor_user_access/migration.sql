-- ============================================
-- MOTOR v1.1: cambio de gating a nivel de USUARIO
-- ============================================
-- El Motor pasa de ser un módulo opcional por tenant a infraestructura
-- universal silenciosa. El acceso al panel avanzado se controla a nivel
-- de usuario individual (no de tenant) mediante motor_user_access.
-- ClientModuleAssignment se conserva por compatibilidad de datos pero
-- ya no gateaa nada en código nuevo.

-- ============================================
-- Tabla: motor_user_access
-- ============================================
CREATE TABLE "motor_user_access" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "clientId"  TEXT NOT NULL,
    "status"    "MotorAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "grantedBy" TEXT NOT NULL,
    "notes"     TEXT,
    CONSTRAINT "motor_user_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "motor_user_access_userId_key"
    ON "motor_user_access" ("userId");
CREATE INDEX "motor_user_access_clientId_status_idx"
    ON "motor_user_access" ("clientId", "status");
CREATE INDEX "motor_user_access_status_idx"
    ON "motor_user_access" ("status");

ALTER TABLE "motor_user_access"
    ADD CONSTRAINT "motor_user_access_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "motor_user_access"
    ADD CONSTRAINT "motor_user_access_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Migración de datos: si en algún tenant había una ClientModuleAssignment
-- ACTIVE, conceder acceso al primer usuario admin/owner del tenant para
-- preservar continuidad. Si quieres concederlo manualmente a un set
-- distinto, comenta este bloque y usa la UI /dashboard/admin/motor-access.
-- ============================================
INSERT INTO "motor_user_access" ("id", "userId", "clientId", "status", "grantedBy", "notes")
SELECT
    gen_random_uuid()::text AS id,
    u."id" AS "userId",
    cma."clientId",
    'ACTIVE',
    cma."assignedBy",
    'Migrado desde ClientModuleAssignment v1.0' AS notes
FROM "client_module_assignments" cma
JOIN LATERAL (
    SELECT "id" FROM "users"
    WHERE "clientId" = cma."clientId"
      AND "isActive" = true
    ORDER BY "createdAt" ASC
    LIMIT 1
) u ON true
WHERE cma."status" = 'ACTIVE'
  AND cma."moduleKey" = 'motor'
ON CONFLICT ("userId") DO NOTHING;
