-- PlentyPay — ScyllaDB / Cassandra Roles y Keyspaces (F07.1, F07.2)
-- SPEC: nosql-db/SPEC.md §3

-- 1. Keyspaces por dueño (RF=1 en dev local, NetworkTopologyStrategy en prod)
CREATE KEYSPACE IF NOT EXISTS catalog_attrs
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

CREATE KEYSPACE IF NOT EXISTS geo_tracks
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

CREATE KEYSPACE IF NOT EXISTS analytics_events
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

-- 2. Roles por contenedor dueño
CREATE ROLE IF NOT EXISTS catalog_svc
  WITH PASSWORD = 'catalog_svc_dev_secret_32_chars!' AND LOGIN = true;

CREATE ROLE IF NOT EXISTS geo_svc
  WITH PASSWORD = 'geo_svc_dev_secret_32_chars!' AND LOGIN = true;

CREATE ROLE IF NOT EXISTS analytics_svc
  WITH PASSWORD = 'analytics_svc_dev_secret_32_chars!' AND LOGIN = true;

-- 3. Permisos aislados por dueño (SPEC §3: un rol CQL por dueño con permisos solo sobre su keyspace)
GRANT ALL PERMISSIONS ON KEYSPACE catalog_attrs TO catalog_svc;
GRANT ALL PERMISSIONS ON KEYSPACE geo_tracks TO geo_svc;
GRANT ALL PERMISSIONS ON KEYSPACE analytics_events TO analytics_svc;

-- 4. Tablas iniciales por dueño con particionamiento acotado (R1) y TTL (SPEC §3)
-- catalog: product_attributes (sin TTL)
CREATE TABLE IF NOT EXISTS catalog_attrs.product_attributes (
  tenant_id text,
  product_id text,
  attr_key text,
  attr_value text,
  PRIMARY KEY ((tenant_id, product_id), attr_key)
);

-- geolocation: points (TTL 90 días = 7,776,000 s)
CREATE TABLE IF NOT EXISTS geo_tracks.points (
  tenant_id text,
  device_id text,
  day text,
  recorded_at timestamp,
  lat double,
  lng double,
  speed double,
  PRIMARY KEY ((tenant_id, device_id, day), recorded_at)
) WITH default_time_to_live = 7776000;

-- analytics-bi: events (TTL 25 meses = 65,700,000 s)
CREATE TABLE IF NOT EXISTS analytics_events.events (
  tenant_id text,
  month text,
  event_id uuid,
  event_type text,
  payload text,
  occurred_at timestamp,
  PRIMARY KEY ((tenant_id, month), occurred_at, event_id)
) WITH default_time_to_live = 65700000;
