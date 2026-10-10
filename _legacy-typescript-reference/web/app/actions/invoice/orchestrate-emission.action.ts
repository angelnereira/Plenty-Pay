/**
 * Server Action: Orchestrate Invoice Emission
 * Coordina la emisión completa de facturas con automatización de 8 fases
 */

'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@core/auth';
import {
  InvoiceOrchestrator,
  type OrchestrationConfig,
  type OrchestrationResult,
} from '@/features/hka/model';

/**
 * Input para la orquestación
 */
export interface OrchestrateEmissionInput {
  /** ID de la factura a emitir */
  invoiceId: string;

  /** Configuración opcional */
  config?: Partial<OrchestrationConfig>;
}

/**
 * Orquesta la emisión completa de una factura
 *
 * Ejecuta el flujo de 8 fases:
 * 1. Validación de folios
 * 2. Validación de cliente
 * 3. Emisión a HKA
 * 4. Descarga PDF (automática)
 * 5. Descarga XML (automática)
 * 6. Envío de correo (automática)
 * 7. Verificación de estado
 * 8. Finalización
 *
 * @param input - Configuración de la emisión
 * @returns Resultado completo con detalles por fase
 *
 * @example
 * ```typescript
 * const result = await orchestrateInvoiceEmission({
 *   invoiceId: 'cuid_123',
 *   config: {
 *     autoDownloadPDF: true,
 *     autoDownloadXML: true,
 *     autoSendEmail: true,
 *   }
 * });
 *
 * if (result.success) {
 *   console.log(`CUFE: ${result.invoice.cufe}`);
 *   console.log(`Fases completadas: ${result.phases.length}/8`);
 * }
 * ```
 */
export async function orchestrateInvoiceEmission(
  input: OrchestrateEmissionInput
): Promise<OrchestrationResult> {
  try {
    // 1. Autenticación
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return {
        success: false,
        invoice: {
          id: input.invoiceId,
          status: 'ERROR',
          currentPhase: 0,
        },
        phases: [],
        errors: [{
          phase: 0,
          error: new Error('No autorizado') as any,
          recoverable: false,
        }],
        duration: 0,
      };
    }

    const { clientId, id: userId, email: userEmail } = session.user;

    // 2. Crear orchestrator con configuración
    const orchestrator = new InvoiceOrchestrator((input.config || {}) as OrchestrationConfig);

    // 3. Ejecutar flujo completo
    const result = await orchestrator.emitInvoiceWithFullWorkflow(
      input.invoiceId,
      clientId,
      userId,
      userEmail || undefined
    );

    // 4. Revalidar rutas
    if (result.success) {
      revalidatePath('/dashboard/facturas');
      revalidatePath(`/dashboard/facturas/${input.invoiceId}`);
      revalidatePath('/dashboard');
    }

    return result;
  } catch (error) {
    // Error inesperado fuera del orchestrator
    console.error('Error en orchestrateInvoiceEmission:', error);

    return {
      success: false,
      invoice: {
        id: input.invoiceId,
        status: 'ERROR',
        currentPhase: 0,
      },
      phases: [],
      errors: [{
        phase: 0,
        error: error as any,
        recoverable: false,
      }],
      duration: 0,
    };
  }
}

/**
 * Reintenta la emisión de una factura que falló
 * Útil para facturas en estado ERROR
 *
 * @param invoiceId - ID de la factura a reintentar
 * @returns Resultado de la orquestación
 */
export async function retryInvoiceEmission(
  invoiceId: string
): Promise<OrchestrationResult> {
  return orchestrateInvoiceEmission({
    invoiceId,
    config: {
      autoDownloadPDF: true,
      autoDownloadXML: true,
      autoSendEmail: true,
      autoVerifyStatus: true,
    },
  });
}

/**
 * Obtiene el progreso actual de una factura en emisión
 * Útil para polling desde el frontend
 *
 * @param invoiceId - ID de la factura
 * @returns Información del progreso
 */
export async function getInvoiceEmissionProgress(invoiceId: string): Promise<{
  currentPhase: number;
  status: string;
  phaseHistory: any[];
  errors: any;
} | null> {
  const session = await auth();
  if (!session?.user?.clientId) {
    return null;
  }

  const { prisma } = await import('@core/database');

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      clientId: session.user.clientId,
    },
    select: {
      currentPhase: true,
      status: true,
      phaseHistory: true,
      phaseErrors: true,
    },
  });

  if (!invoice) {
    return null;
  }

  return {
    currentPhase: invoice.currentPhase || 0,
    status: invoice.status,
    phaseHistory: (invoice.phaseHistory as any[]) || [],
    errors: invoice.phaseErrors || {},
  };
}
