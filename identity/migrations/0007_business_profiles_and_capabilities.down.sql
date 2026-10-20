BEGIN;

DROP TABLE IF EXISTS tenant_capabilities;
ALTER TABLE tenants DROP COLUMN IF EXISTS version;
ALTER TABLE tenants DROP COLUMN IF EXISTS plan_code;
ALTER TABLE tenants DROP COLUMN IF EXISTS trait_overrides;
ALTER TABLE tenants DROP COLUMN IF EXISTS secondary_verticals;
ALTER TABLE tenants DROP COLUMN IF EXISTS primary_vertical;
DROP TABLE IF EXISTS verticals;

COMMIT;
