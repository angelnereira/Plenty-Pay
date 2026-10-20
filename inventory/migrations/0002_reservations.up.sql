-- PlentyPay - inventory: reservas con TTL (SPEC §3, F16.3, R4). Las líneas son una instantánea.
BEGIN;

CREATE TABLE reservations (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  warehouse_id    uuid NOT NULL REFERENCES warehouses (id),
  lines           jsonb NOT NULL,
  status          smallint NOT NULL CHECK (status BETWEEN 1 AND 4),
  reference_type  text NOT NULL,
  reference_id    text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash    bytea NOT NULL,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL,
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX reservations_due ON reservations (expires_at) WHERE status = 1;
CREATE INDEX reservations_reference ON reservations (tenant_id, reference_type, reference_id);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY reservations_tenant ON reservations
  USING (current_setting('app.actor_role', true) = 'SYSTEM' OR tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM' OR tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON reservations TO inventory_svc;

COMMIT;
