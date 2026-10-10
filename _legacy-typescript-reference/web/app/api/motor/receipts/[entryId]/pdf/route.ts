/**
 * GET /api/motor/receipts/[entryId]/pdf
 *
 * Genera y descarga el PDF de comprobante de un movimiento del ledger del Motor.
 * Aplica los mismos gates que el resto del módulo:
 *   - Sesión válida + tenant + ClientModuleAssignment ACTIVE
 *   - Permiso motor.ledger.read
 *   - El entry debe pertenecer al tenant del usuario
 */

import React from "react";
import { NextRequest, NextResponse } from "next/server";
import ReactPDF from "@react-pdf/renderer";
import { auth } from "@core/auth";
import { prismaServer } from "@core/database/prisma-server";
import { isMotorActiveForClient } from "@/lib/motor/context";
import { hasMotorPermission } from "@/lib/motor/permissions";
import { formatCents } from "@/lib/motor/money";
import { MotorReceiptPDF } from "@/features/motor/ui/MotorReceiptPDF";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ entryId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id || !session.user.clientId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role === "SUPER_ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const clientId = session.user.clientId;

    const motorActive = await isMotorActiveForClient(clientId);
    if (!motorActive) return new NextResponse("Not found", { status: 404 });

    const canRead = await hasMotorPermission(session.user.id, clientId, "motor.ledger.read");
    if (!canRead) {
        return NextResponse.json({ error: "Permiso requerido: motor.ledger.read" }, { status: 403 });
    }

    const { entryId } = await params;
    const entry = await prismaServer.motorLedgerEntry.findFirst({
        where: { id: entryId, clientId },
        include: { entity: true, client: true },
    });
    if (!entry) return new NextResponse("Not found", { status: 404 });

    const element = React.createElement(MotorReceiptPDF, {
        data: {
            entry: {
                id: entry.id,
                movementType: entry.movementType,
                sign: entry.sign,
                amountFormatted: formatCents(entry.amountCents),
                runningBalanceFormatted: formatCents(entry.runningBalanceCents),
                currency: entry.currency,
                reference: entry.reference,
                description: entry.description,
                createdAt: entry.createdAt.toISOString(),
            },
            entity: {
                displayName: entry.entity.displayName,
                kind: entry.entity.kind,
                documentNumber: entry.entity.documentNumber,
            },
            issuer: {
                name: entry.client.name,
                ruc: entry.client.ruc,
                address: entry.client.address,
                email: entry.client.email,
            },
        },
    });

    const stream = await ReactPDF.renderToStream(element as never);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="motor-recibo-${entry.id}.pdf"`,
            "Cache-Control": "no-store",
        },
    });
}
