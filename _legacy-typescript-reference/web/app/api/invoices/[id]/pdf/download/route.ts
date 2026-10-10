/**
 * API Route: Download Invoice PDF
 * GET /api/invoices/[id]/pdf/download
 *
 * Descarga el PDF oficial de una factura desde HKA
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { downloadPDFFromHKA } from '@/features/hka/model';
import { mapDocumentTypeToHKA } from '@/features/hka/model/services/utils';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.clientId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { id: invoiceId } = await params;
        const { clientId } = session.user;

        // Obtener la factura
        const invoice = await prisma.invoice.findFirst({
            where: {
                id: invoiceId,
                clientId: clientId,
            },
        });

        if (!invoice) {
            return NextResponse.json(
                { error: 'Factura no encontrada' },
                { status: 404 }
            );
        }

        // Verificar que la factura esté emitida
        if (!['EMITTED', 'CERTIFIED'].includes(invoice.status)) {
            return NextResponse.json(
                { error: 'La factura debe estar emitida para descargar el PDF' },
                { status: 400 }
            );
        }

        // Si ya tenemos el PDF en base64, devolverlo directamente
        if (invoice.pdfBase64) {
            const buffer = Buffer.from(invoice.pdfBase64, 'base64');
            return new NextResponse(buffer as unknown as BodyInit, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="factura-${invoice.invoiceNumber || invoice.id}.pdf"`,
                    'Content-Length': String(buffer.length),
                },
            });
        }

        // Si no tenemos el PDF, descargarlo de HKA
        const docFiscal = invoice.invoiceNumber || invoice.numeroDocumentoFiscal;

        if (!docFiscal) {
            return NextResponse.json(
                { error: 'No se puede determinar el número de documento fiscal' },
                { status: 400 }
            );
        }

        const tipoDocumento = mapDocumentTypeToHKA(invoice.documentType, invoice.noteSubtype ?? undefined) as import('@/features/hka/model/types/types').TipoDocumento;

        // downloadPDFFromHKA ya maneja la obtención de configuración internamente
        const result = await downloadPDFFromHKA(clientId, {
            numeroDocumentoFiscal: docFiscal,
            tipoDocumento,
        });

        if (!result.success || !result.buffer) {
            return NextResponse.json(
                { error: result.error || 'Error al descargar PDF desde HKA' },
                { status: 400 }
            );
        }

        // Guardar el PDF en la base de datos para futuras descargas
        try {
            await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    pdfBase64: result.documentoBase64,
                    pdfDescargado: true,
                },
            });
        } catch (dbError) {
            console.warn('[API] No se pudo guardar PDF en cache:', dbError);
            // Continuamos aunque falle el cache
        }

        // Registrar en el log
        try {
            await prisma.invoiceLog.create({
                data: {
                    invoiceId: invoice.id,
                    action: 'DOWNLOADED_PDF',
                    message: 'PDF descargado desde HKA',
                    userId: session.user.id,
                    userEmail: session.user.email || undefined,
                },
            });
        } catch (logError) {
            console.warn('[API] No se pudo registrar log:', logError);
        }

        return new NextResponse(result.buffer as unknown as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="factura-${invoice.invoiceNumber || invoice.id}.pdf"`,
                'Content-Length': String(result.buffer.length),
            },
        });
    } catch (error) {
        console.error('[API] Error downloading PDF:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error al descargar PDF' },
            { status: 500 }
        );
    }
}

