/**
 * HKA Environment Detection Service
 *
 * Detecta automáticamente si un par de tokens (empresa/password)
 * corresponde al ambiente de Demo o Producción.
 */

import { HKAClient } from './hka-soap.service';
import type { HKAConfig } from '../types/types';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('HKA-Detection');

/**
 * Detecta el ambiente de HKA probando las credenciales
 * contra ambos endpoints (Demo y Prod).
 */
export async function detectHKAEnvironment(
    tokenEmpresa: string,
    tokenPassword: string
): Promise<'demo' | 'prod' | null> {
    const envs: ('demo' | 'prod')[] = ['demo', 'prod'];

    for (const env of envs) {
        try {
            logger.info({ env }, 'Probando ambiente HKA');

            // Crear config mínima para la prueba
            const config: Partial<HKAConfig> = {
                tokenEmpresa,
                tokenPassword,
                environment: env,
            };

            // Intentar llamar a FoliosRestantes (es ligero y solo requiere tokens)
            const response = await HKAClient.consultarFoliosRestantes(config as HKAConfig);

            if (response.success) {
                logger.info({ env }, 'Ambiente HKA detectado exitosamente');
                return env;
            }

            logger.debug({ env, code: response.code, message: response.message }, 'Fallo en prueba de ambiente');
        } catch (error) {
            logger.error({ env, err: error }, 'Error probando ambiente HKA');
        }
    }

    return null;
}
