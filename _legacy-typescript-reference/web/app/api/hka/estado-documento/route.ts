/**
 * API Route: HKA Estado Documento
 * 
 * Consulta el estado de un documento en HKA/DGI
 * POST /api/hka/estado-documento
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { consultarEstado } from '@/features/hka/model/methods/status';
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

    // Buscar factura en la base de datos para obtener datos completos
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

    // Si no encontramos la factura en DB pero tenemos CUFE, extraer el número del CUFE
    // Formato CUFE: FE0120000155738031-2-2023-2000002025121100010000000010123423469758
    // El número está en los caracteres del 38-47 (índices pueden variar)
    // O podemos buscar el patrón de 10 dígitos después de la fecha
    let extractedNumero: string | null = null;

    if (!invoice && cufe && !numeroDocumentoFiscal) {
      console.log('[estado-documento] Factura no encontrada en DB, intentando extraer número del CUFE:', cufe);

      // El CUFE tiene formato aproximado: FE01{tipo}{ruc}-{enviro}{fecha}{numero}{codigo}
      // Intentar extraer el número de 10 dígitos que empieza con 000
      const regexNumero = /(\d{10})(?=\d{9}$)/; // 10 dígitos seguidos de 9 dígitos al final
      const match = cufe.match(regexNumero);

      if (match) {
        extractedNumero = match[1];
        console.log('[estado-documento] Número extraído del CUFE:', extractedNumero);
      } else {
        // Plan B: Buscar la secuencia "0001" o "0000" que suele ser el inicio del número
        const altMatch = cufe.match(/00[01]\d{7}/);
        if (altMatch) {
          extractedNumero = altMatch[0];
          console.log('[estado-documento] Número extraído (plan B):', extractedNumero);
        }
      }

      if (!extractedNumero) {
        return NextResponse.json(
          {
            success: false,
            error: 'No se pudo extraer el número de documento del CUFE. Proporcione el número de documento fiscal directamente.'
          },
          { status: 400 }
        );
      }
    }

    // Determinar el numero de documento fiscal
    // Prioridad: invoiceNumber de la factura > numeroDocumentoFiscal de la factura > numero extraído del CUFE > parametro directo
    const docFiscal = invoice?.invoiceNumber ||
      invoice?.numeroDocumentoFiscal ||
      extractedNumero ||
      numeroDocumentoFiscal;

    if (!docFiscal) {
      return NextResponse.json(
        { success: false, error: 'No se pudo determinar el numero de documento fiscal' },
        { status: 400 }
      );
    }

    console.log('[estado-documento] Consultando documento fiscal:', docFiscal);

    const result = await consultarEstado(clientId, {
      numeroDocumentoFiscal: docFiscal,
      tipoDocumento: (invoice ? mapDocumentTypeToHKA(invoice.documentType) : body.tipoDocumento),
      tipoEmision: body.tipoEmision,
      codigoSucursalEmisor: body.codigoSucursalEmisor,
      puntoFacturacionFiscal: body.puntoFacturacionFiscal,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Error al consultar estado',
          code: result.code
        },
        { status: 400 }
      );
    }

    // Si tenemos la factura, actualizar estado en BD
    if (invoice && result.success) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          hkaStatus: result.estatusDocumento,
          cufe: result.cufe || invoice.cufe,
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      estado: result.estatusDocumento,
      status: result.status,
      data: {
        cufe: result.cufe,
        estado: result.estatusDocumento,
        fechaEmision: result.fechaEmisionDocumento,
        fechaAutorizacion: result.fechaRecepcionDocumento,
        mensaje: result.mensajeDocumento,
      },
    });
  } catch (error) {
    console.error('[API] Error en estado-documento:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    );
  }
}

