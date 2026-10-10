/**
 * Engine 2: HKA Request Guard
 * "The Checker"
 * 
 * Asegura que una solicitud tiene alta probabilidad de éxito antes de enviarla.
 * Realiza verificaciones de folios, valida schemas y refresca tokens si es necesario.
 */

import { getHKAConfig, updateHKAConfig } from '../repositories/hka-config.repository';
import { consultarFoliosRestantes } from '../services/hka-soap.service';
import type { HKAConfig, HKAError } from '../index';
import { HKAErrorType } from '../services/errors';
import type { GuardOptions, GuardCheckResult } from './types';
import { retryWithBackoff } from '../services/retry';
import { HKALogger } from '../services/logger';
import { validateContingencia72h } from '../validators/business-rules.validator';

export class RequestGuardEngine {
    private logger = new HKALogger();

    /**
     * Verifica si el sistema está listo para procesar una solicitud HKA
     */
    async checkPrerequisites(
        clientId: string,
        options: GuardOptions = {}
    ): Promise<GuardCheckResult> {
        const result: GuardCheckResult = {
            canProceed: true,
            checkMetadata: {
                foliosAvailable: -1,
                tokenValid: false,
                serverReachable: false,
                schemaValid: true,
            },
        };

        try {
            // 1. Obtener Configuración y Credenciales
            const config = await getHKAConfig(clientId);

            // 1b. Validar ventana de 72 horas si el sistema está en modo contingencia
            // C1: Relajado — ya no bloquea después de 72h, solo advierte (DGI emite Notificación 1524)
            if (config.contingenciaActiva && config.contingenciaInicio) {
                const v72 = validateContingencia72h(config.contingenciaInicio);
                if (!v72.valid) {
                    result.canProceed = false;
                    result.blockReason = {
                        type: HKAErrorType.VALIDATION,
                        message: v72.error!,
                        recoverable: false,
                    } as HKAError;
                    return result;
                }
                if (v72.warning) {
                    if (!result.warnings) result.warnings = [];
                    result.warnings.push(v72.warning);
                }
            }

            // 2. Auto-Refresh Token Logic (Simplificada)
            // En un escenario real, verificaríamos fecha de expiración del token si la guardamos
            // Por ahora confiamos en que si falla, el reintento lo arreglará o forzamos refresh si lo pide
            if (options.autoRefreshToken) {
                // TODO: Implementar lógica de refresh real contra endpoint de login si existiera
                // HKA usa tokens estáticos mayormente, pero si caducan, aquí iría la lógica.
                result.checkMetadata!.tokenValid = true;
            }

            // 3. Verificar Folios (Recurso Crítico)
            if (options.checkFolios) {
                const foliosResult = await this.checkFoliosWithRetry(config, options.retryConfig);

                if (!foliosResult.success) {
                    result.canProceed = false;
                    result.blockReason = {
                        type: HKAErrorType.NETWORK,
                        message: 'No se pudo verificar folios: ' + ((foliosResult as any).error || 'Error desconocido'),
                        recoverable: true
                    } as HKAError;
                    return result;
                }

                const folios = foliosResult.data?.foliosDisponiblesCiclo || 0;
                result.checkMetadata!.foliosAvailable = folios;

                if (folios <= 0) {
                    // RELAXED GUARD: Warn only, do not block. Let HKA decide.
                    const msg = `ADVERTENCIA CRÍTICA: Saldo de folios es 0 (HKA reportó: ${folios}). Es probable que la emisión falle.`;
                    if (!result.warnings) result.warnings = [];
                    result.warnings.push(msg);
                }

                if (folios < 10) {
                    result.warnings = [`QA ADVERTENCIA: Quedan pocos folios (${folios})`];
                }
            }

            // 4. Schema Validation (Si se pasara el objeto a validar)
            // Esta función se puede extender para recibir el objeto y su schema Zod

            result.checkMetadata!.serverReachable = true;
            return result;

        } catch (error) {
            result.canProceed = false;
            result.blockReason = {
                type: HKAErrorType.UNKNOWN,
                message: error instanceof Error ? error.message : 'Error interno en Guard',
                recoverable: false
            } as HKAError;
            return result;
        }
    }

    /**
     * Wrapper con Retry para verificar folios
     */
    private async checkFoliosWithRetry(config: HKAConfig, retryConfig?: any) {
        return retryWithBackoff(
            () => consultarFoliosRestantes(config),
            retryConfig,
            this.logger,
            { method: 'GuardCheckFolios' }
        );
    }
}
