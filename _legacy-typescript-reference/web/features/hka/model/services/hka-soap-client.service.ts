/**
 * HKA SOAP Client Service
 *
 * Cliente SOAP real usando el package 'soap' de npm
 * Lee el WSDL de HKA y genera métodos automáticamente
 *
 * VENTAJAS sobre fetch manual:
 * - Lee WSDL automáticamente del endpoint
 * - Maneja namespaces automáticamente
 * - Compatible con la forma oficial de HKA
 * - Similar a ejemplos de documentación (PHP SoapClient, C# ServiceClient)
 */

import * as soap from 'soap';
import type { Client } from 'soap';
import type { HKAConfig } from '../types/types';
import { HKALogger } from './logger';
import { HKAError, HKAErrorType } from './errors';
import { TIMEOUTS, RETRY } from '@/lib/constants/config';
import { redis } from '@/lib/redis';

const logger = new HKALogger();

// Configuración del Circuit Breaker
const CB_KEY = 'hka:circuit:open';
const CB_ERROR_COUNT = 'hka:error:count';
const CB_THRESHOLD = 3;
const CB_TTL = 300; // 5 minutos de bloqueo si se abre el circuito

// URLs WSDL según documentación oficial HKA 2026
// IMPORTANTE: Se usa ?wsdl para obtener el WSDL (sin el parámetro devuelve HTML)
const WSDL_URLS = {
  demo: 'https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc?wsdl',
  prod: 'https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc?wsdl',
} as const;

/** Timeout por defecto: 30 segundos */
const DEFAULT_TIMEOUT = TIMEOUTS.SOAP_DEFAULT;

/** Cache de clientes SOAP por ambiente */
const clientCache = new Map<string, Client>();

/**
 * Crea o obtiene cliente SOAP de HKA
 *
 * El cliente se cachea por ambiente (demo/prod) para reutilización
 * El WSDL se lee una sola vez y se mantiene en memoria
 *
 * @param config - Configuración HKA con ambiente
 * @returns Cliente SOAP configurado
 */
