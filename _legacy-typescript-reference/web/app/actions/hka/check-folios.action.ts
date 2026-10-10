/**
 * Server Action: Check Folios
 * Consulta los folios disponibles en HKA
 */

'use server';

import { auth } from '@core/auth';
import { 
  checkFoliosDisponibles, 
  formatFoliosForDisplay,
  parseLicenseDate,
  type FoliosResult,
} from '@/features/hka/model';

/**
 * Output de consulta de folios
 */
export interface CheckFoliosOutput {
  success: boolean;
  data?: {
    licencia: string;
    fechaLicencia: string;
    ciclo: string;
    fechaCiclo: string;
    foliosTotalesCiclo: number;
    foliosUtilizadosCiclo: number;
    foliosDisponiblesCiclo: number;
    foliosTotales: number;
    porcentajeUso: number;
    foliosBajos: boolean;
    diasRestantesLicencia: number;
  };
  display?: {
    disponibles: string;
    usados: string;
    total: string;
    porcentaje: string;
    estado: 'ok' | 'warning' | 'critical';
    mensaje: string;
  };
  error?: string;
}

/**
 * Consulta los folios disponibles en HKA
 * 
 * @returns Información detallada de folios y datos formateados para UI
 * 
 * @example
 * const result = await checkFoliosAction();
 * if (result.success) {
 *   console.log(`Disponibles: ${result.data.foliosDisponiblesCiclo}`);
 *   if (result.display.estado === 'critical') {
 *     alert(result.display.mensaje);
 *   }
 * }
 */
export async function checkFoliosAction(): Promise<CheckFoliosOutput> {
  try {
    // Autenticación
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return { success: false, error: 'No autorizado' };
    }

    const { clientId } = session.user;

    // Llamar al servicio HKA
    const result = await checkFoliosDisponibles(clientId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Error al consultar folios',
      };
    }

    // Formatear para display
    const display = formatFoliosForDisplay(result);

    // Parsear fecha de licencia
    const licenseInfo = parseLicenseDate(result.fechaLicencia || '');

    return {
      success: true,
      data: {
        licencia: result.licencia || '',
        fechaLicencia: result.fechaLicencia || '',
        ciclo: result.ciclo || '',
        fechaCiclo: result.fechaCiclo || '',
        foliosTotalesCiclo: result.foliosTotalesCiclo || 0,
        foliosUtilizadosCiclo: result.foliosUtilizadosCiclo || 0,
        foliosDisponiblesCiclo: result.foliosDisponiblesCiclo || 0,
        foliosTotales: result.foliosTotales || 0,
        porcentajeUso: result.porcentajeUso || 0,
        foliosBajos: result.foliosBajos || false,
        diasRestantesLicencia: licenseInfo.diasRestantes,
      },
      display,
    };
  } catch (error) {
    console.error('Error en checkFoliosAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    };
  }
}

/**
 * Verifica rápidamente si hay folios disponibles
 */
export async function hasAvailableFoliosAction(): Promise<{ available: boolean; count: number }> {
  try {
    const session = await auth();
    if (!session?.user?.clientId) {
      return { available: false, count: 0 };
    }

    const result = await checkFoliosDisponibles(session.user.clientId);
    
    return {
      available: result.success && (result.foliosDisponiblesCiclo || 0) > 0,
      count: result.foliosDisponiblesCiclo || 0,
    };
  } catch {
    return { available: false, count: 0 };
  }
}

