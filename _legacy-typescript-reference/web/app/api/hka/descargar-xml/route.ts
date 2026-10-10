/**
 * API Route: HKA Descarga XML
 * 
 * Descarga el XML firmado digitalmente de una factura desde HKA
 * POST /api/hka/descargar-xml
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { downloadXMLFromHKA, createDownloadResponse } from '@/features/hka/model/methods/downloads';
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
    const { cufe, numeroDocumentoFiscal } = body;

    if (!cufe && !numeroDocumentoFiscal) {
      return NextResponse.json(
        { success: false, error: 'Se requiere CUFE o numero de documento fiscal' },
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
    const result = await downloadXMLFromHKA(clientId, {
      numeroDocumentoFiscal: docFiscal,
      tipoDocumento: (invoice ? mapDocumentTypeToHKA(invoice.documentType) : body.tipoDocumento),
      tipoEmision: body.tipoEmision,
      codigoSucursalEmisor: body.codigoSucursalEmisor,
      puntoFacturacionFiscal: body.puntoFacturacionFiscal,
    });

    if (!result.success || !result.buffer) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Error al descargar XML',
          code: result.code
        },
        { status: 400 }
      );
    }

    // Registrar la descarga si tenemos la factura
    if (invoice) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          xmlDescargado: true,
          updatedAt: new Date(),
        },
      });

      // Registrar en el log
      await prisma.invoiceLog.create({
        data: {
          invoiceId: invoice.id,
          action: 'DOWNLOADED_XML',
          message: 'XML firmado descargado desde HKA',
          userId: session.user.id,
          userEmail: session.user.email || undefined,
        },
      });
    }

    // Crear respuesta con el archivo
    const downloadResponse = createDownloadResponse(result);

    return new NextResponse(downloadResponse.body as any, {
      status: 200,
      headers: downloadResponse.headers,
    });
  } catch (error) {
    console.error('[API] Error en descargar-xml:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    );
  }
}

