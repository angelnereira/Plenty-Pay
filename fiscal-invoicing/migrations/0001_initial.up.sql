-- PlentyPay - fiscal-invoicing: perfil fiscal, folios, documentos, contribuyentes y outbox
-- (fiscal-invoicing/SPEC.md §3). RLS por tenant como segunda barrera (ADR 0014); el rol SYSTEM
-- es el del worker de envío al PAC y del relay del outbox.
BEGIN;

CREATE TABLE profiles (
  tenant_id               uuid PRIMARY KEY,
  ruc                     text NOT NULL,
  dv                      text NOT NULL CHECK (dv ~ '^[0-9]{2}$'),
  legal_name              text NOT NULL CHECK (char_length(legal_name) BETWEEN 1 AND 200),
  branch_code             text NOT NULL DEFAULT '0000' CHECK (branch_code ~ '^[0-9]{4}$'),
  point_of_sale_code      text NOT NULL DEFAULT '001' CHECK (point_of_sale_code ~ '^[0-9]{3}$'),
  pac_provider            text NOT NULL,
  pac_credentials_secret  text NOT NULL DEFAULT '',   -- NOMBRE del secreto en security, nunca el valor
  certificate_secret_ref  text NOT NULL DEFAULT '',
  checkout_preference     smallint NOT NULL CHECK (checkout_preference BETWEEN 1 AND 4),
  auto_threshold_minor    bigint CHECK (auto_threshold_minor IS NULL OR auto_threshold_minor >= 0),
  environment             text NOT NULL CHECK (environment IN ('DEMO', 'PROD')),
  idempotency_key         text NOT NULL DEFAULT '',  -- la última configuración: un reintento no consume otro step-up
  updated_at              timestamptz NOT NULL,
  version                 int NOT NULL DEFAULT 1
);

-- R2: numeración consecutiva sin huecos por (tenant, tipo, punto de facturación). La fila se
-- bloquea al asignar; last_number NULL = sin tope contratado.
CREATE TABLE folio_ranges (
  tenant_id          uuid NOT NULL,
  doc_type           smallint NOT NULL CHECK (doc_type BETWEEN 1 AND 3),
  point_of_sale_code text NOT NULL,
  next_number        bigint NOT NULL DEFAULT 1 CHECK (next_number >= 1),
  last_number        bigint CHECK (last_number IS NULL OR last_number >= 0),
  PRIMARY KEY (tenant_id, doc_type, point_of_sale_code)
);

CREATE TABLE invoices (
  id                   uuid PRIMARY KEY,
  tenant_id            uuid NOT NULL,
  doc_type             smallint NOT NULL CHECK (doc_type BETWEEN 1 AND 3),
  status               smallint NOT NULL CHECK (status BETWEEN 1 AND 6),
  environment          text NOT NULL CHECK (environment IN ('DEMO', 'PROD')),
  point_of_sale_code   text NOT NULL,
  number               bigint,
  cufe                 text UNIQUE,
  qr_url               text,
  related_invoice_id   uuid REFERENCES invoices(id),
  source_type          text NOT NULL,
  source_id            text NOT NULL,
  customer_taxpayer_id uuid,
  customer_snapshot    jsonb,
  lines                jsonb NOT NULL,
  subtotal_minor       bigint NOT NULL CHECK (subtotal_minor >= 0),
  tax_minor            bigint NOT NULL CHECK (tax_minor >= 0),
  total_minor          bigint NOT NULL CHECK (total_minor = subtotal_minor + tax_minor),
  currency             char(3) NOT NULL,
  payment_methods      jsonb NOT NULL DEFAULT '[]'::jsonb,
  document_date        date NOT NULL,
  legal_param_version  text NOT NULL,                -- tasas legal.pa.itbms.* usadas (AGENTS.md §8)
  reason               text,                         -- motivo de una nota
  pac_attempts         int NOT NULL DEFAULT 0,
  next_attempt_at      timestamptz,
  last_error           text,
  rejection_reason     text,
  xml_object_key       text,
  pdf_object_key       text,
  idempotency_key      text NOT NULL,
  request_hash         bytea NOT NULL,
  issued_at            timestamptz,
  created_at           timestamptz NOT NULL,
  updated_at           timestamptz NOT NULL,
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, source_type, source_id, doc_type),                 -- R6
  UNIQUE (tenant_id, doc_type, point_of_sale_code, number)              -- R2
);
CREATE INDEX invoices_tenant_created ON invoices (tenant_id, created_at DESC, id DESC);
CREATE INDEX invoices_pending ON invoices (next_attempt_at) WHERE status IN (2, 3);

CREATE TABLE taxpayers (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  tax_id_type text NOT NULL CHECK (tax_id_type IN ('RUC_JURIDICO', 'RUC_NATURAL', 'CEDULA', 'PASAPORTE', 'EXTRANJERO')),
  tax_id      text NOT NULL,
  check_digit text NOT NULL DEFAULT '',
  legal_name  text NOT NULL CHECK (char_length(legal_name) BETWEEN 1 AND 200),
  email       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL,
  UNIQUE (tenant_id, tax_id)
);

CREATE TABLE outbox (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  aggregate_id uuid NOT NULL,
  subject      text NOT NULL,
  payload      bytea NOT NULL,
  created_at   timestamptz NOT NULL,
  published_at timestamptz
);
CREATE INDEX outbox_pending ON outbox (created_at) WHERE published_at IS NULL;

-- N-FIS-08: un documento aceptado no se edita ni se borra; solo cambia a VOIDED por nota de crédito.
CREATE OR REPLACE FUNCTION invoices_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'fiscal.invoices no se borra (N-FIS-08)';
  END IF;
  IF OLD.status = 4 AND NOT (NEW.status = 6 AND NEW.lines = OLD.lines AND NEW.total_minor = OLD.total_minor
                              AND NEW.number = OLD.number AND NEW.cufe = OLD.cufe) THEN
    RAISE EXCEPTION 'factura aceptada inmutable (N-FIS-08): solo pasa a VOIDED por nota de crédito';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoices_immutable BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoices_guard();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','folio_ranges','invoices','taxpayers','outbox'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))
      WITH CHECK (current_setting('app.actor_role', true) = 'SYSTEM'
             OR tenant_id::text = current_setting('app.tenant_id', true))$p$, t || '_tenant', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON profiles, folio_ranges, invoices, taxpayers, outbox TO fiscal_svc;

COMMIT;
