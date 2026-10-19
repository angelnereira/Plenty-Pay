CREATE SCHEMA IF NOT EXISTS payroll;

-- F19.1: la cédula nunca se guarda en claro: solo ciphertext + versión de clave (security.Encrypt, N-DAT-04).
CREATE TABLE payroll.employees (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid,
  full_name text NOT NULL,
  national_id_ciphertext bytea,
  national_id_key_version text,
  position text,
  pay_type text NOT NULL CHECK (pay_type IN ('SALARY','HOURLY')),
  base_salary_minor bigint,
  hourly_rate_minor bigint,
  pay_frequency text NOT NULL CHECK (pay_frequency IN ('WEEKLY','BIWEEKLY','SEMIMONTHLY','MONTHLY')),
  payout_party_id uuid,
  geofence_id uuid,
  pin_hash bytea,
  active boolean NOT NULL DEFAULT true,
  hired_on date,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employees_tenant_idx ON payroll.employees (tenant_id) WHERE active;

-- F19.4: embedding facial calculado en el dispositivo; el servidor solo guarda el ciphertext (R1).
CREATE TABLE payroll.biometric_templates (
  employee_id uuid PRIMARY KEY REFERENCES payroll.employees(id),
  ciphertext bytea NOT NULL,
  key_version text NOT NULL,
  consent_at timestamptz NOT NULL,
  enrolled_by uuid NOT NULL
);

-- F19.2: turno.
CREATE TABLE payroll.shifts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  start_local time NOT NULL,
  end_local time NOT NULL,
  break_minutes int NOT NULL DEFAULT 0,
  grace_minutes int NOT NULL DEFAULT 5
);

CREATE TABLE payroll.schedule (
  employee_id uuid NOT NULL REFERENCES payroll.employees(id),
  work_date date NOT NULL,
  shift_id uuid NOT NULL REFERENCES payroll.shifts(id),
  PRIMARY KEY (employee_id, work_date)
);

-- F19.3: marcajes. Particionado por mes sobre recorded_at.
CREATE TABLE payroll.attendance (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('IN','OUT','BREAK_START','BREAK_END')),
  method smallint NOT NULL,
  recorded_at timestamptz NOT NULL,
  location_lat double precision,
  location_lon double precision,
  inside_geofence boolean,
  device_id text,
  client_txn_id uuid UNIQUE,
  override_reason text,
  override_by uuid,
  needs_review boolean NOT NULL DEFAULT false
) PARTITION BY RANGE (recorded_at);

CREATE TABLE payroll.attendance_2026_10 PARTITION OF payroll.attendance
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
CREATE TABLE payroll.attendance_2026_11 PARTITION OF payroll.attendance
  FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
CREATE TABLE payroll.attendance_2026_12 PARTITION OF payroll.attendance
  FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE payroll.attendance_2027_01 PARTITION OF payroll.attendance
  FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');

CREATE INDEX attendance_employee_idx ON payroll.attendance (employee_id, recorded_at);

-- F19.4: sesión de quiosco, token de 12 h renovable, solo permite ClockEvent.
CREATE TABLE payroll.kiosk_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  branch_id uuid,
  device_label text,
  token_hash bytea NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

-- F19.5/F19.6: corrida de nómina.
CREATE TABLE payroll.runs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status smallint NOT NULL DEFAULT 1,
  totals jsonb,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, period_start, period_end)
);

CREATE TABLE payroll.payslips (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES payroll.runs(id),
  employee_id uuid NOT NULL REFERENCES payroll.employees(id),
  gross_minor bigint NOT NULL,
  deductions jsonb NOT NULL,
  net_minor bigint NOT NULL CHECK (net_minor >= 0),
  hours jsonb NOT NULL,
  payment_intent_id uuid,
  status text NOT NULL CHECK (status IN ('PENDING','PAID','FAILED')),
  pdf_object_key text,
  UNIQUE (run_id, employee_id)
);

CREATE TABLE payroll.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE payroll.idempotency_keys (
  tenant_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_code int NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, idempotency_key)
);