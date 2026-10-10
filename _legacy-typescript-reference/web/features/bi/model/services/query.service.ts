/**
 * QueryService — traduce un BIQuery (DSL) a SQL parametrizado y lo ejecuta.
 *
 * Reglas de seguridad CRÍTICAS:
 *   - El clientId SIEMPRE viene del contexto del servidor (sesión), nunca del body.
 *   - measures, dimensions, sortBy: solo se aceptan IDs de los catálogos
 *     MEASURES/DIMENSIONS — nunca interpolar input crudo en el SQL.
 *   - Filtros: los valores van como parámetros de consulta ($1, $2, ...);
 *     los nombres de campo se whitelist contra los catálogos.
 *
 * Spec: docs/superpowers/specs/2026-05-10-bi-module-design.md (sección 3.3)
 */

import { prisma } from "@core/database";
import { DIMENSIONS, isDimensionId } from "../dimensions";
import { MEASURES, isMeasureId } from "../measures";
import {
    BIQueryError,
    type BIQuery,
    type BIQueryResult,
    type BISource,
    type DimensionId,
    type MeasureId,
} from "../types/bi.types";

interface QueryContext {
    clientId: string;
}

interface ResolvedQuery {
    source: BISource;
    sql: string;
    params: unknown[];
    derivedMeasures: MeasureId[];
}

export class BIQueryService {
    async run(query: BIQuery, ctx: QueryContext): Promise<BIQueryResult> {
        if (!ctx.clientId) {
            throw new BIQueryError("clientId requerido", "MISSING_CLIENT");
        }
        this.validate(query);

        const resolved = this.resolve(query, ctx);
        let rawRows: Array<Record<string, unknown>>;
        try {
            rawRows = (await prisma.$queryRawUnsafe(
                resolved.sql,
                ...resolved.params,
            )) as Array<Record<string, unknown>>;
        } catch (err) {
            // PG code 42P01 = undefined_table — la vista materializada no
            // existe aún (caso típico: build de Vercel usó db push y el
            // bootstrap de vistas todavía no corrió en este ambiente).
            // Devolvemos vacío con flag para que la UI muestre empty-state
            // útil en lugar de crashear el dashboard entero.
            if (isMissingRelationError(err)) {
                console.warn(
                    `[BI] vista materializada "${resolved.source}" no existe — devolviendo vacío. ` +
                    `Corre "node scripts/apply-bi-views.js" o redeploy para crearla.`,
                );
                return {
                    rows: [],
                    meta: {
                        totalRows: 0,
                        executedAt: new Date().toISOString(),
                        source: resolved.source,
                        cacheHit: false,
                    },
                };
            }
            throw err;
        }

        const rows = this.applyDerivedMeasures(rawRows, resolved.derivedMeasures);

        return {
            rows: rows as BIQueryResult["rows"],
            meta: {
                totalRows: rows.length,
                executedAt: new Date().toISOString(),
                source: resolved.source,
                cacheHit: false,
            },
        };
    }

    // -----------------------------------------------------------------
    // Validación
    // -----------------------------------------------------------------

    private validate(query: BIQuery): void {
        if (!query.measures || query.measures.length === 0) {
            throw new BIQueryError("Debe pedir al menos una medida", "INVALID_MEASURE");
        }
        for (const m of query.measures) {
            if (!isMeasureId(m)) {
                throw new BIQueryError(`Medida desconocida: ${m}`, "INVALID_MEASURE");
            }
        }
        for (const d of query.dimensions ?? []) {
            if (!isDimensionId(d)) {
                throw new BIQueryError(`Dimensión desconocida: ${d}`, "INVALID_DIMENSION");
            }
        }
        if (query.dateRange) {
            const { from, to } = query.dateRange;
            if (!isISODate(from) || !isISODate(to)) {
                throw new BIQueryError("dateRange.from/to debe ser YYYY-MM-DD", "INVALID_DATE_RANGE");
            }
            if (from > to) {
                throw new BIQueryError("dateRange.from > dateRange.to", "INVALID_DATE_RANGE");
            }
        }
    }

    // -----------------------------------------------------------------
    // Resolución: medida + dimensión → vista materializada + SQL
    // -----------------------------------------------------------------

