CREATE SCHEMA IF NOT EXISTS analytics;

-- F21.2: agregados particionados por mes; todo con tenant_id + RLS.
CREATE TABLE analytics.daily_sales (
  tenant_id uuid NOT NULL,
  day date NOT NULL,
  branch_id uuid NOT NULL,
  channel text NOT NULL,
  gross_minor bigint NOT NULL DEFAULT 0,
  net_minor bigint NOT NULL DEFAULT 0,
  orders int NOT NULL DEFAULT 0,
  items_milli bigint NOT NULL DEFAULT 0,
  sandbox boolean NOT NULL DEFAULT false
) PARTITION BY RANGE (day);

CREATE TABLE analytics.daily_sales_2026_10 PARTITION OF analytics.daily_sales
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE analytics.daily_sales_2026_11 PARTITION OF analytics.daily_sales
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE analytics.daily_sales_2026_12 PARTITION OF analytics.daily_sales
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE analytics.product_daily (
  tenant_id uuid NOT NULL,
  day date NOT NULL,
  variant_id uuid NOT NULL,
  qty_milli bigint NOT NULL DEFAULT 0,
  revenue_minor bigint NOT NULL DEFAULT 0,
  cost_minor bigint NOT NULL DEFAULT 0
) PARTITION BY RANGE (day);

CREATE TABLE analytics.product_daily_2026_10 PARTITION OF analytics.product_daily
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE analytics.product_daily_2026_11 PARTITION OF analytics.product_daily
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE analytics.product_daily_2026_12 PARTITION OF analytics.product_daily
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- F21.5: RFM.
CREATE TABLE analytics.customer_stats (
  tenant_id uuid NOT NULL,
  customer_user_id uuid NOT NULL,
  first_purchase date NOT NULL,
  last_purchase date NOT NULL,
  orders int NOT NULL DEFAULT 0,
  revenue_minor bigint NOT NULL DEFAULT 0,
  segment text NOT NULL,
  PRIMARY KEY (tenant_id, customer_user_id)
);

-- F21.3: catálogo de métricas versionado (analytics/metrics.yaml).
CREATE TABLE analytics.metric_catalog (
  name text NOT NULL,
  version int NOT NULL,
  tenant_id uuid,
  unit text NOT NULL,
  description text NOT NULL,
  dimensions text[] NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (name, version, tenant_id)
);

-- F21.4: dashboards; los widgets son consultas del catálogo, nunca SQL libre (R6).
CREATE TABLE analytics.dashboards (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  widgets jsonb NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- F21.6: reglas de alerta y eventos.
CREATE TABLE analytics.alert_rules (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  metric text NOT NULL,
  op text NOT NULL CHECK (op IN ('GT','LT','ANOMALY')),
  threshold bigint NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analytics.alert_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  rule_id uuid NOT NULL REFERENCES analytics.alert_rules(id),
  metric text NOT NULL,
  day date NOT NULL,
  observed_value bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, day)
);

-- F21.9: exportes asíncronos a object-storage, enlace 24 h.
CREATE TABLE analytics.exports (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('CSV','XLSX')),
  status text NOT NULL CHECK (status IN ('PENDING','READY','FAILED')),
  object_key text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- R1: idempotencia de la ingesta de eventos crudos.
CREATE TABLE analytics.processed_events (
  subject text NOT NULL,
  event_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject, event_id)
);

CREATE TABLE analytics.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
