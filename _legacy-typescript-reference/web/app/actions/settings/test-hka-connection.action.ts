/**
 * Server Action: Test HKA Connection
 * Prueba conexión y credenciales HKA mediante el método FoliosRestantes
 *
 * IMPLEMENTACIÓN COMPLETA según documentación oficial HKA 2026
 */

'use server';

import { auth } from '@core/auth';
import { getHKAConfig } from '@/features/hka/model/repositories/hka-config.repository';
import { consultarFoliosRestantes } from '@/features/hka/model/services/hka-soap.service';
import { HKALogger } from '@/features/hka/model/services/logger';

const logger = new HKALogger();

/**
 * Output: Resultado de test de conexión
 */
export interface TestHkaConnectionOutput {
  success: boolean;
  message: string;
  details?: {
    // Información de licencia
    licencia?: string;
    fechaLicencia?: string;

    // Información de ciclo
    ciclo?: string;
    fechaCiclo?: string;

    // Folios del ciclo actual
    foliosTotalesCiclo?: number;
    foliosUtilizadosCiclo?: number;
    foliosDisponibleCiclo?: number;

    // Folios totales (históricos)
    foliosTotales?: number;
    foliosTotalesDisponibles?: number;

    // Metadatos de la prueba
    environment?: 'DEMO' | 'PROD';
    responseTime?: number;
    codigoRespuesta?: string;
  };
  error?: string;
}

/**
 * Prueba conexión con HKA
 * Utiliza el método más simple (FoliosRestantes) para verificar:
 * 1. Conectividad con el servicio HKA
 * 2. Validez de credenciales (tokenEmpresa, tokenPassword)
 * 3. Disponibilidad de folios para facturación
 */
export async function testHkaConnection(): Promise<TestHkaConnectionOutput> {
  const session = await auth();

  if (!session?.user?.clientId) {
    return {
      success: false,
      message: 'No autenticado',
      error: 'Debe iniciar sesión para probar la conexión con HKA.'
    };
  }

  try {
    // Obtener configuración HKA del cliente
    await logger.log({
      level: 'INFO',
      method: 'testHkaConnection',
      timestamp: new Date(),
      metadata: {
        clientId: session.user.clientId,
        action: 'Iniciando test de conexión HKA'
      }
    });

    const config = await getHKAConfig(session.user.clientId);

    // Validar que la configuración esté completa
    if (!config.tokenEmpresa || !config.tokenPassword) {
      return {
        success: false,
        message: 'Configuración HKA incompleta',
        error: 'Las credenciales de HKA no están configuradas. Por favor, configure tokenEmpresa y tokenPassword en la configuración del cliente.',
      };
    }

    // Llamar al método más simple: FoliosRestantes
    // Este método solo requiere tokens y retorna información de licencia
    const startTime = Date.now();
    const result = await consultarFoliosRestantes(config);
    const responseTime = Date.now() - startTime;

    if (result.success && result.data) {
      // Conexión exitosa
      await logger.log({
        level: 'INFO',
        method: 'testHkaConnection',
        timestamp: new Date(),
        duration: responseTime,
        metadata: {
          clientId: session.user.clientId,
          action: 'Test exitoso',
          foliosDisponibles: result.data.foliosDisponiblesCiclo,
        }
      });

      return {
        success: true,
        message: 'Conexión exitosa con HKA',
        details: {
          licencia: result.data.licencia,
          fechaLicencia: result.data.fechaLicencia,
          ciclo: result.data.ciclo,
          fechaCiclo: result.data.fechaCiclo,
          foliosTotalesCiclo: result.data.foliosTotalesCiclo,
          foliosUtilizadosCiclo: result.data.foliosUtilizadosCiclo,
          foliosDisponibleCiclo: result.data.foliosDisponiblesCiclo,
          foliosTotales: result.data.foliosTotales,
          foliosTotalesDisponibles: result.data.foliosDisponiblesCiclo,
          environment: config.environment === 'demo' ? 'DEMO' : 'PROD',
          responseTime,
          codigoRespuesta: result.code,
        }
      };
    } else {
      // Error en la respuesta de HKA
      await logger.log({
        level: 'ERROR',
        method: 'testHkaConnection',
        timestamp: new Date(),
        duration: responseTime,
        metadata: {
          clientId: session.user.clientId,
          action: 'Test fallido',
          errorCode: result.code,
          errorMessage: result.message,
        }
      });

      return {
        success: false,
        message: 'Error en la conexión con HKA',
        error: result.message || 'No se pudo conectar con el servicio HKA. Verifique sus credenciales y que el servicio esté disponible.',
        details: {
          environment: config.environment === 'demo' ? 'DEMO' : 'PROD',
          responseTime,
          codigoRespuesta: result.code,
        }
      };
    }
  } catch (error) {
    // Error al obtener configuración o error inesperado
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    await logger.log({
      level: 'ERROR',
      method: 'testHkaConnection',
      timestamp: new Date(),
      metadata: {
        clientId: session.user.clientId,
        action: 'Test fallido - excepción',
        errorMessage,
      }
    });

    return {
      success: false,
      message: 'Error al probar conexión con HKA',
      error: `Ocurrió un error inesperado: ${errorMessage}`
    };
  }
}

/**
 * Verifica que las credenciales HKA estén configuradas
 */
export async function hasHkaCredentialsConfigured(): Promise<{
  configured: boolean;
  environment?: 'DEMO' | 'PROD';
}> {
  const session = await auth();

  if (!session?.user?.clientId) {
    return { configured: false };
  }

  try {
    const config = await getHKAConfig(session.user.clientId);

    // Verificar que tenga los campos mínimos requeridos
    const configured = !!(
      config.tokenEmpresa &&
      config.tokenPassword &&
      config.environment &&
      config.branchCode &&
      config.puntoFacturacionFiscal
    );

    return {
      configured,
      environment: config.environment === 'demo' ? 'DEMO' : 'PROD',
    };
  } catch (error) {
    return { configured: false };
  }
}
