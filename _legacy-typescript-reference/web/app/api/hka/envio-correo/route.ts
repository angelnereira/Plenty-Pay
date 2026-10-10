/**
 * API Route: HKA Envio Correo
 * 
 * Envia una factura por correo electronico a traves de HKA
 * POST /api/hka/envio-correo
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { sendInvoiceEmail } from '@/features/hka/model/methods/email';
import { getHKAConfig } from '@/features/hka/model/repositories/hka-config.repository';
import { mapDocumentTypeToHKA } from '@/features/hka/model/services/utils';

export async function POST(request: NextRequest) {
  try {
    // Autenticacion
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { clientId } = session.user;

    // Obtener body
    const body = await request.json();
    const { cufe, numeroDocumentoFiscal, email, includePDF, includeXML, message } = body;

    if (!cufe && !numeroDocumentoFiscal) {
      return NextResponse.json(
        { success: false, error: 'Se requiere CUFE o numero de documento fiscal' },
        { status: 400 }
      );
    }

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'El correo electronico es requerido' },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'El formato del correo electronico es invalido' },
        { status: 400 }
      );
    }

    // Buscar factura en la base de datos
    let invoice = null;

    if (cufe) {
      invoice = await prisma.invoice.findFirst({
        where: {
          cufe: cufe,
          clientId: clientId,
        },
      });
    } else if (numeroDocumentoFiscal) {
      invoice = await prisma.invoice.findFirst({
        where: {
          numeroDocumentoFiscal: numeroDocumentoFiscal,
          clientId: clientId,
        },
      });
    }

    // Si no encontramos la factura, verificar si nos dieron numeroDocumentoFiscal directamente
    if (!invoice && !numeroDocumentoFiscal) {
      return NextResponse.json(
        {
          success: false,
          error: 'Factura no encontrada. Verifique el CUFE o proporcione el numero de documento fiscal.'
        },
        { status: 404 }
      );
    }

    // Determinar el numero de documento fiscal
    const docFiscal = invoice?.invoiceNumber ||
      invoice?.numeroDocumentoFiscal ||
      numeroDocumentoFiscal;

    if (!docFiscal) {
      return NextResponse.json(
        { success: false, error: 'No se pudo determinar el numero de documento fiscal' },
        { status: 400 }
      );
    }

    // Llamar al servicio HKA
    const result = await sendInvoiceEmail(clientId, {
      numeroDocumentoFiscal: docFiscal,
      correo: email.trim(),
      tipoDocumento: (invoice ? mapDocumentTypeToHKA(invoice.documentType) : body.tipoDocumento),
      tipoEmision: body.tipoEmision,
      codigoSucursalEmisor: body.codigoSucursalEmisor,
      puntoFacturacionFiscal: body.puntoFacturacionFiscal,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Error al enviar correo',
          code: result.code
        },
        { status: 400 }
      );
    }

    // Registrar el envio si tenemos la factura
    if (invoice) {
      // Crear registro de entrega de email
      await prisma.emailDelivery.create({
        data: {
          invoiceId: invoice.id,
          recipientEmail: email.trim(),
          status: 'SENT',
          sentAt: new Date(),
          includePDF: includePDF ?? true,
          includeXML: includeXML ?? true,
          customMessage: message || null,
        },
      });

      // Registrar en el log
      await prisma.invoiceLog.create({
        data: {
          invoiceId: invoice.id,
          action: 'EMAIL_SENT',
          message: `Factura enviada por correo a: ${email}`,
          userId: session.user.id,
          userEmail: session.user.email || undefined,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Correo enviado exitosamente',
    });
  } catch (error) {
    console.error('[API] Error en envio-correo:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    );
  }
}

