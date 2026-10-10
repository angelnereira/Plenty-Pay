/**
 * API Route: Void Invoice (Anular)
 * POST /api/invoices/[id]/void
 *
 * Anula una factura emitida ante la DGI via HKA
 * Esta accion es IRREVERSIBLE
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { cancelInvoiceInHKA } from '@/features/hka/model';

export async function POST(
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

        // Obtener el motivo del body
        const body = await request.json();
        const { motivo } = body;

        if (!motivo || motivo.trim().length < 15) {
            return NextResponse.json(
                { error: 'El motivo de anulacion debe tener al menos 15 caracteres' },
                { status: 400 }
            );
        }

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

        // Verificar que la factura pueda ser anulada
        if (invoice.isCancelled) {
            return NextResponse.json(
                { error: 'La factura ya ha sido anulada anteriormente' },
                { status: 400 }
            );
        }

        if (!['EMITTED', 'CERTIFIED'].includes(invoice.status)) {
            return NextResponse.json(
                { error: `No se puede anular una factura con estado: ${invoice.status}` },
                { status: 400 }
            );
        }

        // Determinar el numero de documento fiscal
        const docFiscal = invoice.invoiceNumber || invoice.numeroDocumentoFiscal;
        
        if (!docFiscal) {
            return NextResponse.json(
                { error: 'No se puede determinar el numero de documento fiscal' },
                { status: 400 }
            );
        }

        // Llamar a HKA para anular
        const result = await cancelInvoiceInHKA(clientId, {
            numeroDocumentoFiscal: docFiscal,
            motivoAnulacion: motivo.trim(),
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Error al anular factura en HKA' },
                { status: 400 }
            );
        }

        // Actualizar la factura en la BD
        await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
                status: 'CANCELLED',
                isCancelled: true,
                cancelledAt: new Date(),
                cancellationReason: motivo.trim(),
                hkaStatus: 'ANULADO',
            },
        });

        // Registrar en el log
        await prisma.invoiceLog.create({
            data: {
                invoiceId: invoice.id,
                action: 'CANCELLED',
                message: `Factura anulada. Motivo: ${motivo.trim()}`,
                userId: session.user.id,
                userEmail: session.user.email || undefined,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Factura anulada exitosamente',
        });
    } catch (error) {
        console.error('[API] Error en void invoice:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error al anular factura' },
            { status: 500 }
        );
    }
}
