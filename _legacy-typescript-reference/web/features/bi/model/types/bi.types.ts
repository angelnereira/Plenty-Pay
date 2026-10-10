/**
 * Tipos del DSL del módulo BI.
 *
 * El DSL es la abstracción que aísla a la UI del SQL: la UI dice
 * "quiero estas medidas, agrupadas por estas dimensiones, con estos
 * filtros, en este rango de fechas" y el QueryService decide qué vista
 * materializada consultar y cómo.
 *
 * Spec completo: docs/superpowers/specs/2026-05-10-bi-module-design.md
 */

// ============================================
// IDs canónicos
// ============================================

export type MeasureId =
    | "sales_total"      // Σ total facturado
    | "sales_subtotal"   // Σ subtotal antes de impuestos
    | "invoice_count"    // # de facturas/transacciones
    | "ticket_avg"       // ventas / # facturas
    | "units_sold"       // Σ cantidad de items vendidos
    | "gross_sales"      // Σ total por línea de item
    | "discounts"        // Σ descuentos
    | "unique_customers"; // # de clientes distintos

export type DimensionId =
    | "day"
    | "week"
    | "month"
    | "product"
    | "customer";

export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "between";

export interface BIFilter {
    field: DimensionId | MeasureId | "issueDate";
    op: FilterOp;
    value: string | number | string[] | number[] | { from: string; to: string };
}

export interface BIDateRange {
    from: string; // ISO date "YYYY-MM-DD"
    to: string;   // ISO date "YYYY-MM-DD"
}

export interface BIQuery {
    measures: MeasureId[];
    dimensions?: DimensionId[];
    filters?: BIFilter[];
    dateRange?: BIDateRange;
    sortBy?: { field: MeasureId | DimensionId; direction: "asc" | "desc" };
    limit?: number;
}

export interface BIQueryResult {
    rows: Array<Record<string, string | number | null>>;
    meta: {
        totalRows: number;
        executedAt: string;
        source: BISource;
        cacheHit: boolean;
    };
}

// ============================================
// Vistas materializadas (source enum interno)
// ============================================

export type BISource =
    | "mv_bi_sales_daily"
    | "mv_bi_product_performance"
    | "mv_bi_customer_summary";

// ============================================
// Errores tipados
// ============================================

export class BIQueryError extends Error {
    constructor(message: string, public readonly code: BIQueryErrorCode) {
        super(message);
        this.name = "BIQueryError";
    }
}

export type BIQueryErrorCode =
    | "INVALID_MEASURE"
    | "INVALID_DIMENSION"
    | "INCOMPATIBLE_COMBO"
    | "INVALID_FILTER"
    | "INVALID_DATE_RANGE"
    | "MISSING_CLIENT";