export async function getHKASoapClient(config: HKAConfig): Promise<Client> {
  const cacheKey = config.environment;

  // Verificar si ya existe en cache
  if (clientCache.has(cacheKey)) {
    const cachedClient = clientCache.get(cacheKey)!;
    logger.log({
      level: 'DEBUG',
      method: 'getHKASoapClient',
      timestamp: new Date(),
      metadata: {
        environment: config.environment,
        cached: true,
      }
    });
    return cachedClient;
  }

  // Crear nuevo cliente
  const wsdlUrl = WSDL_URLS[config.environment];

  logger.log({
    level: 'INFO',
    method: 'getHKASoapClient',
    timestamp: new Date(),
    metadata: {
      environment: config.environment,
      wsdlUrl,
      action: 'Creando nuevo cliente SOAP'
    }
  });

  try {
    const startTime = Date.now();

    // Crear cliente SOAP con opciones
    const client = await soap.createClientAsync(wsdlUrl, {
      // No timeout option here - it goes in the request call
    });

    // 🚨 CRITICAL FIX: Configurar headers por defecto para HKA
    // HKA REQUIERE Content-Type: text/xml y SOAPAction header
    // 
    // El SOAPAction se agregará dinámicamente en callSoapMethod
    // pero configuramos aquí los headers base

    // Store method name for dynamic SOAPAction (will be set per-call)
    (client as any)._hkaMethodName = '';

    const duration = Date.now() - startTime;

    logger.log({
      level: 'INFO',
      method: 'getHKASoapClient',
      timestamp: new Date(),
      duration,
      metadata: {
        environment: config.environment,
        action: 'Cliente SOAP creado exitosamente',
      }
    });

    // Guardar en cache
    clientCache.set(cacheKey, client);

    return client;
  } catch (error) {
    logger.log({
      level: 'ERROR',
      method: 'getHKASoapClient',
      timestamp: new Date(),
      error: {
        type: 'CLIENT_CREATION_ERROR',
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
      },
      metadata: {
        environment: config.environment,
        wsdlUrl,
      }
    });

    throw new HKAError(
      HKAErrorType.NETWORK,
      `No se pudo crear cliente SOAP: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      {
        metadata: {
          wsdlUrl,
          environment: config.environment,
        }
      }
    );
  }
}

/**
 * Limpia el cache de clientes SOAP
 * Útil para forzar reconexión o cambio de ambiente
 */
export function clearSoapClientCache(environment?: 'demo' | 'prod'): void {
  if (environment) {
    clientCache.delete(environment);
    logger.log({
      level: 'INFO',
      method: 'clearSoapClientCache',
      timestamp: new Date(),
      metadata: {
        environment,
        action: 'Cache limpiado para ambiente específico'
      }
    });
  } else {
    clientCache.clear();
    logger.log({
      level: 'INFO',
      method: 'clearSoapClientCache',
      timestamp: new Date(),
      metadata: {
        action: 'Cache completo limpiado'
      }
    });
  }
}

/**
 * Wrapper genérico para llamadas SOAP con retry logic
 *
 * @param client - Cliente SOAP
 * @param methodName - Nombre del método SOAP
 * @param args - Argumentos del método
 * @param retries - Número de reintentos (default: 2)
 * @returns Respuesta del método SOAP
 */
export async function callSoapMethod<T = any>(
  client: Client,
  methodName: string,
  args: any,
  retries: number = RETRY.SOAP_RETRIES
): Promise<T> {
  // ── 1. Verificar Circuit Breaker ──────────────────────────────────────────
  try {
    const isDown = await redis.get(CB_KEY);
    if (isDown) {
      logger.log({
        level: 'WARN',
        method: methodName,
        timestamp: new Date(),
        metadata: { action: 'Circuit Breaker OPEN - failing fast' }
      });
      throw new HKAError(
        HKAErrorType.NETWORK,
        'El servicio de la DGI (HKA) está experimentando problemas técnicos. Intente nuevamente en unos minutos.',
        { recoverable: true }
      );
    }
  } catch (error) {
    if (error instanceof HKAError) throw error;
    // Si Redis falla, seguimos con el flujo normal (fail-open)
    console.warn('[HKA-CB] Redis error checking circuit breaker:', error);
  }

  let lastError: Error;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const startTime = Date.now();

      logger.log({
        level: 'DEBUG',
        method: methodName,
        timestamp: new Date(),
        metadata: {
          attempt,
          maxAttempts: retries + 1,
          args: JSON.stringify(args).substring(0, 500), // Truncar
        }
      });

      // Llamar método SOAP con Async suffix
      const methodAsync = `${methodName}Async`;

      if (typeof (client as any)[methodAsync] !== 'function') {
        throw new Error(`Método ${methodAsync} no encontrado en cliente SOAP`);
      }

      // 🚨 CRITICAL FIX: HKA requiere SOAPAction header
      // Formato EXACTO de Postman: "http://tempuri.org/IService/[MethodName]"
      // IMPORTANTE: Las comillas dobles son PARTE del valor del header
      const soapAction = `"http://tempuri.org/IService/${methodName}"`;

      logger.log({
        level: 'DEBUG',
        method: methodName,
        timestamp: new Date(),
        metadata: {
          soapAction,
          attempt,
        }
      });

      // Opciones para la request con headers personalizados
      const options = {
        // Headers HTTP que se enviarán con la request SOAP
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': soapAction,  // Ya incluye las comillas como parte del valor
          'Accept': '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        },
        // Timeout específico para este request
        timeout: DEFAULT_TIMEOUT,
      };

      // 🔍 LOGGING: Capturar el último XML enviado para debugging
      // El cliente SOAP guarda el último request en lastRequest
      let lastXmlRequest = '';

      // Llamar método con opciones que incluyen SOAPAction header
      const [result] = await (client as any)[methodAsync](args, options);

      // Capturar el XML que se envió
      try {
        lastXmlRequest = client.lastRequest || '';
        if (lastXmlRequest) {
          logger.log({
            level: 'DEBUG',
            method: methodName,
            timestamp: new Date(),
            metadata: {
              xmlRequest: lastXmlRequest.substring(0, 2000),
              action: 'XML Request sent to HKA'
            }
          });
        }
      } catch (e) {
        // Ignore logging errors
      }

      // Capturar el XML de la respuesta
      try {
        const lastXmlResponse = client.lastResponse || '';
        if (lastXmlResponse) {
          logger.log({
            level: 'DEBUG',
            method: methodName,
            timestamp: new Date(),
            metadata: {
              xmlResponse: lastXmlResponse.substring(0, 2000),
              action: 'XML Response received from HKA'
            }
          });
        }
      } catch (e) {
        // Ignore logging errors
      }

      const duration = Date.now() - startTime;

      logger.log({
        level: 'INFO',
        method: methodName,
        timestamp: new Date(),
        duration,
        response: {
          body: JSON.stringify(result).substring(0, 500), // Truncar
        },
        metadata: {
          attempt,
          success: true,
        }
      });

      // ── Éxito: Resetear contador de errores ──────────────────────────────
      try {
        await redis.del(CB_ERROR_COUNT);
      } catch (e) { /* ignore */ }

      return result;
    } catch (error) {
      lastError = error as Error;

      logger.log({
        level: attempt <= retries ? 'WARN' : 'ERROR',
        method: methodName,
        timestamp: new Date(),
        error: {
          type: 'SOAP_CALL_ERROR',
          message: error instanceof Error ? error.message : 'Error desconocido',
          stack: error instanceof Error ? error.stack : undefined,
        },
        metadata: {
          attempt,
          maxAttempts: retries + 1,
          willRetry: attempt <= retries,
        }
      });

      // Si no es el último intento, esperar antes de reintentar
      if (attempt <= retries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), RETRY.MAX_DELAY_MS);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      // ── El último reintento falló: Reportar al Circuit Breaker ────────────
      try {
        const newCount = await redis.incr(CB_ERROR_COUNT);
        if (newCount >= CB_THRESHOLD) {
          await redis.set(CB_KEY, 'OPEN', { ex: CB_TTL });
          logger.log({
            level: 'ERROR',
            method: methodName,
            timestamp: new Date(),
            metadata: { action: 'Circuit Breaker OPENED', errors: newCount }
          });
        }
      } catch (e) { /* ignore */ }
    }
  }

  // Todos los reintentos fallaron
  throw new HKAError(
    HKAErrorType.NETWORK,
    `Error al llamar método SOAP ${methodName}: ${lastError!.message}`,
    {
      metadata: {
        method: methodName,
        attempts: retries + 1,
      }
    }
  );
}

/**
 * Obtiene descripción de los servicios disponibles en el WSDL
 * Útil para debugging y verificación
 */
export async function describeHKAServices(config: HKAConfig): Promise<any> {
  const client = await getHKASoapClient(config);
  return client.describe();
}

export default {
  getHKASoapClient,
  clearSoapClientCache,
  callSoapMethod,
  describeHKAServices,
};
