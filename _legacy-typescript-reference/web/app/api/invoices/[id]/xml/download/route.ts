/**
 * API Route: Download Invoice XML
 * GET /api/invoices/[id]/xml/download
 *
 * Descarga el XML firmado de una factura desde HKA
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { downloadXMLFromHKA } from '@/features/hka/model';
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
                { error: 'La factura debe estar emitida para descargar el XML' },
                { status: 400 }
            );
        }

        // Si ya tenemos el XML en la BD, devolverlo directamente
        if (invoice.rawXml) {
            const buffer = Buffer.from(invoice.rawXml, 'utf-8');
            return new NextResponse(buffer as unknown as BodyInit, {
                status: 200,
                headers: {
                    'Content-Type': 'application/xml',
                    'Content-Disposition': `attachment; filename="factura-${invoice.invoiceNumber || invoice.id}.xml"`,
                    'Content-Length': String(buffer.length),
                },
            });
        }

        // Si no tenemos el XML, descargarlo de HKA
        const docFiscal = invoice.invoiceNumber || invoice.numeroDocumentoFiscal;

        if (!docFiscal) {
            return NextResponse.json(
                { error: 'No se puede determinar el número de documento fiscal' },
                { status: 400 }
            );
        }

        const tipoDocumento = mapDocumentTypeToHKA(invoice.documentType, invoice.noteSubtype ?? undefined) as import('@/features/hka/model/types/types').TipoDocumento;

        // downloadXMLFromHKA ya maneja la obtención de configuración internamente
        const result = await downloadXMLFromHKA(clientId, {
            numeroDocumentoFiscal: docFiscal,
            tipoDocumento,
        });

        if (!result.success || !result.buffer) {
            return NextResponse.json(
                { error: result.error || 'Error al descargar XML desde HKA' },
                { status: 400 }
            );
        }

        // Guardar el XML en la base de datos para futuras descargas
        if (result.contenido) {
            try {
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        rawXml: result.contenido,
                        xmlDescargado: true,
                    },
                });
            } catch (dbError) {
                console.warn('[API] No se pudo guardar XML en cache:', dbError);
            }
        }

        // Registrar en el log
        try {
            await prisma.invoiceLog.create({
                data: {
                    invoiceId: invoice.id,
                    action: 'DOWNLOADED_XML',
                    message: 'XML firmado descargado desde HKA',
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
                'Content-Type': 'application/xml',
                'Content-Disposition': `attachment; filename="factura-${invoice.invoiceNumber || invoice.id}.xml"`,
                'Content-Length': String(result.buffer.length),
            },
        });
    } catch (error) {
        console.error('[API] Error downloading XML:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error al descargar XML' },
            { status: 500 }
        );
    }
}

