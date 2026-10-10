/**
 * Catálogo único de medidas (measures) del BI.
 *
 * Cada medida declara:
 *   - id           : identificador estable usado en el DSL y en URLs
 *   - label        : texto en español para mostrar en UI
 *   - unit         : currency | count | percentage — la UI elige el formateador
 *   - column       : nombre de la columna en la vista materializada
 *   - aggregator   : SUM | AVG | COUNT | DERIVED — DERIVED se computa post-SQL
 *   - sources      : qué vistas materializadas exponen esta medida
 *
 * NUNCA hardcodear nombres de columnas en otros archivos — siempre via
 * MEASURES[id].column.
 */

import type { BISource, MeasureId } from "./types/bi.types";

export type MeasureUnit = "currency" | "count" | "percentage";
export type MeasureAggregator = "SUM" | "AVG" | "COUNT" | "DERIVED";

export interface MeasureSpec {
    readonly id: MeasureId;
    readonly label: string;
    readonly unit: MeasureUnit;
    readonly column: string;
    readonly aggregator: MeasureAggregator;
    readonly sources: readonly BISource[];
    /** Si DERIVED, función que computa la medida sobre la fila ya cargada. */
    readonly derive?: (row: Record<string, unknown>) => number;
}

export const MEASURES: Record<MeasureId, MeasureSpec> = {
    sales_total: {
        id: "sales_total",
        label: "Ventas",
        unit: "currency",
        column: "total_sales",
        aggregator: "SUM",
        sources: ["mv_bi_sales_daily"],
    },
    sales_subtotal: {
        id: "sales_subtotal",
        label: "Subtotal",
        unit: "currency",
        column: "total_subtotal",
        aggregator: "SUM",
        sources: ["mv_bi_sales_daily"],
    },
    invoice_count: {
        id: "invoice_count",
        label: "Facturas",
        unit: "count",
        column: "total_invoices",
        aggregator: "SUM",
        sources: ["mv_bi_sales_daily", "mv_bi_customer_summary"],
    },
    ticket_avg: {
        id: "ticket_avg",
        label: "Ticket promedio",
        unit: "currency",
        column: "ticket_avg",
        aggregator: "DERIVED",
        sources: ["mv_bi_sales_daily", "mv_bi_customer_summary"],
        // Se reagrega al consolidar: Σtotal / Σfacturas
        derive: (row) => {
            const total = Number(row.total_sales ?? row.total_spent ?? 0);
            const count = Number(row.total_invoices ?? 0);
            return count === 0 ? 0 : total / count;
        },
    },
    units_sold: {
        id: "units_sold",
        label: "Unidades vendidas",
        unit: "count",
        column: "units_sold",
        aggregator: "SUM",
        sources: ["mv_bi_product_performance"],
    },
    gross_sales: {
        id: "gross_sales",
        label: "Ventas brutas (por línea)",
        unit: "currency",
        column: "gross_sales",
        aggregator: "SUM",
        sources: ["mv_bi_product_performance"],
    },
    discounts: {
        id: "discounts",
        label: "Descuentos",
        unit: "currency",
        column: "total_discount",
        aggregator: "SUM",
        sources: ["mv_bi_sales_daily", "mv_bi_product_performance"],
    },
    unique_customers: {
        id: "unique_customers",
        label: "Clientes únicos",
        unit: "count",
        // En mv_bi_customer_summary cada fila YA es un cliente único, contamos filas
        column: "customer_id",
        aggregator: "COUNT",
        sources: ["mv_bi_customer_summary"],
    },
};

export const MEASURE_IDS: readonly MeasureId[] = Object.keys(MEASURES) as MeasureId[];

export function isMeasureId(value: string): value is MeasureId {
    return value in MEASURES;
}
