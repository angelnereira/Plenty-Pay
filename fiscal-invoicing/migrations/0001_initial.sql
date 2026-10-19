CREATE SCHEMA IF NOT EXISTS fiscal;

CREATE TABLE fiscal.profiles (
  tenant_id uuid PRIMARY KEY,
  ruc text NOT NULL,
  dv text NOT NULL,
  legal_name text NOT NULL,
  branch_code text NOT NULL DEFAULT '0000',
  point_of_sale_code text NOT NULL DEFAULT '001',
  pac_provider text NOT NULL,
  pac_credentials_secret text NOT NULL,
  checkout_preference smallint NOT NULL,
  auto_threshold_minor bigint,
  environment text NOT NULL CHECK (environment IN ('TEST','PRODUCTION')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1
);

CREATE TABLE fiscal.folio_ranges (
  tenant_id uuid NOT NULL,
  doc_type smallint NOT NULL,
  next_number bigint NOT NULL,
  last_number bigint NOT NULL,
  PRIMARY KEY (tenant_id, doc_type)
);

CREATE TABLE fiscal.invoices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  doc_type smallint NOT NULL,
  status smallint NOT NULL,
  number bigint,
  cufe text UNIQUE,
  qr_url text,
  related_invoice_id uuid,
  source_type text NOT NULL,
  source_id text NOT NULL,
  customer_taxpayer_id uuid,
  customer_snapshot jsonb,
  lines jsonb NOT NULL,
  subtotal_minor bigint NOT NULL,
  tax_minor bigint NOT NULL,
  total_minor bigint NOT NULL,
  currency char(3) NOT NULL,
  payment_methods jsonb NOT NULL DEFAULT '[]',
  pac_attempts int NOT NULL DEFAULT 0,
  last_error text,
  xml_object_key text,
  pdf_object_key text,
  idempotency_key text NOT NULL,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, source_type, source_id, doc_type)
);

CREATE TABLE fiscal.taxpayers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  kind text NOT NULL,
  ruc_or_id text NOT NULL,
  dv text,
  name text NOT NULL,
  email text,
  address jsonb,
  UNIQUE (tenant_id, ruc_or_id)
);

CREATE TABLE fiscal.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
