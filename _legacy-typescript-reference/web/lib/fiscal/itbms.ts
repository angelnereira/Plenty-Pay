/**
 * lib/fiscal/itbms.ts
 *
 * Fuente única de verdad para el ITBMS acumulado (impuesto a pagar) que se
 * muestra en el dashboard, la página de facturas y el reporte fiscal.
 *
 * Decisión de diseño (clave para la veracidad fiscal):
 *   El acumulado NO es un contador que se incrementa en cada emisión —eso
 *   podría desfasarse si una emisión falla a medias, se reintenta o se anula—.
 *   Es un AGREGADO DERIVADO (`SUM(itbms)`) calculado siempre desde la tabla
 *   `invoices`. Así cubre automáticamente las facturas históricas y las
 *   futuras, y es imposible que se desfase de la realidad.
 *
 * Reglas del cómputo (confirmadas con el usuario):
 *   - Solo facturas emitidas con ÉXITO fiscal: status EMITTED / CERTIFIED.
 *     (Excluye INTERNAL, DRAFT, PROCESSING, QUEUED, ERROR, REJECTED, CANCELLED).
 *   - Solo documentos de venta (excluye notas de crédito/débito y reembolsos),
 *     para no distorsionar el total con documentos que modifican el impuesto.
 */

import { Prisma, InvoiceStatus, DocumentType } from "@prisma/client";
import { prisma } from "@core/database";

/** Estados que representan una emisión fiscal exitosa (autorizada por HKA/DGI). */
export const SUCCESSFUL_FISCAL_STATUSES: InvoiceStatus[] = [
    InvoiceStatus.EMITTED,
    InvoiceStatus.CERTIFIED,
];

/**
 * Tipos de documento de venta que aportan al ITBMS a pagar.
 * Se excluyen NOTA_CREDITO, NOTA_DEBITO y REEMBOLSO deliberadamente.
 */
export const SALES_DOCUMENT_TYPES: DocumentType[] = [
    DocumentType.FACTURA,
    DocumentType.FACTURA_IMPORTACION,
    DocumentType.FACTURA_EXPORTACION,
    DocumentType.FACTURA_ZONA_FRANCA,
    DocumentType.FACTURA_EXTRANJERA,
];

export interface ItbmsScope {
    clientId: string;
    /** Fecha inicial inclusiva (ISO YYYY-MM-DD). Solo para reportes por periodo. */
    from?: string;
    /** Fecha final inclusiva (ISO YYYY-MM-DD). Solo para reportes por periodo. */
    to?: string;
}

export interface ItbmsMonthRow {
    /** Mes en formato YYYY-MM. */
    month: string;
    /** Cantidad de facturas emitidas en el mes. */
    invoiceCount: number;
    /** Base gravable (suma de subtotales) del mes. */
    taxableBase: number;
    /** ITBMS acumulado del mes. */
    itbms: number;
}

/**
 * WHERE compartido (tipado de Prisma) para las consultas de ITBMS acumulado.
 * Usado por el dashboard y la página de facturas. El filtro de fecha es
 * opcional y se aplica sobre `issueDate`.
 */
function buildItbmsWhere({ clientId, from, to }: ItbmsScope): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {
        clientId,
        status: { in: SUCCESSFUL_FISCAL_STATUSES },
        documentType: { in: SALES_DOCUMENT_TYPES },
    };

    if (from || to) {
        where.issueDate = {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
        };
    }

    return where;
}

/**
 * ITBMS acumulado (impuesto a pagar) de un tenant.
 * Sin `from`/`to` devuelve el acumulado histórico completo.
 * @returns total en número (no Decimal) listo para serializar.
 */
export async function getAccumulatedItbms(scope: ItbmsScope): Promise<number> {
    try {
        const result = await prisma.invoice.aggregate({
            where: buildItbmsWhere(scope),
            _sum: { itbms: true },
        });
        const sum = result?._sum?.itbms;
        return sum ? Number(sum.toString()) : 0;
    } catch (err) {
        // Devolvemos 0 para no romper la vista, pero loguear para detectar problemas de DB.
        console.error('[itbms] getAccumulatedItbms failed:', err);
        return 0;
    }
}

/**
 * Desglose mensual del ITBMS para el reporte fiscal. Agrupa por mes usando la
 * fecha fiscal efectiva: COALESCE(emittedAt, issueDate, createdAt).
 */
export async function getItbmsMonthlyBreakdown(scope: ItbmsScope): Promise<ItbmsMonthRow[]> {
    const { clientId, from, to } = scope;

    const statuses = Prisma.join(SUCCESSFUL_FISCAL_STATUSES.map((s) => Prisma.sql`${s}`));
    const types = Prisma.join(SALES_DOCUMENT_TYPES.map((t) => Prisma.sql`${t}`));

    const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : new Date("1970-01-01T00:00:00.000Z");
    const toDate = to ? new Date(`${to}T23:59:59.999Z`) : new Date("9999-12-31T23:59:59.999Z");

    const rows = await prisma.$queryRaw<
        Array<{ month: string; invoice_count: number; taxable_base: number; itbms: number }>
    >(Prisma.sql`
        SELECT
            to_char(date_trunc('month', COALESCE("emittedAt", "issueDate", "createdAt")), 'YYYY-MM') AS month,
            COUNT(*)::int AS invoice_count,
            COALESCE(SUM("subtotal"), 0)::float8 AS taxable_base,
            COALESCE(SUM("itbms"), 0)::float8 AS itbms
        FROM "invoices"
        WHERE "clientId" = ${clientId}
            AND "status"::text IN (${statuses})
            AND "documentType"::text IN (${types})
            AND COALESCE("emittedAt", "issueDate", "createdAt") >= ${fromDate}
            AND COALESCE("emittedAt", "issueDate", "createdAt") <= ${toDate}
        GROUP BY 1
        ORDER BY 1 ASC
    `);

    return rows.map((r) => ({
        month: r.month,
        invoiceCount: Number(r.invoice_count) || 0,
        taxableBase: Number(r.taxable_base) || 0,
        itbms: Number(r.itbms) || 0,
    }));
}
