import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireInvoiceAccess, handleApiError } from '@core/auth/providers/api-helpers';
import { prisma } from '@core/database';
import { sendInvoiceEmail } from '@/features/hka/model';

/**
 * POST /api/invoices/[id]/email
 * Envía una factura por correo electrónico usando el servicio SOAP de HKA.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. Autenticación y validación de body
        const session = await requireAuth(request);

        if (!session.user.clientId) {
            return NextResponse.json(
                { error: 'Cliente no configurado' },
                { status: 400 }
            );
        }

        const clientId = session.user.clientId;
        const { id: invoiceId } = await params;

        const body = await request.json();
        const { emails } = body; // Array de correos o string

        if (!emails) {
            return NextResponse.json(
                { error: 'Se requiere al menos un correo electrónico' },
                { status: 400 }
            );
        }


        // 2. Validar acceso y obtener datos de factura
        await requireInvoiceAccess(invoiceId, session.user.id, session.user.role);

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: {
                cufe: true,
                invoiceNumber: true,
                numeroDocumentoFiscal: true,
                status: true,
            }
        });

        if (!invoice?.cufe) {
            return NextResponse.json(
                { error: 'Factura sin CUFE (no emitida aún)' },
                { status: 400 }
            );
        }

        const numeroDocumentoFiscal = invoice.invoiceNumber || invoice.numeroDocumentoFiscal;

        if (!numeroDocumentoFiscal) {
            return NextResponse.json(
                { error: 'Factura sin número de documento fiscal asignado' },
                { status: 400 }
            );
        }

        // 3. Procesar emails (puede ser string o array)
        const emailList = Array.isArray(emails) ? emails : [emails];
        const results: { email: string; success: boolean; error?: string }[] = [];

        for (const email of emailList) {
            try {
                const result = await sendInvoiceEmail(clientId, {
                    numeroDocumentoFiscal: numeroDocumentoFiscal,
                    correo: email.trim(),
                });

                results.push({
                    email,
                    success: result.success,
                    error: result.error,
                });

                if (result.success) {
                    // Registrar envío exitoso
                    await prisma.emailDelivery.create({
                        data: {
                            invoiceId: invoiceId,
                            recipientEmail: email.trim(),
                            status: 'SENT',
                            sentAt: new Date(),
                            includePDF: true,
                            includeXML: true,
                        },
                    });
                }

                // Pausa entre envíos múltiples
                if (emailList.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (err) {
                results.push({
                    email,
                    success: false,
                    error: err instanceof Error ? err.message : 'Error desconocido',
                });
            }
        }

        const allSuccess = results.every(r => r.success);
        const anySuccess = results.some(r => r.success);

        return NextResponse.json({
            success: anySuccess,
            message: allSuccess
                ? `Factura enviada a ${emailList.length} destinatario(s)`
                : `Enviado parcialmente (${results.filter(r => r.success).length}/${emailList.length})`,
            results,
        });

    } catch (error) {
        return handleApiError(error);
    }
}



