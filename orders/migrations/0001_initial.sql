CREATE SCHEMA IF NOT EXISTS orders;

CREATE TABLE orders.carts (
  user_id uuid PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders.cart_items (
  user_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  qty_milli bigint NOT NULL CHECK (qty_milli > 0),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE orders.orders (
  id uuid PRIMARY KEY,
  buyer_user_id uuid NOT NULL,
  status smallint NOT NULL,
  currency char(3) NOT NULL,
  items_minor bigint NOT NULL,
  shipping_minor bigint NOT NULL,
  discount_minor bigint NOT NULL,
  total_minor bigint NOT NULL,
  payment_intent_id uuid,
  delivery_address jsonb,
  contact_phone text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  UNIQUE (buyer_user_id, idempotency_key)
);

CREATE TABLE orders.sub_orders (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  status smallint NOT NULL,
  fulfillment text NOT NULL CHECK (fulfillment IN ('DELIVERY','PICKUP')),
  lines jsonb NOT NULL,
  items_minor bigint NOT NULL,
  shipping_minor bigint NOT NULL,
  total_minor bigint NOT NULL,
  reservation_ids uuid[] NOT NULL DEFAULT '{}',
  delivery_id uuid,
  invoice_id uuid,
  refund_id uuid,
  accept_deadline timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1
);
CREATE INDEX sub_orders_tenant_status ON orders.sub_orders (tenant_id, status, created_at DESC);
CREATE INDEX sub_orders_accept_deadline ON orders.sub_orders (accept_deadline) WHERE status = 2;

CREATE TABLE orders.outbox (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
