-- PlentyPay - identity: perfiles comerciales, verticales y capacidades por tenant (ADR 0018, R20, R21)
BEGIN;

CREATE TABLE IF NOT EXISTS verticals (
  key                    text PRIMARY KEY,
  family                 text NOT NULL,
  default_traits         text[] NOT NULL DEFAULT '{}',
  suggested_capabilities text[] NOT NULL DEFAULT '{}',
  role_template_keys     text[] NOT NULL DEFAULT '{}',
  version                int NOT NULL DEFAULT 1,
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO verticals (key, family, default_traits, suggested_capabilities, role_template_keys, version, active) VALUES
  ('retail', 'COMMERCE',
    ARRAY['sells_goods','tracks_inventory','purchasing','loyalty','fiscal_invoicing'],
    ARRAY['catalog.products','pos.counter','inventory.stock','inventory.purchasing','pos.loyalty','finance.payments','finance.settlement','finance.fiscal','analytics.dashboards'],
    ARRAY['sales_associate'], 1, true),
  ('food_and_beverage', 'FOOD',
    ARRAY['sells_goods','table_service','kitchen_production','modifiers','recipes','fiscal_invoicing'],
    ARRAY['catalog.products','catalog.modifiers','pos.counter','pos.tables','pos.kitchen_display','pos.split_bill','inventory.stock','inventory.recipes','finance.payments','finance.settlement','finance.fiscal','analytics.dashboards'],
    ARRAY['waiter','host','kitchen','bartender'], 1, true),
  ('services_appointments', 'SERVICES',
    ARRAY['sells_services','appointments','walk_in_queue','fiscal_invoicing'],
    ARRAY['catalog.services','appointments.calendar','appointments.queue','pos.counter','finance.payments','finance.settlement','finance.fiscal','analytics.dashboards'],
    ARRAY['stylist','receptionist','salon_manager'], 1, true),
  ('professional_services', 'SERVICES',
    ARRAY['sells_services','appointments','b2b_customers','fiscal_invoicing'],
    ARRAY['catalog.services','appointments.calendar','orders.quotes','catalog.price_lists','finance.payments','finance.settlement','finance.fiscal','analytics.dashboards'],
    ARRAY['receptionist'], 1, true),
  ('wholesale_distribution', 'COMMERCE',
    ARRAY['sells_goods','tracks_inventory','b2b_customers','house_credit','purchasing','own_delivery','fiscal_invoicing'],
    ARRAY['catalog.products','catalog.price_lists','orders.quotes','orders.b2b','inventory.stock','inventory.purchasing','pos.counter','pos.house_credit','logistics.own_fleet','finance.payments','finance.settlement','finance.fiscal','analytics.dashboards'],
    ARRAY['sales_rep','credit_officer','warehouse_lead','dispatcher'], 1, true),
  ('logistics_courier', 'LOGISTICS',
    ARRAY['own_delivery','third_party_delivery','fleet_management','b2b_customers','fiscal_invoicing'],
    ARRAY['logistics.own_fleet','logistics.carriers','logistics.geofences','logistics.fleet','logistics.routes','finance.payments','finance.settlement','finance.fiscal','analytics.dashboards'],
    ARRAY['fleet_manager','dispatcher','billing_clerk'], 1, true),
  ('beauty_wellness', 'SERVICES',
    ARRAY['sells_services','appointments','walk_in_queue','sells_goods','loyalty','fiscal_invoicing'],
    ARRAY['catalog.services','catalog.products','appointments.calendar','appointments.queue','pos.counter','pos.loyalty','finance.payments','finance.settlement','finance.fiscal','analytics.dashboards'],
    ARRAY['stylist','receptionist','salon_manager'], 1, true),
  ('health_clinic', 'SERVICES',
    ARRAY['sells_services','appointments','lots_expiry','fiscal_invoicing'],
    ARRAY['catalog.services','appointments.calendar','inventory.stock','inventory.lots','pos.counter','finance.payments','finance.settlement','finance.fiscal','analytics.dashboards'],
    ARRAY['receptionist'], 1, true),
  ('education_courses', 'SERVICES',
    ARRAY['sells_services','appointments','fiscal_invoicing'],
    ARRAY['catalog.services','appointments.calendar','pos.counter','finance.payments','finance.settlement','finance.fiscal','analytics.dashboards'],
    ARRAY['receptionist'], 1, true),
  ('general_commercial', 'GENERAL',
    ARRAY['sells_goods','tracks_inventory','fiscal_invoicing'],
    ARRAY['catalog.products','pos.counter','inventory.stock','finance.payments','finance.settlement','finance.fiscal','analytics.dashboards'],
    ARRAY['sales_associate'], 1, true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_vertical text NOT NULL DEFAULT 'general_commercial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS secondary_verticals text[] NOT NULL DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trait_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'standard';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS tenant_capabilities (
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  capability text NOT NULL,
  enabled    boolean NOT NULL DEFAULT true,
  source     text NOT NULL DEFAULT 'VERTICAL' CHECK (source IN ('VERTICAL','TRAIT','MANUAL','PLAN')),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, capability)
);

-- Backfill: los negocios creados antes de 0007 conservan lo que ya podian usar
-- (R21 filtraria todos sus permisos de negocio si no tuvieran capacidades). Se
-- encienden todas las capacidades del catalogo salvo las sujetas a preguntas
-- abiertas (pos.tips Q-21, payroll.commissions Q-32, appointments.deposits Q-33),
-- con source PLAN: plan unico ilimitado mientras se decide Q-29.
INSERT INTO tenant_capabilities (tenant_id, capability, enabled, source, changed_at)
SELECT t.id, c.capability, true, 'PLAN', now()
FROM tenants t
CROSS JOIN unnest(ARRAY[
  'pos.counter','pos.offline','pos.customer_display','pos.house_credit','pos.loyalty','pos.tables',
  'pos.kitchen_display','pos.split_bill','pos.weighed_items',
  'orders.marketplace','orders.quotes','orders.b2b',
  'appointments.calendar','appointments.queue','appointments.online_booking',
  'catalog.products','catalog.services','catalog.variants','catalog.modifiers','catalog.listing','catalog.price_lists',
  'inventory.stock','inventory.lots','inventory.transfers','inventory.purchasing','inventory.recipes',
  'logistics.own_fleet','logistics.carriers','logistics.geofences','logistics.fleet','logistics.freight','logistics.routes',
  'finance.payments','finance.terminals','finance.settlement','finance.fiscal',
  'payroll.attendance','payroll.kiosk','payroll.runs','payroll.tips_distribution',
  'analytics.dashboards','analytics.ask','analytics.forecast','analytics.export'
]) AS c(capability)
WHERE NOT EXISTS (SELECT 1 FROM tenant_capabilities tc WHERE tc.tenant_id = t.id)
ON CONFLICT (tenant_id, capability) DO NOTHING;

ALTER TABLE verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS verticals_tenencia ON verticals;
CREATE POLICY verticals_tenencia ON verticals
  FOR SELECT USING (true);

DROP POLICY IF EXISTS tenant_capabilities_tenencia ON tenant_capabilities;
CREATE POLICY tenant_capabilities_tenencia ON tenant_capabilities
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '__sin_tenant__')
    OR EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = tenant_capabilities.tenant_id
        AND t.owner_id::text = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '__sin_tenant__')
    OR EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = tenant_capabilities.tenant_id
        AND t.owner_id::text = current_setting('app.user_id', true)
    )
  );

GRANT SELECT ON identity.verticals TO identity_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.tenant_capabilities TO identity_svc;

COMMIT;
