/**
 * HKA Web Service - Método ConsultarRucDV
 * 
 * Valida un RUC y obtiene su dígito verificador y razón social
 * según HKA_Documentacion_Completa.md
 */

import { consultarRucDV } from '../services/hka-soap.service';
import { getHKAConfig } from '../repositories/hka-config.repository';
import type { HKAResponse, ConsultarRucDVResponse, HKAConfig } from '../types/types';
import { ConsultarRucInputSchema } from '../types/types';

/**
 * Input para validación de RUC
 */
export interface ValidateRUCInput {
  /** Tipo de RUC: "1" para Natural, "2" para Jurídico */
  tipoRuc: '1' | '2';
  /** Número de RUC a consultar (sin el DV) */
  ruc: string;
}

/**
 * Resultado de la validación de RUC
 */
export interface ValidateRUCResult {
  /** Validación exitosa */
  valid: boolean;
  /** Dígito verificador calculado por la DGI */
  dv?: string;
  /** Razón social o nombre del contribuyente */
  razonSocial?: string;
  /** Indica si está afiliado a Factura Electrónica */
  afiliadoFE?: boolean;
  /** Tipo de RUC */
  tipoRuc?: string;
  /** RUC consultado */
  ruc?: string;
  /** Mensaje de error si la validación falla */
  error?: string;
  /** Código de respuesta HKA */
  code?: string;
}

/**
 * Valida un RUC usando el servicio HKA ConsultarRucDV
 * Útil para auto-completar el DV y verificar la razón social antes de crear facturas
 * 
 * @param clientId - ID del cliente para obtener credenciales HKA
 * @param input - Datos del RUC a validar
 * @returns Resultado de la validación con DV y razón social
 * 
 * @example
 * const result = await validateRUC(clientId, {
 *   tipoRuc: '2',
 *   ruc: '155596713-2-2015'
 * });
 * 
 * if (result.valid) {
 *   console.log(`DV: ${result.dv}, Nombre: ${result.razonSocial}`);
 * }
 */
export async function validateRUC(
  clientId: string,
  input: ValidateRUCInput
): Promise<ValidateRUCResult> {
  try {
    // Validar input con Zod
    const validation = ConsultarRucInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        valid: false,
        error: validation.error.issues[0]?.message || 'Datos de entrada inválidos',
      };
    }

    // Obtener configuración HKA
    const config = await getHKAConfig(clientId);

    // Llamar al servicio HKA
    const response = await consultarRucDV(config, input.tipoRuc, input.ruc);

    // Procesar respuesta
    return processRUCResponse(response);
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Error desconocido al validar RUC',
    };
  }
}

/**
 * Valida un RUC usando configuración HKA pre-cargada
 * Útil cuando ya tienes la configuración y no quieres consultarla de nuevo
 * 
 * @param config - Configuración HKA ya obtenida
 * @param input - Datos del RUC a validar
 */
export async function validateRUCWithConfig(
  config: HKAConfig,
  input: ValidateRUCInput
): Promise<ValidateRUCResult> {
  try {
    // Validar input
    const validation = ConsultarRucInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        valid: false,
        error: validation.error.issues[0]?.message || 'Datos de entrada inválidos',
      };
    }

    // Llamar al servicio HKA
    const response = await consultarRucDV(config, input.tipoRuc, input.ruc);

    return processRUCResponse(response);
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Error desconocido al validar RUC',
    };
  }
}

/**
 * Procesa la respuesta de HKA y la convierte en ValidateRUCResult
 */
function processRUCResponse(
  response: HKAResponse<ConsultarRucDVResponse>
): ValidateRUCResult {
  if (!response.success) {
    return {
      valid: false,
      error: response.message || 'Error al consultar RUC en HKA',
      code: response.code,
    };
  }

  if (!response.data) {
    return {
      valid: false,
      error: 'Sin datos en la respuesta de HKA',
      code: response.code,
    };
  }

  const { tipoRuc, ruc, dv, razonSocial, afiliadoFE } = response.data;

  // Determinar si está afiliado a FE
  const isAfiliadoFE = afiliadoFE?.toLowerCase().includes('si') ||
    afiliadoFE?.toLowerCase().includes('afiliado') ||
    afiliadoFE === 'true';

  return {
    valid: true,
    tipoRuc,
    ruc,
    dv,
    razonSocial,
    afiliadoFE: isAfiliadoFE,
    code: response.code,
  };
}

/**
 * Valida múltiples RUCs en lote
 * 
 * @param clientId - ID del cliente
 * @param rucs - Array de RUCs a validar
 * @returns Array de resultados de validación
 */
export async function validateRUCsBatch(
  clientId: string,
  rucs: ValidateRUCInput[]
): Promise<ValidateRUCResult[]> {
  // Obtener configuración una sola vez
  const config = await getHKAConfig(clientId);

  // Validar cada RUC (secuencialmente para no sobrecargar el servicio)
  const results: ValidateRUCResult[] = [];

  for (const input of rucs) {
    const result = await validateRUCWithConfig(config, input);
    results.push(result);

    // Pequeña pausa entre llamadas para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

/**
 * Detecta automáticamente el tipo de RUC basado en el formato
 * Heurística: RUCs jurídicos suelen tener formato XXX-XXX-XXXXX
 * 
 * @param ruc - RUC a analizar
 * @returns "1" para Natural, "2" para Jurídico
 */
export function detectRUCType(ruc: string): '1' | '2' {
  // Si tiene guiones y más de 2 partes, probablemente es jurídico
  const parts = ruc.split('-');

  if (parts.length >= 3) {
    return '2'; // Jurídico (formato: XXX-XXX-XXXXX)
  }

  // Si es solo dígitos y menos de 9, probablemente es natural (cédula)
  const digitsOnly = ruc.replace(/\D/g, '');
  if (digitsOnly.length < 9 && parts.length < 2) {
    return '1'; // Natural
  }

  // Por defecto asumir jurídico
  return '2';
}

/**
 * Formatea un RUC para mostrar con su DV
 * 
 * @param ruc - Número de RUC
 * @param dv - Dígito verificador
 * @returns RUC formateado con DV
 */
export function formatRUCWithDV(ruc: string, dv: string): string {
  return `${ruc} DV: ${dv}`;
}

