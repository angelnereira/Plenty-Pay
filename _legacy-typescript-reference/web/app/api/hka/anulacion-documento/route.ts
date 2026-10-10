/**
 * API Route: HKA Anulacion Documento
 * 
 * Anula una factura emitida ante la DGI
 * Esta accion es IRREVERSIBLE
 * POST /api/hka/anulacion-documento
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { cancelInvoiceInHKA } from '@/features/hka/model/methods/cancellation';
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
    const { cufe, numeroDocumentoFiscal, motivo } = body;

    if (!cufe && !numeroDocumentoFiscal) {
      return NextResponse.json(
        { success: false, error: 'Se requiere CUFE o numero de documento fiscal' },
        { status: 400 }
      );
    }

    if (!motivo || motivo.trim().length < 15) {
      return NextResponse.json(
        { success: false, error: 'El motivo de anulacion debe tener al menos 15 caracteres' },
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

    // Verificar que la factura existe y puede ser anulada
    if (invoice) {
      if (invoice.isCancelled) {
        return NextResponse.json(
          { success: false, error: 'La factura ya ha sido anulada anteriormente' },
          { status: 400 }
        );
      }

      // Solo facturas emitidas pueden ser anuladas
      if (!['EMITTED', 'CERTIFIED'].includes(invoice.status)) {
        return NextResponse.json(
          { success: false, error: `No se puede anular una factura con estado: ${invoice.status}` },
          { status: 400 }
        );
      }
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
    const result = await cancelInvoiceInHKA(clientId, {
      numeroDocumentoFiscal: docFiscal,
      motivoAnulacion: motivo.trim(),
      tipoDocumento: (invoice ? mapDocumentTypeToHKA(invoice.documentType) : body.tipoDocumento),
      tipoEmision: body.tipoEmision,
      codigoSucursalEmisor: body.codigoSucursalEmisor,
      puntoFacturacionFiscal: body.puntoFacturacionFiscal,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Error al anular documento',
          code: result.code
        },
        { status: 400 }
      );
    }

    // Actualizar estado en la base de datos
    if (invoice) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'CANCELLED',
          isCancelled: true,
          cancelledAt: new Date(),
          cancellationReason: motivo.trim(),
          hkaStatus: 'ANULADO',
          updatedAt: new Date(),
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
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Documento anulado exitosamente',
    });
  } catch (error) {
    console.error('[API] Error en anulacion-documento:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    );
  }
}