    private resolve(query: BIQuery, ctx: QueryContext): ResolvedQuery {
        const source = this.pickSource(query);

        const dimensions = query.dimensions ?? [];
        const measures = query.measures;

        // Medidas que no se calculan en SQL — se aplican post-fetch
        const derivedMeasures = measures.filter(
            (m) => MEASURES[m].aggregator === "DERIVED",
        );

        // Columnas dimensionales del SELECT (con groupExpr cuando aplique)
        const selectDims = dimensions.map((dimId) => {
            const dim = DIMENSIONS[dimId];
            const expr = dim.groupExpr ? dim.groupExpr(quoteIdent(dim.column)) : quoteIdent(dim.column);
            return `${expr} AS ${quoteIdent(dimId)}`;
        });

        // Columnas de medidas del SELECT (saltamos DERIVED — necesitan sus inputs base)
        const selectMeasures: string[] = [];
        const seenColumns = new Set<string>();
        for (const measureId of measures) {
            const measure = MEASURES[measureId];
            if (measure.aggregator === "DERIVED") {
                // Las DERIVED necesitan los campos base presentes — los pedimos crudos
                if (!seenColumns.has("total_sales")) {
                    selectMeasures.push(`SUM(${quoteIdent("total_sales")}) AS ${quoteIdent("total_sales")}`);
                    seenColumns.add("total_sales");
                }
                if (!seenColumns.has("total_invoices")) {
                    selectMeasures.push(`SUM(${quoteIdent("total_invoices")}) AS ${quoteIdent("total_invoices")}`);
                    seenColumns.add("total_invoices");
                }
                continue;
            }
            if (seenColumns.has(measureId)) continue;
            const aggSql = aggregatorSql(measure.aggregator, quoteIdent(measure.column));
            selectMeasures.push(`${aggSql} AS ${quoteIdent(measureId)}`);
            seenColumns.add(measureId);
        }

        const params: unknown[] = [ctx.clientId];
        const where: string[] = [`${quoteIdent("client_id")} = $1`];

        // Filtro de rango de fechas (solo aplica si la fuente tiene columna day)
        if (query.dateRange && sourceHasDayColumn(source)) {
            params.push(query.dateRange.from);
            params.push(query.dateRange.to);
            where.push(`${quoteIdent("day")} BETWEEN $${params.length - 1}::date AND $${params.length}::date`);
        }

        const groupBy = selectDims.length > 0
            ? `GROUP BY ${selectDims.map((_, i) => i + 1).join(", ")}`
            : "";

        const orderBy = this.buildOrderBy(query, dimensions, measures);

        const limit = query.limit && query.limit > 0 && query.limit <= 1000
            ? `LIMIT ${query.limit}`
            : "";

        const allSelects = [...selectDims, ...selectMeasures].join(", ");
        const sql = [
            `SELECT ${allSelects || "1"}`,
            `FROM ${quoteIdent(source)}`,
            `WHERE ${where.join(" AND ")}`,
            groupBy,
            orderBy,
            limit,
        ].filter(Boolean).join(" ");

        return { source, sql, params, derivedMeasures };
    }

    private buildOrderBy(query: BIQuery, dims: DimensionId[], measures: MeasureId[]): string {
        if (query.sortBy) {
            const field = query.sortBy.field;
            if (isMeasureId(field) || isDimensionId(field)) {
                const dir = query.sortBy.direction === "asc" ? "ASC" : "DESC";
                return `ORDER BY ${quoteIdent(field)} ${dir} NULLS LAST`;
            }
        }
        // Default: ordenar por primera dimensión asc, o primera medida desc
        if (dims.length > 0) return `ORDER BY ${quoteIdent(dims[0])} ASC`;
        if (measures.length > 0) return `ORDER BY ${quoteIdent(measures[0])} DESC NULLS LAST`;
        return "";
    }

    // -----------------------------------------------------------------
    // Selección de la vista materializada
    // -----------------------------------------------------------------

    private pickSource(query: BIQuery): BISource {
        // Intersección de fuentes que cubren todas las measures + dimensions pedidas
        const candidates: Set<BISource> = new Set([
            "mv_bi_sales_daily",
            "mv_bi_product_performance",
            "mv_bi_customer_summary",
        ]);

        for (const m of query.measures) {
            const sources = new Set(MEASURES[m].sources);
            for (const c of candidates) if (!sources.has(c)) candidates.delete(c);
        }
        for (const d of query.dimensions ?? []) {
            const sources = new Set(DIMENSIONS[d].sources);
            for (const c of candidates) if (!sources.has(c)) candidates.delete(c);
        }

        if (candidates.size === 0) {
            throw new BIQueryError(
                "Combinación de measures/dimensions no soportada en Fase 1",
                "INCOMPATIBLE_COMBO",
            );
        }
        // Preferencia estable: ventas diarias > productos > clientes
        const order: BISource[] = [
            "mv_bi_sales_daily",
            "mv_bi_product_performance",
            "mv_bi_customer_summary",
        ];
        return order.find((s) => candidates.has(s))!;
    }

    // -----------------------------------------------------------------
    // Post-procesamiento de medidas DERIVED
    // -----------------------------------------------------------------

    private applyDerivedMeasures(
        rows: Array<Record<string, unknown>>,
        derived: MeasureId[],
    ): Array<Record<string, unknown>> {
        if (derived.length === 0) return rows;
        return rows.map((row) => {
            const next: Record<string, unknown> = { ...row };
            for (const measureId of derived) {
                const spec = MEASURES[measureId];
                if (spec.derive) next[measureId] = spec.derive(row);
            }
            return next;
        });
    }
}

// =====================================================================
// Helpers
// =====================================================================

function quoteIdent(name: string): string {
    // Whitelist: solo letras, dígitos, _ — los nombres vienen de catálogos internos
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new BIQueryError(`Identificador inválido: ${name}`, "INVALID_FILTER");
    }
    return `"${name}"`;
}

function aggregatorSql(agg: "SUM" | "AVG" | "COUNT" | "DERIVED", colExpr: string): string {
    switch (agg) {
        case "SUM": return `COALESCE(SUM(${colExpr}), 0)`;
        case "AVG": return `COALESCE(AVG(${colExpr}), 0)`;
        case "COUNT": return `COUNT(DISTINCT ${colExpr})`;
        case "DERIVED": throw new Error("DERIVED no se materializa en SQL");
    }
}

function isISODate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function sourceHasDayColumn(source: BISource): boolean {
    return source === "mv_bi_sales_daily";
}

/**
 * True si el error de Prisma corresponde a "relation does not exist"
 * (PG SQLSTATE 42P01). Lo usamos para tolerar ambientes donde aún no
 * se aplicaron las migraciones SQL crudas del módulo BI.
 */
export function isMissingRelationError(err: unknown): boolean {
    if (!err) return false;
    const e = err as { code?: string; meta?: { code?: string }; message?: string };
    if (e.code === "P2010" && e.meta?.code === "42P01") return true; // PrismaClientKnownRequestError
    if (e.code === "42P01") return true; // raw PG error
    return typeof e.message === "string" && /relation .* does not exist/i.test(e.message);
}
