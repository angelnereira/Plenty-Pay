/**
 * HKA Web Service - Método FoliosRestantes
 * 
 * Consulta la información de folios disponibles en la licencia HKA
 * según HKA_Documentacion_Completa.md
 */

import { consultarFoliosRestantes } from '../services/hka-soap.service';
import { getHKAConfig, getHKACredentials } from '../repositories/hka-config.repository';
import type { HKAResponse, FoliosRestantesResponse, HKAConfig } from '../types/types';
import { HKA_ENDPOINTS } from '../types/types';

/**
 * Resultado de la consulta de folios
 */
export interface FoliosResult {
  /** Consulta exitosa */
  success: boolean;
  /** Código de la licencia HKA */
  licencia?: string;
  /** Rango de fechas de la licencia */
  fechaLicencia?: string;
  /** Número del ciclo actual de facturación */
  ciclo?: string;
  /** Rango de fechas del ciclo actual */
  fechaCiclo?: string;
  /** Folios totales asignados al ciclo */
  foliosTotalesCiclo?: number;
  /** Folios ya utilizados en el ciclo */
  foliosUtilizadosCiclo?: number;
  /** Folios disponibles para emitir */
  foliosDisponiblesCiclo?: number;
  /** Folios totales de toda la licencia */
  foliosTotales?: number;
  /** Porcentaje de uso del ciclo */
  porcentajeUso?: number;
  /** Indica si los folios están bajos (menos del umbral) */
  foliosBajos?: boolean;
  /** Mensaje de error si falla */
  error?: string;
  /** Código de respuesta HKA */
  code?: string;
}

/** Umbral por defecto para considerar folios bajos (10%) */
const DEFAULT_LOW_THRESHOLD_PERCENT = 10;

/**
 * Consulta los folios disponibles en HKA
 * Este es el método más simple - solo requiere los tokens de autenticación
 * 
 * @param clientId - ID del cliente para obtener credenciales HKA
 * @returns Información detallada de folios disponibles
 * 
 * @example
 * const result = await checkFoliosDisponibles(clientId);
 * if (result.success) {
 *   console.log(`Disponibles: ${result.foliosDisponiblesCiclo}`);
 *   if (result.foliosBajos) {
 *     console.warn('Alerta: Folios bajos!');
 *   }
 * }
 */
export async function checkFoliosDisponibles(
  clientId: string,
  lowThresholdPercent: number = DEFAULT_LOW_THRESHOLD_PERCENT
): Promise<FoliosResult> {
  try {
    // Obtener configuración HKA
    const config = await getHKAConfig(clientId);

    // Llamar al servicio HKA
    const response = await consultarFoliosRestantes(config);

    // Procesar respuesta
    return processFoliosResponse(response, lowThresholdPercent);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al consultar folios',
    };
  }
}

/**
 * Consulta folios usando configuración pre-cargada
 * 
 * @param config - Configuración HKA ya obtenida
 * @param lowThresholdPercent - Porcentaje para considerar folios bajos
 */
