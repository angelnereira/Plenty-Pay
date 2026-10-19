CREATE SCHEMA IF NOT EXISTS logistics;

CREATE TABLE logistics.carriers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  tax_id text,
  phone text,
  external boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE logistics.drivers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  carrier_id uuid REFERENCES logistics.carriers(id),
  vehicle_kind text NOT NULL,
  vehicle_plate text,
  license_number text,
  license_expires_on date,
  insurance_provider text,
  insurance_policy_number text,
  insurance_expires_on date,
  employment_kind text NOT NULL CHECK (employment_kind IN ('EMPLOYEE','CONTRACTOR')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE logistics.deliveries (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  driver_id uuid REFERENCES logistics.drivers(id),
  status smallint NOT NULL DEFAULT 1,
  delivery_code text,
  age_restricted boolean NOT NULL DEFAULT false,
  recipient_name text,
  recipient_phone text,
  delivery_address jsonb,
  delivery_fee_minor bigint NOT NULL DEFAULT 0,
  attempt_number int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE logistics.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
