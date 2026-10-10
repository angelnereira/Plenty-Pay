/**
 * HKA Feature - Barrel Export
 * Integración con The Factory HKA
 */

// Methods (High-level API)
export {
    checkFoliosDisponibles,
    checkFoliosWithConfig,
    hasAvailableFolios,
    areFoliosLow,
    formatFoliosForDisplay,
    parseLicenseDate
} from './methods/folios';

export {
    validateRUC,
    validateRUCWithConfig,
    validateRUCsBatch,
    detectRUCType,
    formatRUCWithDV,
    type ValidateRUCResult
} from './methods/ruc-validator';

export {
    emitirFactura,
    emitirFacturaWithConfig,
    emitirDocumento,
    emitirDocumentoWithConfig,
    emitirFacturasBatch,
    prepareInvoiceForEmission,
    mapInvoiceToHKA,
    validateInvoiceForHKA
} from './methods/invoice';

export {
    consultarEstado,
    consultarEstadoWithConfig,
    consultarEstadosBatch,
    isDocumentAuthorized,
    getCUFE,
    mapHKAStatusToPrisma,
    type EstadoDocumentoResult
} from './methods/status';

export {
    cancelInvoiceInHKA,
    cancelInvoiceWithConfig,
    canBeCancelled,
    buildCancellationReason,
    MOTIVOS_ANULACION_COMUNES,
    type AnularDocumentoResult
} from './methods/cancellation';

export {
    downloadPDFFromHKA,
    downloadXMLFromHKA,
    downloadPDFWithConfig,
    downloadXMLWithConfig,
    downloadBothDocuments,
    createDownloadResponse,
    type DescargarDocumentoResult
} from './methods/downloads';

export {
    sendInvoiceEmail,
    sendInvoiceEmailWithConfig,
    trackEmailDelivery,
    trackEmailDeliveryWithConfig,
    sendInvoiceToMultipleEmails,
    type EnviarCorreoResult,
    type RastreoCorreoResult,
    type EmailTrackingItem
} from './methods/email';

// Services - SOAP Client
export {
    enviarFactura,
    consultarEstadoDocumento,
    consultarFoliosRestantes,
    consultarRucDV,
    descargarPDF,
    descargarXML,
    anularDocumento,
    enviarCorreo,
    rastrearCorreo,
    HKAClient
} from './services/hka-soap.service';

export {
    InvoiceOrchestrator,
    PHASES,
    PHASE_NAMES,
    type OrchestrationConfig,
    type OrchestrationResult
} from './services/invoice-orchestrator.service';

export {
    getNextInvoiceNumber,
    peekNextInvoiceNumber,
    formatInvoiceNumber,
    getLastInvoiceNumber
} from './services/invoice-numbering.service';

export {
    generarCUFELocal,
    validarCUFE,
    letraADigito,
    type CUFEInput,
    type CUFEResult,
} from './services/cufe.service';

export {
    generarCAFE,
    verificarPlazoTransmision,
    construirMotivoContingenciaXML,
    type CAFEInput,
    type CAFEResult,
    type CAFECabecera,
    type CAFEEmisor,
    type CAFEReceptor,
} from './services/cafe.service';

export * from './engines';

// Repositories
export {
    getHKAConfig,
    getHKACredentials,
    isHKAEnabled,
    updateHKAConfig
} from './repositories/hka-config.repository';

// Factories (Design Pattern)
export { ClienteFactory, type ClienteInput, type ClienteFE, type TipoClienteFE, type TipoRuc } from './factories/cliente.factory';
export { TotalesFactory, ITBMS_RATES, ITBMS_DESCRIPTIONS, type ItemInput, type ItemTotales, type DocumentoTotales } from './factories/totales.factory';

// Validators (Strategy Pattern)
export {
    getValidator,
    validateDocument,
    FacturaValidator,
    NotaCreditoValidator,
    NotaDebitoValidator,
    ExportacionValidator,
    type IDocumentValidator,
    type DocumentValidationResult,
    type ValidationIssue,
} from './validators/document.validator';

// Facade (Unified API)
export { HKAFacade, hkaFacade } from './hka.facade';
export type {
    EmissionResult,
    FoliosResult,
    RUCValidationResult,
    DocumentStatusResult,
} from './hka.facade';

// Decorators (Cross-cutting concerns)
export {
    withLogging,
    withRetry,
    withTimeout,
    withMetrics,
    withObservability,
    Decorators,
    metricsCollector,
    type LoggingOptions,
    type RetryOptions,
    type MetricsOptions,
    type TimeoutOptions,
} from './decorators';

// Types - Re-export types
export type * from './types/types';

// Utils
export * from './services/utils';
export * from './services/errors';
