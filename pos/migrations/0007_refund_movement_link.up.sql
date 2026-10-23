-- PlentyPay - pos: liga las salidas de efectivo de devoluciones anteriores a F17.3 con su
-- devolución (misma sesión, monto y momento: se escriben en la misma transacción). Corre como
-- SYSTEM porque RLS filtra por tenant y la migración no tiene uno (ADR 0011).
BEGIN;
SET LOCAL app.actor_role = 'SYSTEM';
UPDATE cash_movements m SET refund_id = r.id
  FROM refunds r
 WHERE m.refund_id IS NULL AND m.direction = 'OUT' AND m.session_id = r.session_id
   AND m.tenant_id = r.tenant_id AND m.amount_minor = r.cash_minor AND m.created_at = r.created_at
   AND r.cash_minor > 0;
COMMIT;
