/**
 * API Route: Invoice Status
 * GET /api/invoices/[id]/status
 * 
 * Consulta el estado de certificación de una factura en HKA
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireInvoiceAccess, handleApiError } from '@core/auth/providers/api-helpers';
import { prisma } from '@core/database';
import { consultarEstado, mapHKAStatusToPrisma } from '@/features/hka/model';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. Autenticación
        const session = await requireAuth(request);
        const { id: invoiceId } = await params;

        // 2. Validar acceso a la factura
        await requireInvoiceAccess(invoiceId, session.user.id, session.user.role);

        // 3. Obtener factura de la base de datos
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: {
                id: true,
                cufe: true,
                invoiceNumber: true,
                numeroDocumentoFiscal: true,
                status: true,
                hkaStatus: true,
                hkaMessage: true,
                qrUrl: true,
                qrCode: true,
            }
        });

        if (!invoice) {
            return NextResponse.json(
                { success: false, error: 'Factura no encontrada' },
                { status: 404 }
            );
        }

        // 4. Determinar el número de documento fiscal
        const docFiscal = invoice.invoiceNumber || invoice.numeroDocumentoFiscal || '';

        // Si no tiene número de documento, devolver estado actual de la DB
        if (!docFiscal) {
            return NextResponse.json({
                success: true,
                status: invoice.status,
                hkaStatus: invoice.hkaStatus,
                hkaMessage: invoice.hkaMessage,
                cufe: invoice.cufe,
                qrUrl: invoice.qrUrl,
                qrCode: invoice.qrCode,
            });
        }

        // 5. Consultar estado en HKA
        if (!session.user.clientId) {
            return NextResponse.json({ success: false, error: 'Cliente no identificado' }, { status: 400 });
        }

        const result = await consultarEstado(session.user.clientId, {
            numeroDocumentoFiscal: docFiscal as string,
        });

        if (result.success) {
            // Mapear estado HKA a estado Prisma
            const newStatus = mapHKAStatusToPrisma(result.estatusDocumento || '');

            // Actualizar en DB si el estado cambió
            if (newStatus !== invoice.status) {
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        status: newStatus,
                        hkaStatus: result.estatusDocumento,
                        hkaMessage: result.mensajeDocumento,
                        cufe: result.cufe || invoice.cufe,
                    },
                });

                // Registrar en el log
                await prisma.invoiceLog.create({
                    data: {
                        invoiceId: invoice.id,
                        action: 'UPDATED',
                        message: `Estado actualizado a: ${result.estatusDocumento}`,
                        userId: session.user.id,
                        userEmail: session.user.email || undefined,
                    },
                });
            }

            return NextResponse.json({
                success: true,
                status: newStatus,
                hkaStatus: result.estatusDocumento,
                hkaMessage: result.mensajeDocumento,
                cufe: result.cufe || invoice.cufe,
                fechaEmision: result.fechaEmisionDocumento,
                fechaAutorizacion: result.fechaRecepcionDocumento,
                qrUrl: invoice.qrUrl,
                qrCode: invoice.qrCode,
            });
        }

        // Si falló la consulta HKA, devolver estado actual
        return NextResponse.json({
            success: false,
            error: result.error,
            status: invoice.status,
            hkaStatus: invoice.hkaStatus,
            hkaMessage: invoice.hkaMessage,
            cufe: invoice.cufe,
        });

    } catch (error) {
        return handleApiError(error);
    }
}
