-- PlentyPay - payments-core: reembolsos por split (F11.6, R11, domain-model §4.4, T7).
-- Un reembolso nace PENDING con su reverso de comisiones congelado; el asiento T7 lo hace el
-- servicio fuera de la transacción (R6) con la clave `refund:<id>`; un PENDING ambiguo lo retoma un job.
ALTER TABLE payments.refunds
  ADD COLUMN merchant_party_id uuid,
  ADD COLUMN payer_credit_minor bigint CHECK (payer_credit_minor IS NULL OR payer_credit_minor > 0),
  ADD COLUMN created_by uuid,
  ADD COLUMN failure_code text,
  ADD COLUMN next_check_at timestamptz;

UPDATE payments.refunds SET merchant_party_id = tenant_id, payer_credit_minor = amount_minor WHERE merchant_party_id IS NULL;
ALTER TABLE payments.refunds ALTER COLUMN merchant_party_id SET NOT NULL;
ALTER TABLE payments.refunds ALTER COLUMN payer_credit_minor SET NOT NULL;

CREATE INDEX refunds_by_payment ON payments.refunds (payment_id, merchant_party_id);
CREATE INDEX refunds_pending ON payments.refunds (next_check_at) WHERE status = 1;

-- Un reembolso terminado no cambia (nada se borra ni se reescribe: se corrige con otro registro).
CREATE FUNCTION payments.trg_refunds_final() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN (2, 3) THEN
    RAISE EXCEPTION 'refund % is final', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.amount_minor <> OLD.amount_minor OR NEW.payment_id <> OLD.payment_id
     OR NEW.merchant_party_id <> OLD.merchant_party_id OR NEW.fee_reversal <> OLD.fee_reversal THEN
    RAISE EXCEPTION 'refund % terms are immutable', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER refunds_final BEFORE UPDATE ON payments.refunds
  FOR EACH ROW EXECUTE FUNCTION payments.trg_refunds_final();
