/**
 * Server Action: Emit Invoice (Powered by HKA Engines)
 * 
 * Este action delega toda la complejidad al InvoiceOrchestrator.
 * Actúa como punto de entrada seguro para el Frontend.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@core/auth';
import {
  InvoiceOrchestrator,
  OrchestrationConfig,
  isHKAEnabled
} from '@/features/hka/model';

export interface EmitInvoiceInput {
  invoiceId: string;
}

export interface EmitInvoiceOutput {
  success: boolean;
  data?: {
    cufe?: string;
    qrUrl?: string; // Nota: El Orchestrator devuelve esto en la factura actualizada, no en el result directo a veces
    nroProtocoloAutorizacion?: string;
    fechaRecepcionDGI?: string;
    numeroDocumentoFiscal?: string; // Número de documento fiscal asignado por HKA
  };
  error?: string;
  /** Diagnóstico del Engine 4: Análisis de Causa Raíz */
  diagnosis?: {
    message: string;
    action: string;
    severity: string;
  };
  recoverable?: boolean;
}

export async function emitInvoice(input: EmitInvoiceInput): Promise<EmitInvoiceOutput> {
  // 1. Auth & Validation
  const session = await auth();
  if (!session?.user?.id || !session?.user?.clientId) {
    return { success: false, error: 'No autorizado' };
  }
  const { clientId, id: userId, email: userEmail } = session.user;

  if (!(await isHKAEnabled(clientId))) {
    return { success: false, error: 'HKA no habilitado para esta empresa' };
  }

  // 2. Configure & Run Orchestrator
  // Configuración por defecto: Workflow completo (PDF, XML, Email)
  const config: OrchestrationConfig = {
    autoDownloadPDF: true,
    autoDownloadXML: true,
    autoSendEmail: true,
    autoVerifyStatus: true,
    // retryConfig se carga por defecto en el orchestrator
  };

  const orchestrator = new InvoiceOrchestrator(config);

  try {
    const result = await orchestrator.emitInvoiceWithFullWorkflow(
      input.invoiceId,
      clientId,
      userId,
      userEmail || undefined
    );

    // 3. Handle Result
    revalidatePath('/dashboard/facturas');

    if (result.success) {
      // PERF: Use orchestrator result data directly instead of re-fetching from DB.
      // Background phases (PDF/XML/Email) run fire-and-forget, so data may still be updating,
      // but the critical fiscal data (CUFE, QR, protocol) is already in the orchestrator result.
      return {
        success: true,
        data: {
          cufe: result.invoice.cufe,
          qrUrl: result.invoice.qrCode || result.invoice.qrUrl || undefined,
          nroProtocoloAutorizacion: result.invoice.hkaProtocol || 'AUTORIZADO',
          fechaRecepcionDGI: result.invoice.hkaProtocolDate || new Date().toISOString(),
          numeroDocumentoFiscal: result.invoice.invoiceNumber || undefined,
        }
      };
    } else {
      // El orchestrator devuelve success=false si hubo error crítico
      // Extraemos el primer error o el crítico
      const criticalError = result.errors[0]; // Simplificación
      return {
        success: false,
        error: criticalError?.error.message || 'Error desconocido',
        recoverable: criticalError?.recoverable,
        diagnosis: criticalError ? {
          message: criticalError.error.message, // Ya viene enriquecido por el Doctor
          action: 'Ver detalle de error', // Doctor prescription está en BD
          severity: 'HIGH'
        } : undefined
      };
    }

  } catch (error) {
    // Fallback para errores no capturados por el Orchestrator (raro)
    console.error('Unhandled Emission Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado del sistema',
      diagnosis: {
        message: 'Fallo interno crítico',
        action: 'Contactar soporte técnico',
        severity: 'CRITICAL'
      }
    };
  }
}

// Batch Helpers
export async function emitInvoicesBatch(
  invoiceIds: string[]
): Promise<{ results: EmitInvoiceOutput[]; summary: { success: number; failed: number } }> {
  const results: EmitInvoiceOutput[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const invoiceId of invoiceIds) {
    const result = await emitInvoice({ invoiceId });
    results.push(result);
    if (result.success) successCount++; else failedCount++;
    await new Promise(r => setTimeout(r, 200)); // Throttle
  }

  return { results, summary: { success: successCount, failed: failedCount } };
}

export async function retryEmitInvoice(invoiceId: string): Promise<EmitInvoiceOutput> {
  return emitInvoice({ invoiceId });
}
