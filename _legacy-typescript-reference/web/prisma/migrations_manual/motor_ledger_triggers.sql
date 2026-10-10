-- ============================================
-- MOTOR LEDGER — APPEND-ONLY TRIGGERS (RE-APPLICABLE)
-- ============================================
-- Aplicar este script tras CUALQUIER migración futura que recree o altere
-- la tabla motor_ledger_entries. Una recreación de tabla por Prisma deja
-- el trigger huérfano silenciosamente y rompe la garantía append-only.
--
-- Uso (manual):
--   psql "$DATABASE_URL" -f prisma/migrations_manual/motor_ledger_triggers.sql
--
-- También se recomienda añadir un smoke test en CI que valide la existencia
-- de las filas en pg_trigger antes de cada deploy.

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
