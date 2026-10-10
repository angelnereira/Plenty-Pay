-- ============================================
-- BI Essential — Fase 1 (addons + alertas + vistas materializadas)
-- ============================================
-- Spec: docs/superpowers/specs/2026-05-10-bi-module-design.md
-- Plan: docs/superpowers/plans/2026-05-10-bi-module.md
--
-- Cambios:
--   1. Flags Client.biEnabled / Client.biProEnabled
--   2. Tabla bi_alerts + enum BIAlertKind
--   3. Tres vistas materializadas:
--      - mv_bi_sales_daily         (ventas por cliente × día)
--      - mv_bi_product_performance (desempeño por SKU)
--      - mv_bi_customer_summary    (resumen por comprador)
--   4. Función refresh_bi_views() para invocar desde el cron
--      `/api/cron/bi-refresh` (Tarea 6 del plan).
--
-- Nota: las vistas filtran Invoice.status IN ('EMITTED','CERTIFIED','INTERNAL')
-- para incluir tanto facturas certificadas DGI como ventas POS internas.
-- ============================================

-- 1) Enum BIAlertKind
DO $$ BEGIN
    CREATE TYPE "BIAlertKind" AS ENUM ('THRESHOLD', 'ANOMALY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2) Flags en clients
ALTER TABLE "clients"
    ADD COLUMN IF NOT EXISTS "biEnabled"    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "biProEnabled" BOOLEAN NOT NULL DEFAULT false;

-- 3) Tabla bi_alerts
CREATE TABLE IF NOT EXISTS "bi_alerts" (
    "id"          TEXT          NOT NULL,
    "clientId"    TEXT          NOT NULL,
    "name"        TEXT          NOT NULL,
    "kind"        "BIAlertKind" NOT NULL DEFAULT 'THRESHOLD',
    "config"      JSONB         NOT NULL,
    "isActive"    BOOLEAN       NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "bi_alerts_pkey"    PRIMARY KEY ("id"),
    CONSTRAINT "bi_alerts_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "clients"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "bi_alerts_clientId_isActive_idx"
    ON "bi_alerts"("clientId", "isActive");

-- ============================================
-- 4) VISTAS MATERIALIZADAS
-- ============================================

-- 4.1 Ventas por cliente × día
DROP MATERIALIZED VIEW IF EXISTS "mv_bi_sales_daily";
CREATE MATERIALIZED VIEW "mv_bi_sales_daily" AS
SELECT
    i."clientId"                                                  AS client_id,
    DATE_TRUNC('day', i."issueDate")::date                        AS day,
    COUNT(*)::bigint                                              AS total_invoices,
    COALESCE(SUM(i."total"), 0)::numeric(14,2)                    AS total_sales,
    COALESCE(SUM(i."subtotal"), 0)::numeric(14,2)                 AS total_subtotal,
    COALESCE(SUM(i."discount"), 0)::numeric(14,2)                 AS total_discount,
    COALESCE(SUM(i."itbms"), 0)::numeric(14,2)                    AS total_tax,
    CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE (COALESCE(SUM(i."total"), 0) / COUNT(*))::numeric(14,2)
    END                                                           AS ticket_avg
FROM "invoices" i
WHERE i."status" IN ('EMITTED', 'CERTIFIED', 'INTERNAL')
  AND i."documentType" = 'FACTURA'
GROUP BY i."clientId", DATE_TRUNC('day', i."issueDate")::date;

CREATE UNIQUE INDEX "mv_bi_sales_daily_pk_idx"
    ON "mv_bi_sales_daily"(client_id, day);
CREATE INDEX "mv_bi_sales_daily_day_idx"
    ON "mv_bi_sales_daily"(day DESC);


-- 4.2 Desempeño por producto/SKU (mes en curso + histórico agregado)
DROP MATERIALIZED VIEW IF EXISTS "mv_bi_product_performance";
CREATE MATERIALIZED VIEW "mv_bi_product_performance" AS
SELECT
    i."clientId"                                       AS client_id,
    ii."productId"                                     AS product_id,
    ii."code"                                          AS code,
    -- description tomamos la más reciente
    (ARRAY_AGG(ii."description" ORDER BY i."issueDate" DESC))[1] AS description,
    COALESCE(SUM(ii."quantity"), 0)::numeric(14,4)     AS units_sold,
    COALESCE(SUM(ii."total"), 0)::numeric(14,2)        AS gross_sales,
    COALESCE(SUM(ii."discount"), 0)::numeric(14,2)     AS total_discount,
    COUNT(DISTINCT i."id")::bigint                     AS invoice_count,
    MAX(i."issueDate")                                 AS last_sold_at,
    MIN(i."issueDate")                                 AS first_sold_at
FROM "invoice_items" ii
JOIN "invoices" i ON i."id" = ii."invoiceId"
WHERE i."status" IN ('EMITTED', 'CERTIFIED', 'INTERNAL')
  AND i."documentType" = 'FACTURA'
GROUP BY i."clientId", ii."productId", ii."code";

-- product_id puede ser NULL (línea libre sin SKU); compuesto con code para garantizar unicidad
CREATE UNIQUE INDEX "mv_bi_product_performance_pk_idx"
    ON "mv_bi_product_performance"(
        client_id,
        COALESCE(product_id, ''),
        code
    );
CREATE INDEX "mv_bi_product_performance_sales_idx"
    ON "mv_bi_product_performance"(client_id, gross_sales DESC);


-- 4.3 Resumen por cliente comprador
DROP MATERIALIZED VIEW IF EXISTS "mv_bi_customer_summary";
CREATE MATERIALIZED VIEW "mv_bi_customer_summary" AS
SELECT
    i."clientId"                                       AS client_id,
    i."customerId"                                     AS customer_id,
    -- usamos receiverName del último doc (más actualizado que customer.name)
    (ARRAY_AGG(i."receiverName" ORDER BY i."issueDate" DESC))[1] AS name,
    COUNT(*)::bigint                                   AS total_invoices,
    COALESCE(SUM(i."total"), 0)::numeric(14,2)         AS total_spent,
    CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE (COALESCE(SUM(i."total"), 0) / COUNT(*))::numeric(14,2)
    END                                                AS ticket_avg,
    MAX(i."issueDate")                                 AS last_purchase_at,
    MIN(i."issueDate")                                 AS first_purchase_at
FROM "invoices" i
WHERE i."status" IN ('EMITTED', 'CERTIFIED', 'INTERNAL')
  AND i."documentType" = 'FACTURA'
GROUP BY i."clientId", i."customerId";

CREATE UNIQUE INDEX "mv_bi_customer_summary_pk_idx"
    ON "mv_bi_customer_summary"(
        client_id,
        COALESCE(customer_id, '__anon__')
    );
CREATE INDEX "mv_bi_customer_summary_spent_idx"
    ON "mv_bi_customer_summary"(client_id, total_spent DESC);


-- ============================================
-- 5) Función helper para refresh desde el cron
-- ============================================
CREATE OR REPLACE FUNCTION refresh_bi_views() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_bi_sales_daily";
    REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_bi_product_performance";
    REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_bi_customer_summary";
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_bi_views() IS
  'Refresca las vistas materializadas del módulo BI. Invocar desde el cron /api/cron/bi-refresh.';
