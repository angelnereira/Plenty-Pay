import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { sendInvoiceEmail } from '@/features/hka/model';

/**
 * POST /api/invoices/[id]/email/send
 *
 * Envía una factura por correo electrónico usando el servicio SOAP de HKA.
 * HKA envía el correo con el PDF y XML adjuntos.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.clientId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { clientId } = session.user;
    const { id: invoiceId } = await params;

    // Obtener body del request
    const body = await request.json();
    const { recipientEmail, includePDF = true, includeXML = true, customMessage } = body;

    // Validar email requerido
    if (!recipientEmail || !recipientEmail.trim()) {
      return NextResponse.json(
        { success: false, error: 'El correo electrónico del destinatario es requerido' },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { success: false, error: 'El formato del correo electrónico es inválido' },
        { status: 400 }
      );
    }

    // Buscar la factura
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId: clientId,
      },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que la factura esté emitida o certificada
    if (!['EMITTED', 'CERTIFIED'].includes(invoice.status)) {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden enviar por correo facturas que ya han sido emitidas' },
        { status: 400 }
      );
    }

    // Obtener número de documento fiscal
    const numeroDocumentoFiscal = invoice.invoiceNumber || invoice.numeroDocumentoFiscal;

    if (!numeroDocumentoFiscal) {
      return NextResponse.json(
        { success: false, error: 'La factura no tiene número de documento fiscal asignado' },
        { status: 400 }
      );
    }

    console.log('[API] Enviando factura por correo via HKA:', {
      invoiceId,
      numeroDocumentoFiscal,
      recipientEmail,
    });

    // Llamar al servicio HKA para enviar el correo
    const result = await sendInvoiceEmail(clientId, {
      numeroDocumentoFiscal: numeroDocumentoFiscal,
      correo: recipientEmail.trim(),
    });

    if (!result.success) {
      console.error('[API] Error HKA al enviar correo:', result);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Error al enviar correo vía HKA',
          code: result.code,
        },
        { status: 400 }
      );
    }

    // Registrar el envío de email en la base de datos
    await prisma.emailDelivery.create({
      data: {
        invoiceId: invoice.id,
        recipientEmail: recipientEmail.trim(),
        status: 'SENT',
        sentAt: new Date(),
        includePDF: includePDF,
        includeXML: includeXML,
        customMessage: customMessage || null,
      },
    });

    // Registrar en el log de la factura
    await prisma.invoiceLog.create({
      data: {
        invoiceId: invoice.id,
        action: 'EMAIL_SENT',
        message: `Factura enviada por correo a: ${recipientEmail}`,
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        metadata: {
          recipientEmail,
          includePDF,
          includeXML,
          hkaCode: result.code,
        },
      },
    });

    console.log('[API] Correo enviado exitosamente via HKA');

    return NextResponse.json({
      success: true,
      message: result.message || `Factura enviada exitosamente a ${recipientEmail}`,
    });

  } catch (error) {
    console.error('[API] Error en send email:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    );
  }
}
