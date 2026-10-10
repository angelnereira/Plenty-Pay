/**
 * Server Action: Cancel Invoice
 * Anula una factura emitida ante la DGI a través de HKA
 */

'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import {
  cancelInvoiceInHKA,
  canBeCancelled,
  type AnularDocumentoResult,
} from '@/features/hka/model';

/**
 * Input para anulación
 */
export interface CancelInvoiceInput {
  invoiceId: string;
  /** Motivo de la anulación (mínimo 15 caracteres) */
  motivoAnulacion: string;
}

/**
 * Output de anulación
 */
export interface CancelInvoiceOutput {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Anula una factura emitida ante la DGI
 * Esta acción es IRREVERSIBLE
 * 
 * @param input - ID de la factura y motivo de anulación
 * @returns Resultado de la anulación
 */
export async function cancelInvoice(input: CancelInvoiceInput): Promise<CancelInvoiceOutput> {
  try {
    // Autenticación
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return { success: false, error: 'No autorizado' };
    }

    const { clientId } = session.user;

    // Validar motivo
    if (!input.motivoAnulacion || input.motivoAnulacion.trim().length < 15) {
      return {
        success: false,
        error: 'El motivo de anulación debe tener al menos 15 caracteres'
      };
    }

    // Obtener factura
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: input.invoiceId,
        clientId: clientId,
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        cufe: true,
        isCancelled: true,
        receiverType: true,
        hkaProtocol: true,
      },
    });

    if (!invoice) {
      return { success: false, error: 'Factura no encontrada' };
    }

    // Verificar que no esté ya anulada
    if (invoice.isCancelled) {
      return { success: false, error: 'La factura ya está anulada' };
    }

    // Verificar que el estado permita anulación
    if (!canBeCancelled(invoice.status)) {
      return {
        success: false,
        error: `No se puede anular una factura en estado "${invoice.status}". Solo se pueden anular facturas emitidas.`
      };
    }

    if (!invoice.invoiceNumber) {
      return { success: false, error: 'La factura no tiene número asignado' };
    }

    // Guard DGI: no se puede anular una factura B2C (tipoEmision=03) sin protocolo de autorización.
    // La anulación exige dProtAut; sin él la DGI rechaza con código 0621.
    if (invoice.receiverType === 'FINAL_CONSUMER' && !invoice.hkaProtocol) {
      return {
        success: false,
        error: 'No se puede anular esta factura: es de Autorización Posterior (Consumidor Final) y aún no ha sido autorizada por la DGI. Espere a recibir el número de protocolo antes de anular.',
      };
    }

    // Anular en HKA
    const result = await cancelInvoiceInHKA(clientId, {
      numeroDocumentoFiscal: invoice.invoiceNumber,
      motivoAnulacion: input.motivoAnulacion.trim(),
    });

    if (!result.success) {
      // FIX: Si el error es "Ya existe un evento de anulación", asumimos que ya está anulada en HKA
      // y procedemos a anularla localmente para sincronizar el estado.
      const isAlreadyCancelled = result.error?.includes('Ya existe un evento de anulación') ||
        result.message?.includes('Ya existe un evento de anulación');

      if (!isAlreadyCancelled) {
        // Log del intento fallido real
        await prisma.invoiceLog.create({
          data: {
            invoiceId: input.invoiceId,
            action: 'ERROR',
            message: `Fallo al intentar anular: ${result.error}`,
            metadata: {
              motivoAnulacion: input.motivoAnulacion,
              code: result.code,
            },
            userId: session.user.id,
            userEmail: session.user.email,
          },
        });

        return {
          success: false,
          error: result.error || 'Error al anular factura en HKA',
        };
      }

      // Si ya estaba anulada, logueamos advertencia pero continuamos
      console.warn(`[CANCEL-ACTION] Factura ${invoice.invoiceNumber} ya estaba anulada en HKA. Sincronizando estado local.`);
    }

    // Actualizar factura en base de datos
    await prisma.invoice.update({
      where: { id: input.invoiceId },
      data: {
        status: 'CANCELLED',
        isCancelled: true,
        cancelledAt: new Date(),
        cancellationReason: input.motivoAnulacion.trim(),
        hkaStatus: 'ANULADO',
        hkaMessage: result.message,
      },
    });

    // Log de anulación exitosa
    await prisma.invoiceLog.create({
      data: {
        invoiceId: input.invoiceId,
        action: 'CANCELLED',
        message: `Factura anulada exitosamente. Motivo: ${input.motivoAnulacion}`,
        metadata: {
          motivoAnulacion: input.motivoAnulacion,
          code: result.code,
        },
        userId: session.user.id,
        userEmail: session.user.email,
      },
    });

    // 5. Revalidar paths
    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${input.invoiceId}`);

    return {
      success: true,
      message: 'Factura anulada exitosamente',
    };
  } catch (error) {
    console.error('[CANCEL-ACTION] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado al anular factura',
    };
  }
}

/**
 * Verifica si una factura puede ser anulada
 */
export async function canCancelInvoice(invoiceId: string): Promise<{
  canCancel: boolean;
  reason?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.clientId) {
      return { canCancel: false, reason: 'No autorizado' };
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId: session.user.clientId,
      },
      select: {
        status: true,
        isCancelled: true,
      },
    });

    if (!invoice) {
      return { canCancel: false, reason: 'Factura no encontrada' };
    }

    if (invoice.isCancelled) {
      return { canCancel: false, reason: 'La factura ya está anulada' };
    }

    if (!canBeCancelled(invoice.status)) {
      return {
        canCancel: false,
        reason: `Estado "${invoice.status}" no permite anulación`
      };
    }

    return { canCancel: true };
  } catch {
    return { canCancel: false, reason: 'Error al verificar' };
  }
}
