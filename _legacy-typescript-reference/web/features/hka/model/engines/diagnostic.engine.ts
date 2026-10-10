/**
 * Engine 4: Diagnostic Engine
 * "The Doctor"
 * 
 * Responsable de monitorear fallos, analizar la causa raíz (Diagnosis)
 * y sugerir acciones correctivas (Prescription).
 */

import { HKAError, HKAErrorType } from '../services/errors';
import { PHASES, type PhaseIndex, PHASE_NAMES } from '../services/invoice-orchestrator.service';

export type DiagnosticSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FailureCategory =
    | 'DATA_INTEGRITY'   // Error en los datos de entrada (Culpa del usuario/sistema origen)
    | 'COMPLIANCE'       // Error de reglas de negocio HKA (Guard)
    | 'COMMUNICATION'    // Error de red o timeout (Culpa de la red/HKA)
    | 'PROTOCOL'         // Error SOAP/XML (Culpa del código/librería)
    | 'INTERNAL';        // Error de sistema/base de datos (Culpa nuestra)

export interface DiagnosticContext {
    invoiceId: string;
    phase: number;
    error: unknown;
    metadata?: Record<string, any>;
}

export interface DiagnosticReport {
    diagnosisId: string;        // ID único del diagnóstico
    timestamp: Date;
    severity: DiagnosticSeverity;
    category: FailureCategory;
    component: string;          // Qué motor falló
    rootCause: string;          // Explicación técnica
    userMessage: string;        // Explicación amigable
    suggestedAction: string;    // Qué hacer (Reintentar validación, corregir cliente, contactar soporte)
    canRetry: boolean;
}

export class DiagnosticEngine {

    /**
     * Analiza un fallo ocurrido en cualquier parte del pipeline HKA
     */
    analyzeFailure(context: DiagnosticContext): DiagnosticReport {
        const { phase, error } = context;
        const errorMsg = error instanceof Error ? error.message : String(error);

        let category: FailureCategory = 'INTERNAL';
        let severity: DiagnosticSeverity = 'HIGH';
        let suggestedAction = 'Contactar a soporte técnico';
        let canRetry = false;
        let component = this.getComponentByPhase(phase);

        // 1. Análisis por Fase (Componente)
        if (phase === PHASES.INIT) {
            category = 'INTERNAL';
            component = 'Orchestrator (Init)';
        }
        else if (phase === PHASES.VALIDATE_PREREQUISITES) { // Engine 2: Guard
            component = 'Engine 2: Request Guard';
            if (errorMsg.includes('Folios')) {
                category = 'COMPLIANCE';
                severity = 'CRITICAL';
                suggestedAction = 'Solicitar nuevos folios al PAC urgentemente';
            } else if (errorMsg.includes('Token')) {
                category = 'COMMUNICATION';
                severity = 'HIGH';
                canRetry = true;
                suggestedAction = 'El sistema reintentará refrescar el token automáticamente';
            }
        }
        else if (phase === PHASES.EMIT_INVOICE) { // Engine 1: Adapter o SOAP Client
            // Aquí es delicado distinguir entre Adapter y Client sin más contexto, 
            // pero el mensaje de error suele ayudar.
            if (errorMsg.includes('adaptación') || errorMsg.includes('Campo obligatorio')) {
                component = 'Engine 1: Input Adapter';
                category = 'DATA_INTEGRITY';
                severity = 'MEDIUM';
                suggestedAction = 'Corregir los datos de la factura o del cliente (RUC, DV, Items)';
            } else if (errorMsg.includes('SOAP') || errorMsg.includes('connect') || errorMsg.includes('timeout')) {
                component = 'SOAP Client';
                category = 'COMMUNICATION';
                severity = 'HIGH';
                canRetry = true;
                suggestedAction = 'Verificar conexión a internet y reintentar emisión';
            } else {
                component = 'HKA Core'; // Puede ser Processor rechazando
                category = 'PROTOCOL';
            }
        }
        // ... Fases background

        // 2. Análisis por Tipo de Error (HKAError)
        if (error instanceof HKAError) {
            switch (error.type) {
                case HKAErrorType.NETWORK:
                case HKAErrorType.TIMEOUT:
                    category = 'COMMUNICATION';
                    canRetry = true;
                    suggestedAction = 'Error de conexión temporal. Reintente en unos momentos.';
                    break;

                case HKAErrorType.VALIDATION:
                    category = 'DATA_INTEGRITY';
                    canRetry = false;
                    suggestedAction = 'Datos inválidos según reglas HKA. Revise el RUC y montos.';
                    break;

                case HKAErrorType.AUTHENTICATION:
                    category = 'COMPLIANCE';
                    canRetry = false;
                    suggestedAction = 'Credenciales PAC inválidas o expiradas. Verifique tokenEmpresa y tokenPassword.';
                    break;

                case HKAErrorType.DOCUMENT_ERROR:
                    category = 'DATA_INTEGRITY';
                    severity = 'HIGH';
                    canRetry = false;
                    suggestedAction = 'Error de esquema XSD o datos del documento. Revise estructura y campos obligatorios.';
                    break;

                case HKAErrorType.DGI_TIMEOUT:
                    category = 'COMMUNICATION';
                    severity = 'HIGH';
                    canRetry = false; // NO reintentar Enviar() — documento en cola
                    suggestedAction = 'La DGI no respondió a tiempo. El documento está en cola de HKA. ' +
                        'NO reenvíe. Use EstadoDocumento() para consultar el estado.';
                    break;

                case HKAErrorType.HKA_INTERNAL_ERROR:
                    category = 'COMMUNICATION';
                    severity = 'MEDIUM';
                    canRetry = true;
                    suggestedAction = 'Error interno temporal de HKA (código 201). ' +
                        'El sistema reintentará automáticamente con backoff exponencial.';
                    break;

                case HKAErrorType.SERVICE_UNAVAILABLE:
                    category = 'COMMUNICATION';
                    severity = 'HIGH';
                    canRetry = true;
                    suggestedAction = 'Servicio HKA no disponible (código 300). Reintentando automáticamente.';
                    break;
            }
        }

        return {
            diagnosisId: `DIAG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date(),
            severity,
            category,
            component,
            rootCause: errorMsg,
            userMessage: this.getUserFriendlyMessage(category, errorMsg),
            suggestedAction,
            canRetry
        };
    }

    private getComponentByPhase(phase: number): string {
        return PHASE_NAMES[phase] || `Phase ${phase}`;
    }

    private getUserFriendlyMessage(category: FailureCategory, technicalError: string): string {
        switch (category) {
            case 'DATA_INTEGRITY':
                return 'Hay un problema con los datos de la factura o el cliente. Por favor revise y corrija.';
            case 'COMMUNICATION':
                return 'No pudimos conectar con los servidores de la DGI/PAC. Es un problema temporal de red.';
            case 'COMPLIANCE':
                return 'La operación fue bloqueada por falta de requisitos (Folios, Permisos).';
            case 'PROTOCOL':
                return 'Ocurrió un error técnico en el protocolo de comunicación.';
            default:
                return `Error interno del sistema: ${technicalError}`;
        }
    }
}
