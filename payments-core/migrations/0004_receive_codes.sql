-- PlentyPay - payments-core: código personal para recibir (F11.10, S-WAL-04).
-- Lo único que viaja en el QR es el código opaco (128 bits, base64url). Vence a las 24 h y se
-- renueva al pedirlo; el nombre abreviado se guarda al emitirlo (identity.GetUserContacts).
CREATE TABLE payments.receive_codes (
  code         text PRIMARY KEY CHECK (code ~ '^[A-Za-z0-9_-]{16,64}$'),
  user_id      uuid NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX receive_codes_by_user ON payments.receive_codes (user_id, expires_at DESC);

ALTER TABLE payments.receive_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY receive_codes_access ON payments.receive_codes
  USING (payments.actor_is_service() OR user_id::text = current_setting('app.party_id', true))
  WITH CHECK (payments.actor_is_service());
GRANT SELECT, INSERT ON payments.receive_codes TO payments_svc;
