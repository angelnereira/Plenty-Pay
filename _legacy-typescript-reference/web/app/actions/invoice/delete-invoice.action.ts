/**
 * Server Action: Delete Invoice
 * Elimina una factura (solo si está en borrador o no ha sido emitida)
 */

'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@core/auth';
import { prisma } from '@core/database';

export interface DeleteInvoiceInput {
  invoiceId: string;
}

export interface DeleteInvoiceOutput {
  success: boolean;
  error?: string;
}

/**
 * Elimina una factura
 * Solo permite eliminar facturas en estado DRAFT o PENDING
 */
export async function deleteInvoice(input: DeleteInvoiceInput): Promise<DeleteInvoiceOutput> {
  try {
    // 1. Autenticación
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'No autenticado' };
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.clientId) {
      return { success: false, error: 'Usuario no tiene organización' };
    }

    // 2. Obtener factura
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
    });

    if (!invoice) {
      return { success: false, error: 'Factura no encontrada' };
    }

    // 3. Verificar permisos
    if (invoice.clientId !== user.clientId) {
      return { success: false, error: 'No autorizado' };
    }

    // 4. Validar que se puede eliminar
    if (invoice.status === 'EMITTED' || invoice.status === 'CERTIFIED') {
      return {
        success: false,
        error: 'No se puede eliminar una factura emitida o certificada. Solo se pueden eliminar borradores.',
      };
    }

    // 5. Eliminar factura y sus items
    await prisma.$transaction([
      // Eliminar items
      prisma.invoiceItem.deleteMany({
        where: { invoiceId: invoice.id },
      }),
      // Eliminar factura
      prisma.invoice.delete({
        where: { id: invoice.id },
      }),
    ]);

    // 6. Revalidar rutas
    revalidatePath('/dashboard/facturas');

    return {
      success: true,
    };
  } catch (error: unknown) {
    console.error('[DeleteInvoice] Error:', error);
    return {
      success: false,
      error: 'Error interno al eliminar la factura',
    };
  }
}

/**
 * Elimina múltiples facturas
 */
export async function deleteInvoicesBatch(
  invoiceIds: string[]
): Promise<{ results: DeleteInvoiceOutput[]; summary: { success: number; failed: number } }> {
  const results: DeleteInvoiceOutput[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const invoiceId of invoiceIds) {
    const result = await deleteInvoice({ invoiceId });
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }
  }

  return {
    results,
    summary: {
      success: successCount,
      failed: failedCount,
    },
  };
}
