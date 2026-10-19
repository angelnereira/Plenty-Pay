CREATE SCHEMA IF NOT EXISTS notifications;

-- F20.1: plantilla versionada por idioma. tenant_id NULL = plantilla de plataforma.
CREATE TABLE notifications.templates (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('EMAIL','PUSH','SMS','WHATSAPP','IN_APP')),
  locale text NOT NULL,
  version int NOT NULL,
  subject text,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key, channel, locale, version)
);

-- F20.3: bandeja in-app.
CREATE TABLE notifications.inbox (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  deep_link text,
  category text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inbox_user_idx ON notifications.inbox (user_id, created_at DESC);

-- R1: dedupe_key garantiza un solo envío por hecho (A1).
CREATE TABLE notifications.messages (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  recipient_user_id uuid,
  channel text NOT NULL,
  template_key text NOT NULL,
  template_version int NOT NULL,
  status text NOT NULL CHECK (status IN ('QUEUED','SENT','DELIVERED','FAILED','SUPPRESSED')),
  provider text,
  provider_message_id text,
  attempts smallint NOT NULL DEFAULT 0,
  last_error text,
  dedupe_key text NOT NULL UNIQUE,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
) PARTITION BY RANGE (created_at);

CREATE TABLE notifications.messages_2026_10 PARTITION OF notifications.messages
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
CREATE TABLE notifications.messages_2026_11 PARTITION OF notifications.messages
  FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
CREATE TABLE notifications.messages_2026_12 PARTITION OF notifications.messages
  FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE notifications.messages_2027_01 PARTITION OF notifications.messages
  FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');

-- F20.4: un token push pertenece a un solo usuario; la reasignación es al último.
CREATE TABLE notifications.devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ANDROID','IOS','LINUX','WEB')),
  push_token text NOT NULL UNIQUE,
  app_version text,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- F20.6: preferencias por categoría y canal.
CREATE TABLE notifications.preferences (
  user_id uuid NOT NULL,
  category text NOT NULL,
  channel text NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY (user_id, category, channel)
);

-- R5: rebote duro o queja suprime la dirección para siempre.
CREATE TABLE notifications.suppressions (
  address_hash bytea PRIMARY KEY,
  channel text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications.processed_events (
  subject text NOT NULL,
  message_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject, message_id)
);

CREATE TABLE notifications.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
