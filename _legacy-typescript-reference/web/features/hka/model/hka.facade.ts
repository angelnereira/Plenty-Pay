/**
 * HKA Facade
 * 
 * Unified high-level API for all HKA operations.
 * Simplifies complex HKA operations into easy-to-use methods.
 * 
 * This facade:
 * - Handles configuration retrieval
 * - Provides consistent error handling with Result pattern
 * - Orchestrates multiple services
 * - Logs operations appropriately
 * 
 * @module lib/features/hka/hka.facade
 */

import {
    Ok,
    Err,
    ConfigurationError,
    ExternalServiceError,
    type AsyncServiceResult,
} from '@shared/lib/result';
import { getHKAConfig } from './repositories/hka-config.repository';
import { HKAClient } from './services/hka-soap.service';
import { validateDocument } from './validators/document.validator';
import type {
    HKAConfig,
    DocumentoElectronico,
    DatosDocumento,
} from './types/types';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('HKAFacade');

// ============================================
// TYPES
// ============================================

/**
 * Result of invoice emission
 */
export interface EmissionResult {
    cufe: string;
    qr?: string;
    protocolo?: string;
    fechaRecepcionDGI?: string;
    numeroDocumentoFiscal: string;
}

/**
 * Result of folio check
 */
export interface FoliosResult {
    foliosDisponibles: number;
    foliosLicencia: number;
    foliosUsados: number;
    fechaVencimiento?: string;
    isLow: boolean;
    percentUsed: number;
}

/**
 * Result of RUC validation
 */
export interface RUCValidationResult {
    isValid: boolean;
    ruc: string;
    dv: string;
    razonSocial?: string;
    tipoRuc?: string;
}

/**
 * Document status result
 */
export interface DocumentStatusResult {
    status: string;
    statusCode?: string;
    cufe?: string;
    fechaEmision?: string;
    fechaAutorizacion?: string;
    mensaje?: string;
}

// ============================================
// HELPER
// ============================================

/**
 * Build DatosDocumento from config and document number
 */
function buildDatosDocumento(
    config: HKAConfig,
    numeroDocumentoFiscal: string,
    tipoDocumento: string = '01'
): DatosDocumento {
    return {
        codigoSucursalEmisor: config.branchCode,
        numeroDocumentoFiscal: numeroDocumentoFiscal.padStart(10, '0'),
        puntoFacturacionFiscal: config.puntoFacturacionFiscal,
        tipoDocumento: tipoDocumento as DatosDocumento['tipoDocumento'],
        tipoEmision: config.tipoEmision,
    };
}

// ============================================
// FACADE CLASS
// ============================================

export class HKAFacade {
    /**
     * Emit an invoice to HKA
     * 
     * @param clientId - Client ID to get HKA configuration
     * @param documento - Electronic document to emit
     * @returns Result with emission data or error
     */
    static async emitInvoice(
        clientId: string,
        documento: DocumentoElectronico
    ): AsyncServiceResult<EmissionResult> {
        try {
            logger.info({ clientId }, 'Starting invoice emission');

            // 1. Get HKA configuration
            let config: HKAConfig;
            try {
                config = await getHKAConfig(clientId);
            } catch (error) {
                logger.error({ error }, 'Failed to get HKA config');
                return Err(new ConfigurationError('hkaConfig', error instanceof Error ? error.message : 'Failed to load HKA configuration'));
            }

            // 2. Validate document
            const validationResult = validateDocument(documento);
            if (!validationResult.ok) {
                logger.warn({ issues: validationResult.error }, 'Document validation failed');
                return validationResult;
            }

            // 3. Emit via SOAP
            logger.info('Sending document to HKA');
            const response = await HKAClient.enviarFactura(config, documento);

            if (!response.success) {
                logger.error({ code: response.code, message: response.message }, 'HKA emission failed');
                return Err(new ExternalServiceError(
                    'HKA',
                    response.message || 'Error al emitir factura',
                    response.code
                ));
            }

            const data = response.data;
            if (!data?.cufe) {
                return Err(new ExternalServiceError('HKA', 'Respuesta de HKA no contiene CUFE'));
            }

            logger.info({ cufe: data.cufe }, 'Invoice emitted successfully');

            return Ok({
                cufe: data.cufe,
                qr: data.qr,
                protocolo: data.nroProtocoloAutorizacion,
                fechaRecepcionDGI: data.fechaRecepcionDGI,
                numeroDocumentoFiscal: documento.datosTransaccion?.numeroDocumentoFiscal || '',
            });
        } catch (error) {
            logger.error({ error }, 'Unexpected error in emitInvoice');
            return Err(new ExternalServiceError(
                'HKA',
                error instanceof Error ? error.message : 'Error inesperado'
            ));
        }
    }

