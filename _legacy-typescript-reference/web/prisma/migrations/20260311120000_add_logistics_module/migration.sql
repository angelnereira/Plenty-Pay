-- ============================================================
-- Migration: Add Logistics Module (Órdenes de Entrega)
-- Timestamp: 20260311120000
-- ============================================================

-- 1. Add logisticsEnabled flag to clients
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "logisticsEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create carriers table
CREATE TABLE IF NOT EXISTS "carriers" (
    "id"         TEXT NOT NULL,
    "client_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "ruc"        TEXT,
    "phone"      TEXT,
    "email"      TEXT,
    "is_active"  BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- 3. Create drivers table
CREATE TABLE IF NOT EXISTS "drivers" (
    "id"         TEXT NOT NULL,
    "client_id"  TEXT NOT NULL,
    "carrier_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name"  TEXT NOT NULL,
    "phone"      TEXT,
    "license_no" TEXT,
    "is_active"  BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- 4. Create DeliveryOrderStatus enum
DO $$ BEGIN
    CREATE TYPE "DeliveryOrderStatus" AS ENUM (
        'DRAFT', 'PENDING', 'IN_PICKING', 'READY_TO_SHIP',
        'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Create OriginModeType enum
DO $$ BEGIN
    CREATE TYPE "OriginModeType" AS ENUM ('DIRECT', 'FROM_INVOICE', 'FROM_POS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Create delivery_orders table
CREATE TABLE IF NOT EXISTS "delivery_orders" (
    "id"                  TEXT NOT NULL,
    "client_id"           TEXT NOT NULL,
    "code"                TEXT NOT NULL,
    "status"              "DeliveryOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "origin_mode"         "OriginModeType" NOT NULL DEFAULT 'DIRECT',
    "linked_invoice_id"   TEXT,
    "linked_pos_id"       TEXT,
    "customer_name"       TEXT NOT NULL,
    "customer_phone"      TEXT,
    "customer_email"      TEXT,
    "delivery_address"    JSONB,
    "carrier_id"          TEXT,
    "driver_id"           TEXT,
    "scheduled_date"      TIMESTAMP(3),
    "estimated_date"      TIMESTAMP(3),
    "delivered_at"        TIMESTAMP(3),
    "emit_invoice"        BOOLEAN NOT NULL DEFAULT FALSE,
    "subtotal"            DECIMAL(12,2),
    "tax_amount"          DECIMAL(12,2),
    "total_amount"        DECIMAL(12,2),
    "inventory_deducted"  BOOLEAN NOT NULL DEFAULT FALSE,
    "pdf_url"             TEXT,
    "qr_token"            TEXT,
    "notes"               TEXT,
    "internal_notes"      TEXT,
    "created_by_id"       TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "delivery_orders_pkey" PRIMARY KEY ("id")
);

-- 7. Create delivery_order_items table
CREATE TABLE IF NOT EXISTS "delivery_order_items" (
    "id"                TEXT NOT NULL,
    "delivery_order_id" TEXT NOT NULL,
    "product_id"        TEXT,
    "description"       TEXT NOT NULL,
    "quantity"          DECIMAL(12,4) NOT NULL,
    "unit_price"        DECIMAL(12,2),
    "tax_rate"          DECIMAL(5,4),
    "tax_amount"        DECIMAL(12,2),
    "line_total"        DECIMAL(12,2),
    CONSTRAINT "delivery_order_items_pkey" PRIMARY KEY ("id")
);

-- 8. Create delivery_order_status_history table
CREATE TABLE IF NOT EXISTS "delivery_order_status_history" (
    "id"                TEXT NOT NULL,
    "delivery_order_id" TEXT NOT NULL,
    "from_status"       "DeliveryOrderStatus",
    "to_status"         "DeliveryOrderStatus" NOT NULL,
    "notes"             TEXT,
    "changed_by_id"     TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delivery_order_status_history_pkey" PRIMARY KEY ("id")
);

-- 9. Unique and index constraints
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_orders_client_id_code_key"
    ON "delivery_orders"("client_id", "code");

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_orders_qr_token_key"
    ON "delivery_orders"("qr_token");

CREATE INDEX IF NOT EXISTS "carriers_client_id_idx"          ON "carriers"("client_id");
CREATE INDEX IF NOT EXISTS "drivers_client_id_idx"           ON "drivers"("client_id");
CREATE INDEX IF NOT EXISTS "drivers_carrier_id_idx"          ON "drivers"("carrier_id");
CREATE INDEX IF NOT EXISTS "delivery_orders_client_id_idx"   ON "delivery_orders"("client_id");
CREATE INDEX IF NOT EXISTS "delivery_orders_status_idx"      ON "delivery_orders"("status");
CREATE INDEX IF NOT EXISTS "delivery_orders_invoice_id_idx"  ON "delivery_orders"("linked_invoice_id");
CREATE INDEX IF NOT EXISTS "delivery_orders_qr_token_idx"    ON "delivery_orders"("qr_token");
CREATE INDEX IF NOT EXISTS "delivery_order_items_order_idx"  ON "delivery_order_items"("delivery_order_id");
CREATE INDEX IF NOT EXISTS "delivery_order_history_order_idx" ON "delivery_order_status_history"("delivery_order_id");

-- 10. Foreign key constraints
ALTER TABLE "carriers"
    ADD CONSTRAINT "carriers_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;

ALTER TABLE "drivers"
    ADD CONSTRAINT "drivers_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;

ALTER TABLE "drivers"
    ADD CONSTRAINT "drivers_carrier_id_fkey"
    FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE SET NULL;

ALTER TABLE "delivery_orders"
    ADD CONSTRAINT "delivery_orders_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;

ALTER TABLE "delivery_orders"
    ADD CONSTRAINT "delivery_orders_carrier_id_fkey"
    FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE SET NULL;

ALTER TABLE "delivery_orders"
    ADD CONSTRAINT "delivery_orders_driver_id_fkey"
    FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL;

ALTER TABLE "delivery_order_items"
    ADD CONSTRAINT "delivery_order_items_delivery_order_id_fkey"
    FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE CASCADE;

ALTER TABLE "delivery_order_status_history"
    ADD CONSTRAINT "delivery_order_status_history_delivery_order_id_fkey"
    FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE CASCADE;
