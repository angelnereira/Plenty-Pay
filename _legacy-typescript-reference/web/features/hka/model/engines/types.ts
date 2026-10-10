/**
 * HKA Optimization Engines - Shared Types
 */

import type { DocumentoElectronico, HKAConfig, HKAError } from '../index';

// ============================================
// ENGINE 1: INPUT ADAPTER (The Translator)
// ============================================

export type SupportedInputFormat = 'json' | 'csv' | 'excel' | 'object';

/**
 * Resultado del adaptador de entrada
 */
export interface AdaptationResult {
    success: boolean;
    /** El documento electrónico estandarizado listo para HKA */
    documento?: DocumentoElectronico;
    /** Metadatos del origen de datos */
    sourceMetadata?: {
        format: SupportedInputFormat;
        originalFilename?: string;
        detectedMethod: 'Enviar' | 'Invoicing'; // Por ahora solo Enviar
        itemCount: number;
        totalAmount: number;
    };
    /** Errores de validación inicial */
    errors?: string[];
    /** Advertencias de datos (ej: truncados) */
    warnings?: string[];
}

/**
 * Interface para el adaptador
 */
export interface HKAInputAdapter {
    process(input: unknown, format: SupportedInputFormat): Promise<AdaptationResult>;
}

// ============================================
// ENGINE 2: REQUEST GUARD (The Checker)
// ============================================

export interface GuardCheckResult {
    /** Si se permite proceder con el request */
    canProceed: boolean;
    /** Tokens refrescados si fue necesario */
    refreshedConfig?: HKAConfig;
    /** Errores bloqueantes */
    blockReason?: HKAError;
    /** Advertencias no bloqueantes (ej: folios bajos) */
    warnings?: string[];
    /** Metadatos de la verificación */
    checkMetadata?: {
        foliosAvailable: number;
        tokenValid: boolean;
        serverReachable: boolean;
        schemaValid: boolean;
    };
}

import type { RetryConfig } from '../services/retry';

/**
 * Opciones para el Guard
 */
export interface GuardOptions {
    checkFolios?: boolean;
    validateSchema?: boolean;
    autoRefreshToken?: boolean;
    retryConfig?: Partial<RetryConfig>;
}

// ============================================
// ENGINE 3: RESPONSE PROCESSOR (The Server)
// ============================================

export interface ProcessingResult<T = unknown> {
    success: boolean;
    /** Datos procesados y tipados */
    data?: T;
    /** Estado normalizado */
    status: 'AUTHORIZED' | 'REJECTED' | 'PROCESSING' | 'ERROR';
    /** Si se persistió en BD */
    persisted: boolean;
    /** ID del registro en BD si aplica */
    recordId?: string;
    /** Mensaje amigable para UI */
    uiMessage: string;
    /** Código HKA original */
    hkaCode?: string;
    /** Error si hubo fallo */
    error?: HKAError;
}

export interface ProcessorOptions {
    persistToDB: boolean;
    autoMapStatus: boolean;
    entityId?: string; // ID de factura asociado
}
