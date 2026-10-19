CREATE SCHEMA IF NOT EXISTS geo;

CREATE TABLE geo.last_locations (
  subject_id text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  point geography(Point) NOT NULL,
  accuracy_m real,
  speed_mps real,
  heading real,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX last_locations_gist ON geo.last_locations USING gist (point);

CREATE TABLE geo.geofences (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('CIRCLE','POLYGON')),
  area geography(Polygon) NOT NULL,
  purpose text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX geofences_gist ON geo.geofences USING gist (area);

CREATE TABLE geo.subject_fence_state (
  subject_id text NOT NULL,
  geofence_id uuid NOT NULL REFERENCES geo.geofences(id),
  inside boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, geofence_id)
);
