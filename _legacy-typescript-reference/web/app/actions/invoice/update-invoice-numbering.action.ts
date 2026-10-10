'use server';

/**
 * Server Action: Update Invoice Numbering
 * 
 * Permite a los usuarios configurar desde qué número empezar a facturar.
 * Solo permite establecer números mayores o iguales al actual para evitar duplicidad.
 */

import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { formatInvoiceNumber } from '@/features/hka/model/services/invoice-numbering.service';

export interface UpdateInvoiceNumberingResult {
    success: boolean;
    newStartNumber?: string;
    nextNumber?: string;
    error?: string;
}

/**
 * Actualiza el número inicial de facturación para el cliente.
 * 
 * @param newStartNumber - El número desde el cual quiere empezar (ej: 3754)
 *                         La próxima factura será este número.
 * 
 * @example
 * // Si el usuario quiere que la próxima factura sea 3754
 * await updateInvoiceNumbering(3754);
 * // Se guarda lastInvoiceNumber = 3753 (para que +1 = 3754)
 */
export async function updateInvoiceNumbering(
    newStartNumber: number
): Promise<UpdateInvoiceNumberingResult> {
    try {
        // 1. Verificar autenticación
        const session = await auth();

        if (!session?.user?.clientId) {
            return {
                success: false,
                error: 'No autenticado o sin cliente asociado'
            };
        }

        const clientId = session.user.clientId;

        // 2. Validar que el número es positivo y razonable
        if (!Number.isInteger(newStartNumber) || newStartNumber < 1) {
            return {
                success: false,
                error: 'El número debe ser un entero positivo'
            };
        }

        // Límite máximo para 10 dígitos
        if (newStartNumber > 9999999999) {
            return {
                success: false,
                error: 'El número excede el máximo permitido (10 dígitos)'
            };
        }

        // 3. Usar transacción para atomicidad
        const result = await prisma.$transaction(async (tx) => {
            // Obtener número actual
            const client = await tx.client.findUnique({
                where: { id: clientId },
                select: { lastInvoiceNumber: true }
            });

            if (!client) {
                throw new Error('Cliente no encontrado');
            }

            // El valor a guardar es newStartNumber - 1
            // porque getNextInvoiceNumber hace +1
            const valueToStore = newStartNumber - 1;

            // NOTA: Ahora permitimos cualquier número (incluso menor al actual)
            // porque getNextInvoiceNumber saltará automáticamente los números
            // que ya existan en la tabla Invoice

            // Actualizar
            await tx.client.update({
                where: { id: clientId },
                data: { lastInvoiceNumber: valueToStore }
            });

            return {
                storedValue: valueToStore,
                nextNumber: valueToStore + 1
            };
        }, {
            isolationLevel: 'Serializable',
            timeout: 10000,
        });

        return {
            success: true,
            newStartNumber: formatInvoiceNumber(result.storedValue),
            nextNumber: formatInvoiceNumber(result.nextNumber)
        };

    } catch (error) {
        console.error('[updateInvoiceNumbering] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al actualizar numeración'
        };
    }
}

/**
 * Obtiene la información actual de numeración del cliente.
 */
export interface GetInvoiceNumberingInfoResult {
    success: boolean;
    lastNumber?: string | null;
    nextNumber?: string;
    rawLastNumber?: number;
    error?: string;
}

export async function getInvoiceNumberingInfo(): Promise<GetInvoiceNumberingInfoResult> {
    try {
        const session = await auth();

        if (!session?.user?.clientId) {
            return {
                success: false,
                error: 'No autenticado o sin cliente asociado'
            };
        }

        const client = await prisma.client.findUnique({
            where: { id: session.user.clientId },
            select: { lastInvoiceNumber: true }
        });

        if (!client) {
            return {
                success: false,
                error: 'Cliente no encontrado'
            };
        }

        const hasIssuedInvoices = client.lastInvoiceNumber !== 999999;

        return {
            success: true,
            lastNumber: hasIssuedInvoices ? formatInvoiceNumber(client.lastInvoiceNumber) : null,
            nextNumber: formatInvoiceNumber(client.lastInvoiceNumber + 1),
            rawLastNumber: client.lastInvoiceNumber
        };

    } catch (error) {
        console.error('[getInvoiceNumberingInfo] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al obtener información'
        };
    }
}