export async function checkFoliosWithConfig(
  config: HKAConfig,
  lowThresholdPercent: number = DEFAULT_LOW_THRESHOLD_PERCENT
): Promise<FoliosResult> {
  try {
    const response = await consultarFoliosRestantes(config);
    return processFoliosResponse(response, lowThresholdPercent);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Verifica rápidamente si hay folios disponibles
 * 
 * @param clientId - ID del cliente
 * @returns true si hay al menos 1 folio disponible
 */
export async function hasAvailableFolios(clientId: string): Promise<boolean> {
  const result = await checkFoliosDisponibles(clientId);
  return result.success && (result.foliosDisponiblesCiclo ?? 0) > 0;
}

/**
 * Verifica si los folios están por debajo del umbral
 * 
 * @param clientId - ID del cliente
 * @param threshold - Cantidad mínima de folios (default: 50)
 * @returns true si los folios disponibles son menores al umbral
 */
export async function areFoliosLow(
  clientId: string,
  threshold: number = 50
): Promise<boolean> {
  const result = await checkFoliosDisponibles(clientId);
  return result.success && (result.foliosDisponiblesCiclo ?? 0) < threshold;
}

/**
 * Procesa la respuesta de HKA y la convierte en FoliosResult
 */
function processFoliosResponse(
  response: HKAResponse<FoliosRestantesResponse>,
  lowThresholdPercent: number
): FoliosResult {
  if (!response.success) {
    return {
      success: false,
      error: response.message || 'Error al consultar folios en HKA',
      code: response.code,
    };
  }

  if (!response.data) {
    return {
      success: false,
      error: 'Sin datos en la respuesta de HKA',
      code: response.code,
    };
  }

  const {
    licencia,
    fechaLicencia,
    ciclo,
    fechaCiclo,
    foliosTotalesCiclo,
    foliosUtilizadosCiclo,
    foliosDisponiblesCiclo,
    foliosTotales,
  } = response.data;

  // Calcular porcentaje de uso
  const porcentajeUso = foliosTotalesCiclo > 0
    ? Math.round((foliosUtilizadosCiclo / foliosTotalesCiclo) * 100)
    : 0;

  // Determinar si los folios están bajos
  const porcentajeDisponible = foliosTotalesCiclo > 0
    ? (foliosDisponiblesCiclo / foliosTotalesCiclo) * 100
    : 0;
  const foliosBajos = porcentajeDisponible < lowThresholdPercent;

  return {
    success: true,
    licencia,
    fechaLicencia,
    ciclo,
    fechaCiclo,
    foliosTotalesCiclo,
    foliosUtilizadosCiclo,
    foliosDisponiblesCiclo,
    foliosTotales,
    porcentajeUso,
    foliosBajos,
    code: response.code,
  };
}

/**
 * Obtiene un resumen formateado de los folios para mostrar en UI
 * 
 * @param result - Resultado de checkFoliosDisponibles
 * @returns Objeto con datos formateados para UI
 */
export function formatFoliosForDisplay(result: FoliosResult): {
  disponibles: string;
  usados: string;
  total: string;
  porcentaje: string;
  estado: 'ok' | 'warning' | 'critical';
  mensaje: string;
} {
  if (!result.success) {
    return {
      disponibles: '---',
      usados: '---',
      total: '---',
      porcentaje: '---',
      estado: 'critical',
      mensaje: result.error || 'Error al consultar',
    };
  }

  const disponibles = result.foliosDisponiblesCiclo ?? 0;
  const usados = result.foliosUtilizadosCiclo ?? 0;
  const total = result.foliosTotalesCiclo ?? 0;
  const porcentaje = result.porcentajeUso ?? 0;

  // Determinar estado visual
  let estado: 'ok' | 'warning' | 'critical' = 'ok';
  let mensaje = 'Folios suficientes';

  if (result.foliosBajos) {
    if (disponibles < 10) {
      estado = 'critical';
      mensaje = 'Folios muy bajos. Renueve su licencia.';
    } else {
      estado = 'warning';
      mensaje = 'Folios bajos. Considere renovar pronto.';
    }
  }

  return {
    disponibles: disponibles.toLocaleString(),
    usados: usados.toLocaleString(),
    total: total.toLocaleString(),
    porcentaje: `${porcentaje}%`,
    estado,
    mensaje,
  };
}

/**
 * Parsea la fecha de licencia de HKA
 * Formato HKA: "2020-08-12 / 2021-08-12"
 * 
 * @param fechaLicencia - String de fecha de HKA
 * @returns Objeto con fechas de inicio y fin
 */
export function parseLicenseDate(fechaLicencia: string): {
  inicio: Date | null;
  fin: Date | null;
  diasRestantes: number;
} {
  try {
    const parts = fechaLicencia.split('/').map(s => s.trim());
    if (parts.length !== 2) {
      return { inicio: null, fin: null, diasRestantes: 0 };
    }

    const inicio = new Date(parts[0]);
    const fin = new Date(parts[1]);
    
    const hoy = new Date();
    const diasRestantes = Math.ceil(
      (fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      inicio: isNaN(inicio.getTime()) ? null : inicio,
      fin: isNaN(fin.getTime()) ? null : fin,
      diasRestantes: Math.max(0, diasRestantes),
    };
  } catch {
    return { inicio: null, fin: null, diasRestantes: 0 };
  }
}

