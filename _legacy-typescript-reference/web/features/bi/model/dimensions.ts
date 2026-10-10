/**
 * Catálogo único de dimensiones del BI.
 *
 * Una dimensión es un eje de agrupación: día, semana, mes, producto,
 * cliente. La UI las arrastra al builder, el QueryService las traduce
 * a `GROUP BY` SQL.
 */

import type { BISource, DimensionId } from "./types/bi.types";

export type DimensionType = "date" | "string" | "number";

export interface DimensionSpec {
    readonly id: DimensionId;
    readonly label: string;
    readonly type: DimensionType;
    readonly column: string;
    /** Si la columna requiere wrapping (ej. DATE_TRUNC) cuando se agrupa. */
    readonly groupExpr?: (column: string) => string;
    readonly sources: readonly BISource[];
}

export const DIMENSIONS: Record<DimensionId, DimensionSpec> = {
    day: {
        id: "day",
        label: "Día",
        type: "date",
        column: "day",
        sources: ["mv_bi_sales_daily"],
    },
    week: {
        id: "week",
        label: "Semana",
        type: "date",
        column: "day",
        groupExpr: (col) => `DATE_TRUNC('week', ${col})::date`,
        sources: ["mv_bi_sales_daily"],
    },
    month: {
        id: "month",
        label: "Mes",
        type: "date",
        column: "day",
        groupExpr: (col) => `DATE_TRUNC('month', ${col})::date`,
        sources: ["mv_bi_sales_daily"],
    },
    product: {
        id: "product",
        label: "Producto",
        type: "string",
        column: "code",
        sources: ["mv_bi_product_performance"],
    },
    customer: {
        id: "customer",
        label: "Cliente",
        type: "string",
        column: "name",
        sources: ["mv_bi_customer_summary"],
    },
};

export const DIMENSION_IDS: readonly DimensionId[] = Object.keys(DIMENSIONS) as DimensionId[];

export function isDimensionId(value: string): value is DimensionId {
    return value in DIMENSIONS;
}
