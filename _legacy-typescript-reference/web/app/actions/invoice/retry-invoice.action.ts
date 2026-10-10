'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@core/auth';
import { prismaServer } from '@core/database';
import { retryInvoiceEmission } from './orchestrate-emission.action';
import type { DocumentoElectronico } from '@/features/hka/model/types/types';

/**
 * Reintento de factura existente
 * 
 * Esta acción permite reintentar la emisión de una factura que falló
 * SIN crear duplicados. Usa el mismo registro de factura.
 * 
 * Flujo:
 * 1. Valida permisos y status de la factura
 * 2. Opcionalmente actualiza datos si se proporcionan
 * 3. Resetea status a PROCESSING
 * 4. Incrementa contador de intentos
 * 5. Ejecuta el orquestador de emisión
 * 
 * @param invoiceId - ID de la factura a reintentar
 * @param updatedData - Datos actualizados opcionales (si se editó antes de reintentar)
 */
export async function retryExistingInvoice(
    invoiceId: string,
    updatedData?: DocumentoElectronico
) {
    try {
        console.log('[retryExistingInvoice] 🔄 Iniciando reintento para factura:', invoiceId);

        // 1. Validar autenticación
        const session = await auth();
        if (!session?.user?.id || !session?.user?.clientId) {
            return {
                success: false,
                error: 'No autorizado'
            };
        }

        const { clientId, id: userId } = session.user;

        // 2. Verificar que la factura existe y pertenece al cliente
        const existingInvoice = await prismaServer.invoice.findFirst({
            where: {
                id: invoiceId,
                clientId,
            },
            select: {
                id: true,
                status: true,
                hkaAttempts: true,
                notes: true,
                documentType: true,
            }
        });

        if (!existingInvoice) {
            return {
                success: false,
                error: 'Factura no encontrada'
            };
        }

        // 3. Verificar que el status permite reintento
        const retryableStatuses = ['ERROR', 'REJECTED', 'DRAFT', 'PENDING'];
        if (!retryableStatuses.includes(existingInvoice.status)) {
            return {
                success: false,
                error: `No se puede reintentar una factura con status: ${existingInvoice.status}. Solo se permiten: ${retryableStatuses.join(', ')}`
            };
        }

        // 4. Si hay datos actualizados, guardarlos en la factura
        if (updatedData) {
            console.log('[retryExistingInvoice] 📝 Actualizando datos de la factura');

            // Calcular totales desde el documento actualizado
            const subtotal = parseFloat(updatedData.totalesSubTotales?.totalPrecioNeto || '0');
            const tax = parseFloat(updatedData.totalesSubTotales?.totalITBMS || '0');
            const total = parseFloat(updatedData.totalesSubTotales?.totalFactura || '0');

            // Extraer datos del cliente
            const cliente = updatedData.datosTransaccion?.cliente;
            const razonSocial = 'razonSocial' in cliente ? cliente.razonSocial : '';
            const numeroRUC = 'numeroRUC' in cliente ? cliente.numeroRUC : '';
            const digitoVerificadorRUC = 'digitoVerificadorRUC' in cliente ? cliente.digitoVerificadorRUC : '';
            const correo = 'correoElectronico1' in cliente ? cliente.correoElectronico1 : '';
            const direccion = 'direccion' in cliente ? cliente.direccion : '';

            // CRITICAL: NC/ND NUNCA deben guardar documentoCompleto en notes.
            // Sus campos referenciales (refCufe, refDocumentDate, noteSubtype) viven como
            // columnas en la tabla Invoice y el mapper los lee directamente.
            // Guardar documentoCompleto en notes corrompe el flujo porque el InputAdapter
            // podría usar ese blob en lugar del mapeo relacional correcto.
            const isNotaCredDeb = existingInvoice.documentType === 'NOTA_CREDITO' || existingInvoice.documentType === 'NOTA_DEBITO';

            // Actualizar factura con nuevos datos
            await prismaServer.invoice.update({
                where: { id: invoiceId },
                data: {
                    receiverName: razonSocial,
                    receiverRuc: numeroRUC || null,
                    receiverDv: digitoVerificadorRUC || null,
                    receiverEmail: correo || '',
                    receiverAddress: direccion || '',
                    subtotal,
                    itbms: tax,
                    total,
                    // Solo guardar documentoCompleto para FACTURA — NC/ND usan mapeo relacional
                    ...(isNotaCredDeb ? {} : {
                        notes: JSON.stringify({
                            documentoCompleto: updatedData,
                            lastUpdated: new Date().toISOString(),
                            updatedBy: userId,
                        }),
                    }),
                }
            });
        }

        // 5. Resetear status y preparar para reintento
        console.log('[retryExistingInvoice] ⚡ Preparando factura para reintento');

        await prismaServer.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'PROCESSING',
                hkaStatus: 'PENDING',
                hkaCode: null,
                hkaMessage: null,
                hkaAttempts: { increment: 1 },
                hkaLastAttempt: new Date(),
                currentPhase: 0,
                phaseErrors: [] as any,
            }
        });

        // 6. Log del intento
        await prismaServer.invoiceLog.create({
            data: {
                invoiceId,
                action: 'RETRIED',
                message: `Reintento iniciado. Intento #${(existingInvoice.hkaAttempts || 0) + 1}`,
                userId,
                userEmail: session.user.email || undefined,
                metadata: {
                    previousStatus: existingInvoice.status,
                    hasUpdatedData: !!updatedData,
                }
            }
        });

        // 7. Ejecutar el orquestador de emisión
        console.log('[retryExistingInvoice] 🚀 Ejecutando orquestador de emisión');
        const result = await retryInvoiceEmission(invoiceId);

        // 8. Revalidar rutas
        revalidatePath('/dashboard/facturas');
        revalidatePath(`/dashboard/facturas/${invoiceId}`);
        revalidatePath('/dashboard');

        console.log('[retryExistingInvoice]', result.success ? '✅ Éxito' : '❌ Error', result);

        return {
            success: result.success,
            data: result.invoice,
            phases: result.phases,
            errors: result.errors,
            duration: result.duration,
            error: result.success ? undefined : (result.errors?.[0]?.error?.message || 'Error en la emisión'),
        };

    } catch (error: any) {
        console.error('[retryExistingInvoice] ❌ Error:', error);

        // Intentar marcar la factura como ERROR
        try {
            await prismaServer.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'ERROR',
                    hkaStatus: 'ERROR',
                    hkaMessage: error.message || 'Error inesperado en reintento',
                }
            });
        } catch (updateError) {
            console.error('[retryExistingInvoice] Error actualizando status:', updateError);
        }

        return {
            success: false,
            error: error.message || 'Error inesperado al reintentar la factura'
        };
    }
}

/**
 * Reintento directo sin edición
 * 
 * Versión simplificada que reintenta inmediatamente sin abrir modal de edición.
 * Útil para errores temporales como timeouts de red.
 * 
 * @param invoiceId - ID de la factura a reintentar
 */
export async function directRetryInvoice(invoiceId: string) {
    console.log('[directRetryInvoice] 🚀 Reintento directo para:', invoiceId);
    return retryExistingInvoice(invoiceId);
}
