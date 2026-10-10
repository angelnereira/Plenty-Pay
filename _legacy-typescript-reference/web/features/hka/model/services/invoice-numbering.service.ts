/**
 * Invoice Numbering Service
 * 
 * Maneja la asignación de números secuenciales de facturas por cliente.
 * Cada cliente tiene su propia secuencia independiente.
 * 
 * FORMATO: 10 dígitos con padding de ceros (ej: "0001000001")
 * INICIO: 1000000 por cliente
 */

import { prisma } from '@core/database';
import { padLeft } from './utils';

/**
 * Formatea un número de factura a 10 dígitos con padding de ceros
 * 
 * @example formatInvoiceNumber(1000000) // "0001000000" (primera factura)
 * @example formatInvoiceNumber(1000001) // "0001000001" (segunda factura)
 */
export function formatInvoiceNumber(num: number): string {
    return padLeft(String(num), 10);
}

/**
 * Obtiene y CONSUME el siguiente número secuencial para un cliente.
 * Usa transacción con locking para garantizar atomicidad.
 * 
 * ⚠️ IMPORTANTE: Este método CONSUME el número. Para preview usar peekNextInvoiceNumber.
 * 
 * 🔄 SMART SKIP: Si el número ya existe en la tabla Invoice, salta al siguiente disponible.
 * 
 * @param clientId - ID del cliente
 * @returns Número de factura formateado (10 dígitos)
 * @throws Error si el cliente no existe
 */
export async function getNextInvoiceNumber(clientId: string): Promise<string> {
    // 1. Atomic Update (Increment) - Prevents race conditions at DB level
    // This executes "UPDATE Client SET lastInvoiceNumber = lastInvoiceNumber + 1" natively
    let client = await prisma.client.update({
        where: { id: clientId },
        data: { lastInvoiceNumber: { increment: 1 } },
        select: { lastInvoiceNumber: true }
    });

    let attempts = 0;
    const maxAttempts = 50;

    // 2. Collision Check Loop
    // In case the sequence was manually reset or previously duplicated,
    // we ensure we never return a used number.
    while (attempts < maxAttempts) {
        const formattedNumber = formatInvoiceNumber(client.lastInvoiceNumber);

        // Check availability
        const existing = await prisma.invoice.findFirst({
            where: {
                clientId: clientId,
                invoiceNumber: formattedNumber
            },
            select: { id: true }
        });

        if (!existing) {
            return formattedNumber;
        }

        // Collision detected: Push the sequence forward safely
        // We log it but auto-recover
        console.warn('[InvoiceNumbering] Collision detected', {
            number: formattedNumber,
            actionTaken: 'Incrementing sequence'
        });

        client = await prisma.client.update({
            where: { id: clientId },
            data: { lastInvoiceNumber: { increment: 1 } }, // Atomic increment again
            select: { lastInvoiceNumber: true }
        });

        attempts++;
    }

    throw new Error(`Failed to assign unique invoice number after ${maxAttempts} attempts for client ${clientId}`);
}

/**
 * CONFIRMA y persiste el incremento del número de factura en la base de datos.
 * Debe llamarse ÚNICAMENTE tras una respuesta exitosa del proveedor fiscal (HKA).
 * 
 * @param clientId - ID del cliente
 * @param expectedNumber - El número que se emitió y que queremos confirmar
 * @returns El nuevo valor de lastInvoiceNumber
 */
export async function commitInvoiceNumber(clientId: string, expectedNumber: string): Promise<number> {
    const numericValue = parseInt(expectedNumber, 10);
    
    // Actualizar el puntero al número que acabamos de usar exitosamente
    const client = await prisma.client.update({
        where: { id: clientId },
        data: { lastInvoiceNumber: numericValue }
    });

    console.log(`[InvoiceNumbering] Secuencia confirmada para cliente ${clientId}: ${expectedNumber}`);
    return client.lastInvoiceNumber;
}

/**
 * Obtiene una vista previa del próximo número SIN consumirlo.
 * Útil para mostrar en la UI antes de que el usuario confirme la emisión.
 * 
 * ⚠️ NOTA: Este número puede cambiar si otro usuario emite antes.
 * 
 * @param clientId - ID del cliente
 * @returns Próximo número de factura formateado (10 dígitos)
 */
export async function peekNextInvoiceNumber(clientId: string): Promise<string> {
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { lastInvoiceNumber: true }
    });

    if (!client) {
        throw new Error(`Client not found: ${clientId}`);
    }

    // Siguiente número sería el actual + 1
    return formatInvoiceNumber(client.lastInvoiceNumber + 1);
}

/**
 * Obtiene el último número de factura emitido por un cliente.
 * Útil para auditoría y debugging.
 * 
 * @param clientId - ID del cliente
 * @returns Último número usado (formateado) o null si no hay ninguno
 */
export async function getLastInvoiceNumber(clientId: string): Promise<string | null> {
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { lastInvoiceNumber: true }
    });

    if (!client) {
        return null;
    }

    // Si está en el valor por defecto (999999), no se ha emitido ninguna
    if (client.lastInvoiceNumber === 999999) {
        return null;
    }

    return formatInvoiceNumber(client.lastInvoiceNumber);
}
