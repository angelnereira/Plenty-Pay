'use server';

import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { enviarFactura } from '@/features/hka/model/services/hka-soap.service';
import { getNextInvoiceNumber } from '@/features/hka/model/services/invoice-numbering.service';
import type { DocumentoElectronico, HKAConfig } from '@/features/hka/model/types/types';
import { saveInvoiceToDB } from '@/features/hka/model/services/invoice-storage.service';
import { decrypt } from '@/lib/utils/encryption';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('EmitFullInvoice');

/**
 * Server Action: Emit Full Invoice
 * Envía una factura completa a HKA para certificación en DGI
 *
 * ⚠️ **DEPRECATED**: Este archivo se mantiene por compatibilidad temporal.
 * Use `emit-invoice.action.ts` con InvoiceOrchestrator en su lugar.
 * Este archivo será eliminado en v2.0.0
 *
 * IMPORTANTE: Esta action asigna el número de factura ATÓMICAMENTE
 * para garantizar secuencialidad e impedir duplicados.
 *
 * @deprecated Use emitInvoice from emit-invoice.action.ts instead
 * @param documento - Documento electrónico en formato HKA
 * @returns Resultado de la emisión con CUFE, QR, y demás datos
 */
export async function emitFullInvoice(documento: DocumentoElectronico) {
    try {
        logger.info('Iniciando emisión de factura');

        // 1. Autenticar usuario
        const session = await auth();
        if (!session?.user?.id || !session?.user?.clientId) {
            logger.error('Usuario no autenticado');
            return {
                success: false,
                error: 'Usuario no autenticado. Por favor inicie sesión nuevamente.'
            };
        }

        const { clientId, id: userId } = session.user;
        logger.info({ userId, clientId }, 'Usuario autenticado');

        // 2. Obtener configuración HKA del cliente
        const client = await prisma.client.findUnique({
            where: { id: clientId },
        });

        if (!client) {
            logger.error({ clientId }, 'Cliente no encontrado');
            return {
                success: false,
                error: 'Cliente no encontrado en la base de datos.'
            };
        }

        // Extraer configuración HKA del metadata del cliente
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metadata = client.metadata as any;
        const hkaConfig = metadata?.hka || {};

        // Buscar tokens: primero en client model, luego en metadata
        const tokenEmpresa = client.hkaTokenUser || hkaConfig.tokenEmpresa;

        // CRÍTICO: Desencriptar el password antes de usarlo
        const encryptedPassword = client.hkaTokenPassword || hkaConfig.tokenPassword;
        const tokenPassword = encryptedPassword ? decrypt(encryptedPassword) : '';

        logger.debug({
            hasTokenFromModel: !!client.hkaTokenUser,
            hasTokenFromMetadata: !!hkaConfig.tokenEmpresa,
            hasToken: !!tokenEmpresa,
            hasPasswordFromModel: !!client.hkaTokenPassword,
            hasPasswordFromMetadata: !!hkaConfig.tokenPassword,
            hasPassword: !!tokenPassword,
            passwordWasEncrypted: !!encryptedPassword && encryptedPassword.includes(':'),
        }, 'Verificando credenciales HKA');

        if (!tokenEmpresa || !tokenPassword) {
            logger.error({
                hasToken: !!tokenEmpresa,
                hasPassword: !!tokenPassword,
                checkedClientModel: !!client.hkaTokenUser,
                checkedMetadata: !!hkaConfig.tokenEmpresa,
            }, 'Credenciales HKA incompletas');
            return {
                success: false,
                error: 'Configuración de HKA incompleta. Por favor configure sus credenciales HKA en Configuración.'
            };
        }

        // Construir configuración completa de HKA
        const config: HKAConfig = {
            tokenEmpresa,
            tokenPassword,  // ← Ahora está desencriptado
            environment: client.hkaEnvironment || hkaConfig.environment || 'prod',
            branchCode: client.branchCode || hkaConfig.branchCode || '0000',
            tipoSucursal: hkaConfig.tipoSucursal || '1',
            puntoFacturacionFiscal: hkaConfig.puntoFacturacionFiscal || '001',
            locationCode: client.locationCode || hkaConfig.locationCode || '0-0-0',
            provincia: client.province || hkaConfig.provincia || '',
            distrito: client.district || hkaConfig.distrito || '',
            corregimiento: client.corregimiento || hkaConfig.corregimiento || '',
            tipoEmision: hkaConfig.tipoEmision || '01',
            destinoOperacion: hkaConfig.destinoOperacion || '1',
            entregaCAFE: hkaConfig.entregaCAFE || '1',
            formatoCAFE: hkaConfig.formatoCAFE || '1',
            envioContenedor: hkaConfig.envioContenedor || '1',
            procesoGeneracion: hkaConfig.procesoGeneracion || '1',
        };

        logger.info({ environment: config.environment }, 'Configuración HKA lista');

        // 3. ASIGNAR NÚMERO SECUENCIAL ATÓMICAMENTE
        // Esto garantiza que no hayan facturas duplicadas ni saltos en la numeración
        logger.debug('Asignando número de factura secuencial');
        const numeroDocumentoFiscal = await getNextInvoiceNumber(clientId);
        logger.info({ numeroDocumentoFiscal }, 'Número de factura asignado');

        // Actualizar el documento con el número asignado
        const documentoConNumero: DocumentoElectronico = {
            ...documento,
            datosTransaccion: {
                ...documento.datosTransaccion,
                numeroDocumentoFiscal: numeroDocumentoFiscal,
            }
        };

        // 4. Enviar a HKA
        logger.info({ numeroDocumentoFiscal }, 'Enviando factura a HKA/DGI');
        const result = await enviarFactura(config, documentoConNumero);

        logger.info({
            success: result.success,
            code: result.code,
            message: result.message,
        }, 'Respuesta recibida de HKA');

        // 5. Guardar en base de datos si fue exitoso
        let savedInvoiceId: string | undefined;

        if (result.success && result.data) {
            logger.info('Guardando factura en base de datos');
            logger.debug({
                hasCufe: !!result.data.cufe,
                hasQr: !!result.data.qr,
                fechaRecepcionDGI: result.data.fechaRecepcionDGI,
                protocolo: result.data.nroProtocoloAutorizacion,
                codigo: result.code,
            }, 'Datos HKA recibidos');

            try {
                const savedInvoice = await saveInvoiceToDB({
                    clientId,
                    userId,
                    documento: documentoConNumero,  // Usar documento con número asignado
                    hkaResponse: result.data,
                    status: 'EMITTED',  // Usar enum correcto de Prisma
                    // ⭐ Pasar código y mensaje de respuesta HKA
                    hkaCode: result.code || '200',
                    hkaMessage: result.message || 'Documento certificado exitosamente',
                });
                savedInvoiceId = savedInvoice.id;
                logger.info({
                    invoiceId: savedInvoiceId,
                    hasCufe: !!savedInvoice.cufe,
                    status: savedInvoice.status,
                    invoiceNumber: savedInvoice.invoiceNumber,
                }, 'Factura guardada en base de datos');
            } catch (dbError) {
                logger.error({
                    err: dbError,
                    errorName: dbError instanceof Error ? dbError.name : 'Unknown',
                    errorMessage: dbError instanceof Error ? dbError.message : String(dbError),
                }, 'Error guardando factura en DB');
                // NOTA: No fallamos la respuesta si HKA fue exitoso pero DB falló
                // La factura SÍ fue certificada en HKA, solo no se guardó localmente
            }
        }

        // 6. Retornar resultado
        logger.info({
            success: result.success,
            code: result.code,
            hasData: !!result.data,
            hasCufe: !!result.data?.cufe,
            invoiceId: savedInvoiceId,
            numeroDocumentoFiscal,
        }, 'Preparando respuesta');

        return {
            success: result.success,
            data: { // Siempre retornamos estructura 'envio' para manejar errores detallados
                envio: {
                    codigo: result.code || (result.success ? '200' : '500'),
                    mensaje: result.message || (result.success ? 'Factura certificada exitosamente' : 'Error desconocido'),
                    cufe: result.data?.cufe || '',
                    qr: result.data?.qr || '',
                    fechaRecepcionDGI: result.data?.fechaRecepcionDGI || '',
                    nroProtocoloAutorizacion: result.data?.nroProtocoloAutorizacion || '',
                    numeroDocumentoFiscal: numeroDocumentoFiscal,  // Usar el número asignado
                    invoiceId: savedInvoiceId
                }
            },
            error: result.success ? undefined : result.message,
        };

    } catch (error) {
        logger.error({ err: error }, 'Error inesperado al emitir factura');
        return {
            success: false,
            error: error instanceof Error
                ? `Error al emitir factura: ${error.message}`
                : 'Error inesperado al emitir factura. Por favor contacte a soporte.',
        };
    }
}
