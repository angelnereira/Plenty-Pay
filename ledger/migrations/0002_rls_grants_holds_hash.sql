-- PlentyPay - ledger: RLS como segunda barrera (ADR 0014), permisos del rol de servicio y hash de
-- idempotencia de los holds (SPEC R4). Nada contable se borra: ledger_svc no tiene DELETE.

ALTER TABLE ledger.holds ADD COLUMN IF NOT EXISTS request_hash bytea NOT NULL DEFAULT '\x';
ALTER TABLE ledger.holds ADD CONSTRAINT holds_status_check CHECK (status IN ('ACTIVE','CAPTURED','RELEASED','EXPIRED'));
ALTER TABLE ledger.accounts ADD CONSTRAINT accounts_currency_check CHECK (currency ~ '^[A-Z]{3}$');

-- Quién lee: el propio servicio (escrituras de payments-core/settlement y lecturas de servicio),
-- plataforma, o la parte/el negocio dueño de la cuenta (lecturas desde el gateway).
CREATE OR REPLACE FUNCTION ledger.actor_is_service() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.actor', true), '') IN ('service', 'platform')
$$;

ALTER TABLE ledger.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger.holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger.outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_access ON ledger.accounts
  USING (ledger.actor_is_service()
         OR party_id::text = current_setting('app.party_id', true)
         OR tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (ledger.actor_is_service());

CREATE POLICY transactions_access ON ledger.transactions
  USING (ledger.actor_is_service()
         OR tenant_id::text = current_setting('app.tenant_id', true)
         OR EXISTS (SELECT 1 FROM ledger.entries e JOIN ledger.accounts a ON a.id = e.account_id
                    WHERE e.transaction_id = transactions.id
                      AND a.party_id::text = current_setting('app.party_id', true)))
  WITH CHECK (ledger.actor_is_service());

CREATE POLICY entries_access ON ledger.entries
  USING (ledger.actor_is_service()
         OR EXISTS (SELECT 1 FROM ledger.accounts a WHERE a.id = entries.account_id
                      AND (a.party_id::text = current_setting('app.party_id', true)
                           OR a.tenant_id::text = current_setting('app.tenant_id', true))))
  WITH CHECK (ledger.actor_is_service());

CREATE POLICY holds_access ON ledger.holds
  USING (ledger.actor_is_service()
         OR EXISTS (SELECT 1 FROM ledger.accounts a WHERE a.id = holds.account_id
                      AND a.party_id::text = current_setting('app.party_id', true)))
  WITH CHECK (ledger.actor_is_service());

CREATE POLICY outbox_access ON ledger.outbox
  USING (ledger.actor_is_service()) WITH CHECK (ledger.actor_is_service());

-- USAGE sobre el esquema lo concede postgres-db/init (el esquema es de postgres, no del migrador).
GRANT SELECT, INSERT, UPDATE ON ledger.accounts, ledger.transactions, ledger.entries, ledger.holds, ledger.outbox TO ledger_svc;
GRANT EXECUTE ON FUNCTION ledger.actor_is_service() TO ledger_svc;

-- I3 (SPEC R3): una transacción POSTED es inmutable salvo el paso POSTED -> REVERSED. 0001 solo
-- protegía id, clave y estado; aquí se protege toda la fila.
CREATE OR REPLACE FUNCTION ledger.trg_transactions_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ledger rows are never deleted';
  END IF;
  IF OLD.status IN ('POSTED', 'REVERSED') THEN
    IF NOT (OLD.status = 'POSTED' AND NEW.status = 'REVERSED')
       OR (to_jsonb(NEW) - 'status') <> (to_jsonb(OLD) - 'status') THEN
      RAISE EXCEPTION 'posted transactions are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Holds: un hold terminado (CAPTURED, RELEASED, EXPIRED) no cambia; uno activo solo cambia de estado.
CREATE OR REPLACE FUNCTION ledger.trg_holds_lifecycle() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ledger rows are never deleted';
  END IF;
  IF OLD.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'finished holds are immutable';
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'captured_transaction_id' - 'updated_at')
     <> (to_jsonb(OLD) - 'status' - 'captured_transaction_id' - 'updated_at') THEN
    RAISE EXCEPTION 'hold amount, account and expiry are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER holds_lifecycle
  BEFORE UPDATE OR DELETE ON ledger.holds
  FOR EACH ROW EXECUTE FUNCTION ledger.trg_holds_lifecycle();

-- Segunda barrera de I1 (SPEC R1): el balance se verifica al pasar DRAFT -> POSTED, así que una
-- transacción nunca nace POSTED/REVERSED (saltaría el trigger de balance).
CREATE OR REPLACE FUNCTION ledger.trg_transactions_born_draft() RETURNS trigger AS $$
BEGIN
  IF NEW.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'transactions must be inserted as DRAFT';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_born_draft
  BEFORE INSERT ON ledger.transactions
  FOR EACH ROW EXECUTE FUNCTION ledger.trg_transactions_born_draft();

-- Segunda barrera de I5 (SPEC R6): el código ya lo valida bajo bloqueo; si un defecto lo saltara,
-- la base rechaza la escritura.
ALTER TABLE ledger.accounts ADD CONSTRAINT accounts_available_non_negative
  CHECK (allow_negative OR balance_minor - held_minor >= 0);
