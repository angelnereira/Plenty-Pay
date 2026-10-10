/**
 * Server Action: Validate RUC
 * Valida un RUC usando el servicio HKA ConsultarRucDV
 */

'use server';

import { auth } from '@core/auth';
import { validateRUC, detectRUCType, type ValidateRUCResult } from '@/features/hka/model';

/**
 * Input para validación de RUC
 */
export interface ValidateRUCInput {
  /** Número de RUC a validar (sin DV) */
  ruc: string;
  /** Tipo de RUC (opcional, se detecta automáticamente) */
  tipoRuc?: '1' | '2';
}

/**
 * Output de validación
 */
export interface ValidateRUCOutput {
  success: boolean;
  data?: {
    dv: string;
    razonSocial: string;
    afiliadoFE: boolean;
    tipoRuc: string;
    ruc: string;
  };
  error?: string;
}

/**
 * Valida un RUC y obtiene su dígito verificador y razón social
 * 
 * @param input - RUC a validar
 * @returns DV, razón social y estado de afiliación a FE
 * 
 * @example
 * const result = await validateRUCAction({ ruc: '155596713-2-2015' });
 * if (result.success) {
 *   console.log(`DV: ${result.data.dv}, Nombre: ${result.data.razonSocial}`);
 * }
 */
export async function validateRUCAction(input: ValidateRUCInput): Promise<ValidateRUCOutput> {
  try {
    // Autenticación
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return { success: false, error: 'No autorizado' };
    }

    const { clientId } = session.user;

    // Validar input
    if (!input.ruc || input.ruc.trim().length === 0) {
      return { success: false, error: 'El RUC es requerido' };
    }

    // Detectar tipo de RUC si no se proporciona
    const tipoRuc = input.tipoRuc || detectRUCType(input.ruc);

    // Llamar al servicio HKA
    const result = await validateRUC(clientId, {
      tipoRuc,
      ruc: input.ruc.trim(),
    });

    if (result.valid && result.dv) {
      return {
        success: true,
        data: {
          dv: result.dv,
          razonSocial: result.razonSocial || '',
          afiliadoFE: result.afiliadoFE || false,
          tipoRuc: result.tipoRuc || tipoRuc,
          ruc: result.ruc || input.ruc,
        },
      };
    }

    return {
      success: false,
      error: result.error || 'No se pudo validar el RUC',
    };
  } catch (error) {
    console.error('Error en validateRUCAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    };
  }
}

/**
 * Valida múltiples RUCs en lote
 */
export async function validateRUCsBatchAction(
  rucs: string[]
): Promise<{ ruc: string; result: ValidateRUCOutput }[]> {
  const results: { ruc: string; result: ValidateRUCOutput }[] = [];

  for (const ruc of rucs) {
    const result = await validateRUCAction({ ruc });
    results.push({ ruc, result });
    
    // Pequeña pausa entre llamadas
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

