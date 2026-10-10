-- ============================================
-- BI Fase 1.5 — Vistas materializadas Inventario y Créditos
-- ============================================
-- Spec: docs/superpowers/specs/2026-05-10-bi-module-design.md
--
-- Añade dos vistas para los dashboards /dashboard/bi/inventario y
-- /dashboard/bi/creditos. Se refrescan junto con las del MVP en
-- la función refresh_bi_views() (extendida abajo).
-- ============================================

-- 1) mv_bi_inventory_snapshot
-- Una fila por SKU activo del cliente. Cruza Product con
-- invoice_items emitidos para calcular ventas y rotación recientes.
DROP MATERIALIZED VIEW IF EXISTS "mv_bi_inventory_snapshot";
CREATE MATERIALIZED VIEW "mv_bi_inventory_snapshot" AS
WITH sales_30d AS (
    SELECT
        ii."productId" AS product_id,
        i."clientId"   AS client_id,
        SUM(ii."quantity")::numeric(14,4) AS units_sold_30d,
        SUM(ii."total")::numeric(14,2)    AS sales_30d,
        MAX(i."issueDate")                AS last_sold_at
    FROM "invoice_items" ii
    JOIN "invoices" i ON i."id" = ii."invoiceId"
    WHERE i."status" IN ('EMITTED', 'CERTIFIED', 'INTERNAL')
      AND i."documentType" = 'FACTURA'
      AND i."issueDate" >= NOW() - INTERVAL '30 days'
      AND ii."productId" IS NOT NULL
    GROUP BY ii."productId", i."clientId"
)
SELECT
    p."clientId"                                                  AS client_id,
    p."id"                                                        AS product_id,
    p."sku"                                                       AS sku,
    p."name"                                                      AS name,
    p."category"                                                  AS category,
    p."currentStock"                                              AS current_stock,
    p."minStock"                                                  AS min_stock,
    p."salePrice"                                                 AS sale_price,
    p."purchasePrice"                                             AS purchase_price,
    (p."currentStock" * p."purchasePrice")::numeric(14,2)         AS inventory_value,
    COALESCE(s.units_sold_30d, 0)                                 AS units_sold_30d,
    COALESCE(s.sales_30d, 0)                                      AS sales_30d,
    s.last_sold_at                                                AS last_sold_at,
    CASE
        WHEN s.last_sold_at IS NULL THEN NULL
        ELSE EXTRACT(DAY FROM NOW() - s.last_sold_at)::int
    END                                                           AS days_since_last_sale,
    -- estados derivados (computados aquí para no repetir lógica en cada dashboard)
    CASE WHEN p."currentStock" <= p."minStock" THEN true ELSE false END AS is_low_stock,
    CASE
        WHEN COALESCE(s.units_sold_30d, 0) = 0 AND p."currentStock" > 0 THEN true
        ELSE false
    END                                                           AS is_dead_stock
FROM "products" p
LEFT JOIN sales_30d s ON s.product_id = p."id" AND s.client_id = p."clientId"
WHERE p."isActive" = true AND p."deletedAt" IS NULL;

CREATE UNIQUE INDEX "mv_bi_inventory_snapshot_pk_idx"
    ON "mv_bi_inventory_snapshot"(client_id, product_id);
CREATE INDEX "mv_bi_inventory_snapshot_value_idx"
    ON "mv_bi_inventory_snapshot"(client_id, inventory_value DESC);
CREATE INDEX "mv_bi_inventory_snapshot_low_idx"
    ON "mv_bi_inventory_snapshot"(client_id, is_low_stock);
CREATE INDEX "mv_bi_inventory_snapshot_dead_idx"
    ON "mv_bi_inventory_snapshot"(client_id, is_dead_stock);


-- 2) mv_bi_credit_aging
-- Una fila por entidad CLIENT del Motor con creditLimitCents > 0.
-- Trae el último runningBalanceCents (o 0 si nunca tuvo movimientos).
DROP MATERIALIZED VIEW IF EXISTS "mv_bi_credit_aging";
CREATE MATERIALIZED VIEW "mv_bi_credit_aging" AS
WITH last_entry AS (
    SELECT DISTINCT ON ("entityId")
        "entityId"            AS entity_id,
        "runningBalanceCents" AS balance_cents,
        "createdAt"           AS last_movement_at
    FROM "motor_ledger_entries"
    ORDER BY "entityId", "createdAt" DESC
)
SELECT
    e."clientId"                                                            AS client_id,
    e."id"                                                                  AS entity_id,
    e."displayName"                                                         AS name,
    e."documentNumber"                                                      AS document,
    COALESCE(e."creditLimitCents", 0::bigint)                               AS credit_limit_cents,
    COALESCE(le.balance_cents, 0::bigint)                                   AS current_balance_cents,
    CASE
        WHEN COALESCE(e."creditLimitCents", 0) > 0
        THEN ROUND((COALESCE(le.balance_cents, 0)::numeric / e."creditLimitCents"::numeric) * 100, 2)
        ELSE 0
    END                                                                     AS utilization_pct,
    le.last_movement_at                                                     AS last_movement_at,
    CASE
        WHEN le.last_movement_at IS NULL THEN NULL
        ELSE EXTRACT(DAY FROM NOW() - le.last_movement_at)::int
    END                                                                     AS days_since_last_movement,
    e."paymentDueAt"                                                        AS payment_due_at,
    CASE
        WHEN e."paymentDueAt" IS NOT NULL AND e."paymentDueAt" < NOW() THEN true
        ELSE false
    END                                                                     AS is_overdue,
    CASE
        WHEN COALESCE(le.balance_cents, 0) > COALESCE(e."creditLimitCents", 0) THEN 'OVER_LIMIT'
        WHEN e."paymentDueAt" IS NOT NULL AND e."paymentDueAt" < NOW() THEN 'OVERDUE'
        WHEN COALESCE(e."creditLimitCents", 0) > 0
             AND (COALESCE(le.balance_cents, 0)::numeric / e."creditLimitCents"::numeric) >= 0.8
        THEN 'WARNING'
        ELSE 'HEALTHY'
    END                                                                     AS status
FROM "motor_entities" e
LEFT JOIN last_entry le ON le.entity_id = e."id"
WHERE e."deletedAt" IS NULL
  AND e."kind" = 'CLIENT'
  AND COALESCE(e."creditLimitCents", 0) > 0;

CREATE UNIQUE INDEX "mv_bi_credit_aging_pk_idx"
    ON "mv_bi_credit_aging"(client_id, entity_id);
CREATE INDEX "mv_bi_credit_aging_status_idx"
    ON "mv_bi_credit_aging"(client_id, status);
CREATE INDEX "mv_bi_credit_aging_balance_idx"
    ON "mv_bi_credit_aging"(client_id, current_balance_cents DESC);


-- 3) Extender refresh_bi_views() para incluir las dos nuevas
CREATE OR REPLACE FUNCTION refresh_bi_views() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_bi_sales_daily";
    REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_bi_product_performance";
    REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_bi_customer_summary";
    REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_bi_inventory_snapshot";
    REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_bi_credit_aging";
END;
$$ LANGUAGE plpgsql;
