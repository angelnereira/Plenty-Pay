/**
 * Server Action: Refresh Invoice Status
 * Consulta el estado actual de una factura en HKA/DGI
 */

'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { 
  consultarEstado, 
  mapHKAStatusToPrisma,
  type EstadoDocumentoResult,
} from '@/features/hka/model';

/**
 * Output de consulta de estado
 */
export interface RefreshStatusOutput {
  success: boolean;
  data?: {
    estatusDocumento: string;
    cufe: string;
    fechaEmisionDocumento: string;
    fechaRecepcionDocumento: string;
    mensajeDocumento: string;
    prismaStatus: string;
  };
  error?: string;
}

/**
 * Consulta y actualiza el estado de una factura desde HKA
 * 
 * @param invoiceId - ID de la factura en Prisma
 * @returns Estado actual del documento
 */
export async function refreshInvoiceStatus(invoiceId: string): Promise<RefreshStatusOutput> {
  try {
    // Autenticación
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return { success: false, error: 'No autorizado' };
    }

    const { clientId } = session.user;

    // Obtener factura
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId: clientId,
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        cufe: true,
      },
    });

    if (!invoice) {
      return { success: false, error: 'Factura no encontrada' };
    }

    if (!invoice.invoiceNumber) {
      return { success: false, error: 'La factura no tiene número asignado' };
    }

    // Consultar estado en HKA
    const result = await consultarEstado(clientId, {
      numeroDocumentoFiscal: invoice.invoiceNumber,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Error al consultar estado en HKA',
      };
    }

    // Mapear estado HKA a Prisma
    const prismaStatus = mapHKAStatusToPrisma(result.estatusDocumento || '');

    // Actualizar factura si el estado cambió
    if (invoice.status !== prismaStatus || (result.cufe && !invoice.cufe)) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: prismaStatus,
          cufe: result.cufe || invoice.cufe,
          hkaStatus: result.estatusDocumento,
          hkaMessage: result.mensajeDocumento,
        },
      });

      // Log del cambio
      await prisma.invoiceLog.create({
        data: {
          invoiceId,
          action: 'UPDATED',
          message: `Estado actualizado desde HKA: ${result.estatusDocumento}`,
          metadata: {
            previousStatus: invoice.status,
            newStatus: prismaStatus,
            hkaStatus: result.estatusDocumento,
          },
          userId: session.user.id,
          userEmail: session.user.email,
        },
      });

      revalidatePath('/dashboard/facturas');
      revalidatePath(`/dashboard/facturas/${invoiceId}`);
    }

    return {
      success: true,
      data: {
        estatusDocumento: result.estatusDocumento || '',
        cufe: result.cufe || '',
        fechaEmisionDocumento: result.fechaEmisionDocumento || '',
        fechaRecepcionDocumento: result.fechaRecepcionDocumento || '',
        mensajeDocumento: result.mensajeDocumento || '',
        prismaStatus,
      },
    };
  } catch (error) {
    console.error('Error en refreshInvoiceStatus:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    };
  }
}

/**
 * Actualiza el estado de múltiples facturas
 */
export async function refreshMultipleInvoiceStatus(
  invoiceIds: string[]
): Promise<{ invoiceId: string; result: RefreshStatusOutput }[]> {
  const results: { invoiceId: string; result: RefreshStatusOutput }[] = [];

  for (const invoiceId of invoiceIds) {
    const result = await refreshInvoiceStatus(invoiceId);
    results.push({ invoiceId, result });
    
    // Pausa entre consultas
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return results;
}

/**
 * Actualiza estados de todas las facturas en PROCESSING
 */
export async function refreshProcessingInvoices(): Promise<{
  updated: number;
  errors: number;
}> {
  const session = await auth();
  if (!session?.user?.clientId) {
    return { updated: 0, errors: 0 };
  }

  // Obtener facturas en processing
  const invoices = await prisma.invoice.findMany({
    where: {
      clientId: session.user.clientId,
      status: 'PROCESSING',
    },
    select: { id: true },
    take: 50, // Limitar para evitar sobrecarga
  });

  let updated = 0;
  let errors = 0;

  for (const invoice of invoices) {
    const result = await refreshInvoiceStatus(invoice.id);
    if (result.success) {
      updated++;
    } else {
      errors++;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return { updated, errors };
}
