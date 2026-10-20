-- PlentyPay - payments-core F11.7: rieles externos (sandbox), asiento diferido (R8) y resolución
-- manual de UNKNOWN con evidencia (domain-model §6.3 paso 5).
ALTER TABLE payments.payments ADD COLUMN posting_error text;
ALTER TABLE payments.payments ADD COLUMN resolution_evidence text;
ALTER TABLE payments.payments ADD COLUMN resolved_by uuid;
CREATE INDEX payments_external_due ON payments.payments (next_check_at) WHERE rail <> 1 AND status IN (3, 9);
