/**
 * GET /api/reports/itbms
 *
 * Genera y descarga el reporte PDF formal del ITBMS a pagar, con desglose
 * mensual. Solo considera facturas de venta emitidas con éxito (ver
 * lib/fiscal/itbms.ts). Scope estricto por tenant (clientId de la sesión).
 *
 * Query params:
 *   ?period=today|7d|30d|mtd|ytd|custom|all   (default: mtd)
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD            (cuando period=custom)
 */

import React from "react";
import { NextRequest, NextResponse } from "next/server";
import ReactPDF from "@react-pdf/renderer";
import { auth } from "@core/auth";
import { prismaServer } from "@core/database";
import { resolvePeriod } from "@/features/bi/lib/period";
import { getItbmsMonthlyBreakdown } from "@/lib/fiscal/itbms";
import { ItbmsTaxReportPDF, type ItbmsReportData } from "@/features/reports/ui/ItbmsTaxReportPDF";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !session.user.clientId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const clientId = session.user.clientId;

    const { searchParams } = new URL(req.url);
    const periodParam = searchParams.get("period") ?? "mtd";

    // "all" = histórico completo, sin filtro de fecha.
    let scope: { clientId: string; from?: string; to?: string };
    let periodLabel: string;
    let periodKey: string;

    if (periodParam === "all") {
        scope = { clientId };
        periodLabel = "Todo el histórico";
        periodKey = "all";
    } else {
        const resolved = resolvePeriod({
            period: periodParam,
            from: searchParams.get("from") ?? undefined,
            to: searchParams.get("to") ?? undefined,
        });
        scope = { clientId, from: resolved.from, to: resolved.to };
        periodLabel = resolved.label;
        periodKey = resolved.key;
    }

    const [rows, client] = await Promise.all([
        getItbmsMonthlyBreakdown(scope),
        prismaServer.client.findUnique({
            where: { id: clientId },
            select: { name: true, ruc: true },
        }),
    ]);

    const totals = rows.reduce(
        (acc, r) => ({
            invoiceCount: acc.invoiceCount + r.invoiceCount,
            taxableBase: acc.taxableBase + r.taxableBase,
            itbms: acc.itbms + r.itbms,
        }),
        { invoiceCount: 0, taxableBase: 0, itbms: 0 },
    );

    const data: ItbmsReportData = {
        clientName: client?.name ?? "Contribuyente",
        clientRuc: client?.ruc ?? undefined,
        periodLabel,
        generatedAt: new Date().toLocaleString("es-PA"),
        rows,
        totals,
    };

    const element = React.createElement(ItbmsTaxReportPDF, { data });
    const stream = await ReactPDF.renderToStream(element as never);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="reporte-itbms-${periodKey}.pdf"`,
            "Cache-Control": "no-store",
        },
    });
}