    /**
     * Check available folios
     * 
     * @param clientId - Client ID
     * @returns Result with folio information
     */
    static async checkFolios(
        clientId: string
    ): AsyncServiceResult<FoliosResult> {
        try {
            // Get HKA configuration
            let config: HKAConfig;
            try {
                config = await getHKAConfig(clientId);
            } catch (error) {
                return Err(new ConfigurationError('hkaConfig', error instanceof Error ? error.message : 'Failed to load HKA configuration'));
            }

            // Query folios
            const response = await HKAClient.consultarFoliosRestantes(config);

            if (!response.success) {
                return Err(new ExternalServiceError(
                    'HKA',
                    response.message || 'Error al consultar folios',
                    response.code
                ));
            }

            const data = response.data;
            if (!data) {
                return Err(new ExternalServiceError('HKA', 'Respuesta de HKA no contiene datos de folios'));
            }

            const disponibles = data.foliosDisponiblesCiclo ?? 0;
            const total = data.foliosTotales ?? data.foliosTotalesCiclo ?? 0;
            const usados = data.foliosUtilizadosCiclo ?? 0;
            const percentUsed = total > 0 ? (usados / total) * 100 : 0;

            return Ok({
                foliosDisponibles: disponibles,
                foliosLicencia: total,
                foliosUsados: usados,
                fechaVencimiento: data.fechaLicencia,
                isLow: disponibles < 10 || percentUsed > 90,
                percentUsed,
            });
        } catch (error) {
            return Err(new ExternalServiceError(
                'HKA',
                error instanceof Error ? error.message : 'Error inesperado'
            ));
        }
    }

    /**
     * Validate a RUC and get its DV
     * 
     * @param clientId - Client ID
     * @param tipoRuc - Type of RUC ('1' = Natural, '2' = Legal)
     * @param ruc - RUC to validate
     * @returns Result with RUC validation info
     */
    static async validateRUC(
        clientId: string,
        tipoRuc: '1' | '2',
        ruc: string
    ): AsyncServiceResult<RUCValidationResult> {
        try {
            // Get HKA configuration
            let config: HKAConfig;
            try {
                config = await getHKAConfig(clientId);
            } catch (error) {
                return Err(new ConfigurationError('hkaConfig', error instanceof Error ? error.message : 'Failed to load HKA configuration'));
            }

            // Query RUC
            const response = await HKAClient.consultarRucDV(config, tipoRuc, ruc);

            if (!response.success) {
                return Err(new ExternalServiceError(
                    'HKA',
                    response.message || 'Error al validar RUC',
                    response.code
                ));
            }

            const data = response.data;
            if (!data) {
                return Err(new ExternalServiceError('HKA', 'Respuesta de HKA no contiene datos'));
            }

            return Ok({
                isValid: response.success && !!data.dv,
                ruc: data.ruc || ruc,
                dv: data.dv || '',
                razonSocial: data.razonSocial,
                tipoRuc: tipoRuc,
            });
        } catch (error) {
            return Err(new ExternalServiceError(
                'HKA',
                error instanceof Error ? error.message : 'Error inesperado'
            ));
        }
    }

    /**
     * Get document status
     * 
     * @param clientId - Client ID
     * @param numeroDocumentoFiscal - Document number to check
     * @returns Result with document status
     */
    static async getDocumentStatus(
        clientId: string,
        numeroDocumentoFiscal: string
    ): AsyncServiceResult<DocumentStatusResult> {
        try {
            // Get HKA configuration
            let config: HKAConfig;
            try {
                config = await getHKAConfig(clientId);
            } catch (error) {
                return Err(new ConfigurationError('hkaConfig', error instanceof Error ? error.message : 'Failed to load HKA configuration'));
            }

            // Build DatosDocumento
            const datosDocumento = buildDatosDocumento(config, numeroDocumentoFiscal);

            // Query status
            const response = await HKAClient.consultarEstadoDocumento(config, datosDocumento);

            if (!response.success) {
                return Err(new ExternalServiceError(
                    'HKA',
                    response.message || 'Error al consultar estado',
                    response.code
                ));
            }

            const data = response.data;
            if (!data) {
                return Err(new ExternalServiceError('HKA', 'Respuesta de HKA no contiene datos'));
            }

            return Ok({
                status: data.estatusDocumento || 'UNKNOWN',
                statusCode: response.code,
                cufe: data.cufe,
                fechaEmision: data.fechaEmisionDocumento,
                fechaAutorizacion: data.fechaRecepcionDocumento,
                mensaje: data.mensajeDocumento,
            });
        } catch (error) {
            return Err(new ExternalServiceError(
                'HKA',
                error instanceof Error ? error.message : 'Error inesperado'
            ));
        }
    }

