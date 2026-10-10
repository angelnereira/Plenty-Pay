'use server';

/**
 * Server Action: Get Next Invoice Number Preview
 * 
 * Obtiene una vista previa del próximo número de factura para mostrar en la UI.
 * NO consume el número, solo muestra cuál sería el próximo.
 */

import { auth } from '@core/auth';
import { peekNextInvoiceNumber } from '@/features/hka/model/services/invoice-numbering.service';

export interface GetNextInvoiceNumberPreviewResult {
    success: boolean;
    nextNumber?: string;
    error?: string;
}

/**
 * Obtiene el próximo número de factura que se asignará al emitir.
 * Este número es un preview y puede cambiar si otro usuario emite antes.
 */
export async function getNextInvoiceNumberPreview(): Promise<GetNextInvoiceNumberPreviewResult> {
    try {
        // Verificar autenticación
        const session = await auth();

        if (!session?.user?.clientId) {
            return {
                success: false,
                error: 'No autenticado o sin cliente asociado'
            };
        }

        const clientId = session.user.clientId;

        // Obtener preview del próximo número
        const nextNumber = await peekNextInvoiceNumber(clientId);

        return {
            success: true,
            nextNumber
        };

    } catch (error) {
        console.error('[getNextInvoiceNumberPreview] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al obtener número de factura'
        };
    }
}
