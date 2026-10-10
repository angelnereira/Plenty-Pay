/**
 * Engine 3: HKA Response Processor
 * "The Server"
 *
 * Recibe la respuesta cruda de HKA, la procesa, la persiste en base de datos
 * y devuelve un resultado estandarizado para el Frontend.
 */

import { prisma } from '@core/database';
import type { ProcessingResult, ProcessorOptions } from './types';
import type { HKAResponse, EnviarResponse } from '../types/types';
import { HKAError, HKAErrorType, parseHKAError } from '../services/errors';
import { HKALogger } from '../services/logger';

export class ResponseProcessorEngine {
    private logger = new HKALogger();

    /**
     * Procesa la respuesta de emisión de factura
     */
    async processEmissionResponse(
        response: HKAResponse<EnviarResponse>,
        options: ProcessorOptions
    ): Promise<ProcessingResult<EnviarResponse>> {
        try {
            // 1. Validación inicial de respuesta HTTP/SOAP
            if (!response.success) {
                await this.handleError(response, options);
                const classifiedError = parseHKAError(response.code, response.message || 'Error HKA');
                return {
                    success: false,
                    status: 'ERROR',
                    persisted: false,
                    error: classifiedError,
                    uiMessage: classifiedError.toUserMessage(),
                    hkaCode: response.code
                };
            }

            const data = response.data;
            if (!data) {
                return {
                    success: false,
                    status: 'ERROR',
                    persisted: false,
                    uiMessage: 'Respuesta HKA vacía',
                    error: new HKAError(HKAErrorType.UNKNOWN, 'Empty data')
                };
            }

            // 1.5. Verificar que tenemos CUFE (crítico para el éxito)
            if (!data.cufe) {
                this.logger.log({
                    level: 'ERROR',
                    method: 'ResponseProcessor',
                    timestamp: new Date(),
                    invoiceId: options.entityId,
                    metadata: {
                        message: 'Respuesta exitosa de HKA pero sin CUFE',
                        code: response.code,
                        data: data
                    }
                });
                return {
                    success: false,
                    status: 'ERROR',
                    persisted: false,
                    uiMessage: 'Error: Respuesta de HKA sin CUFE. Contacte soporte.',
                    error: new HKAError(HKAErrorType.VALIDATION, 'Missing CUFE in successful response', { code: response.code }),
                    hkaCode: response.code
                };
            }



            // 2. Persistencia (Guardar CUFE, QR, Protocolo)
            let persisted = false;
            if (options.persistToDB && options.entityId) {
                try {
                    // Safe date parsing
                    let protocolDate = new Date();
                    if (data.fechaRecepcionDGI) {
                        const parsedDate = new Date(data.fechaRecepcionDGI);
                        if (!isNaN(parsedDate.getTime())) {
                            protocolDate = parsedDate;
                        }
                    }

                    const updateData = {
                        cufe: data.cufe,
                        qrCode: data.qr, // Base64 del QR
                        qrUrl: data.qr ? `https://dgi-fep.mef.gob.pa/validate?cufe=${data.cufe}` : undefined,
                        hkaProtocol: data.nroProtocoloAutorizacion,
                        hkaProtocolDate: protocolDate,
                        status: 'EMITTED' as const,
                        hkaStatus: 'Autorizado',
                        hkaMessage: response.message || 'Autorizado',
                        hkaCode: response.code,
                        emittedAt: new Date(),
                        // Guardar info completa en hkaResponseData
                        hkaResponseData: {
                            code: response.code,
                            message: response.message,
                            ...data
                        }
                    };

                    try {
                        await prisma.invoice.update({
                            where: { id: options.entityId },
                            data: updateData
                        });
                        persisted = true;
                    } catch (updateError: any) {
                        // Check if it's a unique constraint violation on CUFE
                        if (updateError.code === 'P2002' && updateError.meta?.target?.includes('cufe')) {
                            this.logger.log({
                                level: 'WARN',
                                method: 'ResponseProcessor',
                                timestamp: new Date(),
                                invoiceId: options.entityId,
                                metadata: {
                                    message: 'CUFE duplicado detectado - factura ya existente',
                                    cufe: data.cufe,
                                    attemptedInvoiceId: options.entityId
                                }
                            });

                            // Find the existing invoice with this CUFE
                            const existingInvoice = await prisma.invoice.findUnique({
                                where: { cufe: data.cufe }
                            });

                            if (existingInvoice) {
                                if (existingInvoice.status === 'EMITTED') {
                                    // Case A: Invoice already emitted.
                                    // Just delete the duplicate draft (if different)
                                    if (options.entityId !== existingInvoice.id) {
                                        try {
                                            await prisma.invoice.delete({
                                                where: { id: options.entityId }
                                            });
                                        } catch (delErr) {
                                            this.logger.log({
                                                level: 'WARN',
                                                method: 'ResponseProcessor',
                                                timestamp: new Date(),
                                                metadata: {
                                                    message: 'Could not delete duplicate draft',
                                                    error: String(delErr),
                                                    draftId: options.entityId
                                                }
                                            });
                                        }
                                    }

                                    this.logger.log({
                                        level: 'INFO',
                                        method: 'ResponseProcessor',
                                        timestamp: new Date(),
                                        invoiceId: existingInvoice.id,
                                        metadata: {
                                            message: 'Borrador duplicado eliminado, usando factura existente ya emitida',
                                            cufe: data.cufe,
                                            deletedDraftId: options.entityId,
                                            originalInvoiceId: existingInvoice.id
                                        }
                                    });
                                } else {
                                    // Case B: Invoice exists but not EMITTED (Recovery needed)
                                    // Update existing invoice with new success data
                                    await prisma.invoice.update({
                                        where: { id: existingInvoice.id },
                                        data: updateData
                                    });

                                    // Delete the duplicate draft ONLY if it's a different record (not a retry of the same one)
                                    if (options.entityId !== existingInvoice.id) {
                                        try {
                                            await prisma.invoice.delete({
                                                where: { id: options.entityId }
                                            });
                                        } catch (delErr) {
                                            this.logger.log({
                                                level: 'WARN',
                                                method: 'ResponseProcessor',
                                                timestamp: new Date(),
                                                metadata: {
                                                    message: 'Could not delete duplicate draft (recovery)',
                                                    error: String(delErr),
                                                    draftId: options.entityId
                                                }
                                            });
                                        }
                                    }
                                }

                                // Point to the existing invoice for the response
                                options.entityId = existingInvoice.id;
                                persisted = true;

                            } else {
                                // Couldn't find existing invoice - weird state (P2002 but not found), rethrow
                                throw updateError;
                            }
                        } else {
                            // Not a CUFE duplicate error, rethrow
                            throw updateError;
                        }
                    }

                } catch (dbError) {
                    const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
                    this.logger.log({
                        level: 'ERROR',
                        method: 'ResponseProcessor',
                        timestamp: new Date(),
                        metadata: { message: 'Fallo al persistir datos HKA en BD', error: errorMessage, stack: (dbError as Error).stack }
                    });

                    // CRITICAL: Throw so Orchestrator handles it
                    throw new Error(`Error persistiendo estado EMITTED en BD: ${errorMessage}`);
                }
            }

            // 3. Construcción de Respuesta Standard
            return {
                success: true,
                data,
                status: 'AUTHORIZED',
                persisted,
                recordId: options.entityId,
                uiMessage: `Factura autorizada correctamente. CUFE: ${data.cufe.substring(0, 16)}...`,
                hkaCode: response.code
            };

        } catch (error) {
            return {
                success: false,
                status: 'ERROR',
                persisted: false,
                uiMessage: 'Error interno procesando respuesta',
                error: error instanceof HKAError ? error : new HKAError(HKAErrorType.UNKNOWN, String(error))
            };
        }
    }

    /**
     * Manejo de errores centralizado (Logging, Alertas)
     */
    private async handleError(response: HKAResponse<any>, options: ProcessorOptions) {
        if (options.entityId) {
            await this.logger.log({
                level: 'ERROR',
                method: 'ProcessResponse',
                timestamp: new Date(),
                invoiceId: options.entityId,
                metadata: {
                    code: response.code,
                    message: response.message
                }
            });
        }
    }
}