    /**
     * Download PDF from HKA
     * 
     * @param clientId - Client ID
     * @param numeroDocumentoFiscal - Document number
     * @returns Result with PDF as base64 string
     */
    static async downloadPDF(
        clientId: string,
        numeroDocumentoFiscal: string
    ): AsyncServiceResult<string> {
        try {
            // Get HKA configuration
            let config: HKAConfig;
            try {
                config = await getHKAConfig(clientId);
            } catch (error) {
                return Err(new ConfigurationError('hkaConfig', error instanceof Error ? error.message : 'Failed to load HKA configuration'));
            }

            const datosDocumento = buildDatosDocumento(config, numeroDocumentoFiscal);

            const response = await HKAClient.descargarPDF(config, datosDocumento);

            if (!response.success) {
                return Err(new ExternalServiceError(
                    'HKA',
                    response.message || 'Error al descargar PDF',
                    response.code
                ));
            }

            if (!response.data?.documento) {
                return Err(new ExternalServiceError('HKA', 'Respuesta no contiene documento PDF'));
            }

            return Ok(response.data.documento);
        } catch (error) {
            return Err(new ExternalServiceError(
                'HKA',
                error instanceof Error ? error.message : 'Error inesperado'
            ));
        }
    }

    /**
     * Download XML from HKA
     * 
     * @param clientId - Client ID
     * @param numeroDocumentoFiscal - Document number
     * @returns Result with XML as base64 string
     */
    static async downloadXML(
        clientId: string,
        numeroDocumentoFiscal: string
    ): AsyncServiceResult<string> {
        try {
            // Get HKA configuration
            let config: HKAConfig;
            try {
                config = await getHKAConfig(clientId);
            } catch (error) {
                return Err(new ConfigurationError('hkaConfig', error instanceof Error ? error.message : 'Failed to load HKA configuration'));
            }

            const datosDocumento = buildDatosDocumento(config, numeroDocumentoFiscal);

            const response = await HKAClient.descargarXML(config, datosDocumento);

            if (!response.success) {
                return Err(new ExternalServiceError(
                    'HKA',
                    response.message || 'Error al descargar XML',
                    response.code
                ));
            }

            if (!response.data?.documento) {
                return Err(new ExternalServiceError('HKA', 'Respuesta no contiene documento XML'));
            }

            return Ok(response.data.documento);
        } catch (error) {
            return Err(new ExternalServiceError(
                'HKA',
                error instanceof Error ? error.message : 'Error inesperado'
            ));
        }
    }

    /**
     * Cancel an invoice in HKA
     * 
     * @param clientId - Client ID
     * @param numeroDocumentoFiscal - Document number to cancel
     * @param motivo - Cancellation reason
     * @returns Result indicating success or error
     */
    static async cancelInvoice(
        clientId: string,
        numeroDocumentoFiscal: string,
        motivo: string
    ): AsyncServiceResult<void> {
        try {
            logger.info({ clientId, numeroDocumentoFiscal }, 'Starting invoice cancellation');

            // Get HKA configuration
            let config: HKAConfig;
            try {
                config = await getHKAConfig(clientId);
            } catch (error) {
                return Err(new ConfigurationError('hkaConfig', error instanceof Error ? error.message : 'Failed to load HKA configuration'));
            }

            const datosDocumento = buildDatosDocumento(config, numeroDocumentoFiscal);

            const response = await HKAClient.anularDocumento(config, datosDocumento, motivo);

            if (!response.success) {
                logger.error({ code: response.code, message: response.message }, 'HKA cancellation failed');
                return Err(new ExternalServiceError(
                    'HKA',
                    response.message || 'Error al anular documento',
                    response.code
                ));
            }

            logger.info({ numeroDocumentoFiscal }, 'Invoice cancelled successfully');
            return Ok(undefined);
        } catch (error) {
            logger.error({ error }, 'Unexpected error in cancelInvoice');
            return Err(new ExternalServiceError(
                'HKA',
                error instanceof Error ? error.message : 'Error inesperado'
            ));
        }
    }

    /**
     * Send invoice via email through HKA
     * 
     * @param clientId - Client ID
     * @param numeroDocumentoFiscal - Document number
     * @param email - Email to send to
     * @returns Result indicating success or error
     */
    static async sendEmail(
        clientId: string,
        numeroDocumentoFiscal: string,
        email: string
    ): AsyncServiceResult<void> {
        try {
            // Get HKA configuration
            let config: HKAConfig;
            try {
                config = await getHKAConfig(clientId);
            } catch (error) {
                return Err(new ConfigurationError('hkaConfig', error instanceof Error ? error.message : 'Failed to load HKA configuration'));
            }

            const datosDocumento = buildDatosDocumento(config, numeroDocumentoFiscal);

            const response = await HKAClient.enviarCorreo(config, datosDocumento, email);

            if (!response.success) {
                return Err(new ExternalServiceError(
                    'HKA',
                    response.message || 'Error al enviar correo',
                    response.code
                ));
            }

            return Ok(undefined);
        } catch (error) {
            return Err(new ExternalServiceError(
                'HKA',
                error instanceof Error ? error.message : 'Error inesperado'
            ));
        }
    }
}

// Export singleton-style access
export const hkaFacade = HKAFacade;
