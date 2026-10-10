-- ============================================
-- AUDIT TRIGGERS & REVERSIBILITY (Rule 3 & 10)
-- ============================================

-- 1. Función genérica para bloqueo de mutaciones (Append-Only)
CREATE OR REPLACE FUNCTION block_mutation_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION '% es una tabla append-only; UPDATE bloqueado (id=%)', TG_TABLE_NAME, OLD."id"
            USING ERRCODE = 'check_violation';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION '% es una tabla append-only; DELETE bloqueado (id=%)', TG_TABLE_NAME, OLD."id"
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

-- 2. Aplicar triggers a motor_ledger_entries
DROP TRIGGER IF EXISTS motor_ledger_no_update ON "motor_ledger_entries";
CREATE TRIGGER motor_ledger_no_update
    BEFORE UPDATE ON "motor_ledger_entries"
    FOR EACH ROW EXECUTE FUNCTION block_mutation_append_only();

DROP TRIGGER IF EXISTS motor_ledger_no_delete ON "motor_ledger_entries";
CREATE TRIGGER motor_ledger_no_delete
    BEFORE DELETE ON "motor_ledger_entries"
    FOR EACH ROW EXECUTE FUNCTION block_mutation_append_only();

-- 3. Aplicar triggers a delivery_events
DROP TRIGGER IF EXISTS delivery_events_no_update ON "delivery_events";
CREATE TRIGGER delivery_events_no_update
    BEFORE UPDATE ON "delivery_events"
    FOR EACH ROW EXECUTE FUNCTION block_mutation_append_only();

DROP TRIGGER IF EXISTS delivery_events_no_delete ON "delivery_events";
CREATE TRIGGER delivery_events_no_delete
    BEFORE DELETE ON "delivery_events"
    FOR EACH ROW EXECUTE FUNCTION block_mutation_append_only();

-- 4. Marcador de Reversibilidad (Rule 3)
-- Esta migración puede revertirse ejecutando:
-- DROP FUNCTION block_mutation_append_only() CASCADE;
