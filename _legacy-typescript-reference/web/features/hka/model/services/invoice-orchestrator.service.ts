/**
 * Invoice Orchestrator
 * Coordina el flujo completo de emisión de facturas con automatización de 8 fases
 *
 * FLUJO COMPLETO:
 * Fase 0: Inicialización
 * Fase 1: Validación de Requisitos (CRÍTICA)
 * Fase 2: Validación de Cliente
 * Fase 3: Emisión a HKA (CRÍTICA)
 * Fase 4: Descarga PDF (Background)
 * Fase 5: Descarga XML (Background)
 * Fase 6: Envío de Correo (Background)
 * Fase 7: Verificación de Estado (Background)
 * Fase 8: Finalización
 *
 * Fases CRÍTICAS: Si fallan, detener todo el proceso
 * Fases BACKGROUND: Si fallan, loggear pero continuar
 */

import { prisma } from '@core/database';
import { HKALogger } from './logger';
import { HKAError, HKAErrorType, parseHKAError } from './errors';
import { retryWithBackoff, RETRY_CONFIGS, type RetryConfig } from './retry';
import { getHKAConfig } from '../repositories/hka-config.repository';
import { getNextInvoiceNumber } from './invoice-numbering.service';
import {
  downloadPDFWithConfig,
  downloadXMLWithConfig,
  sendInvoiceEmailWithConfig,
  consultarEstadoWithConfig,
  HKAClient
} from '../index'; // Importing from index feature barrel
import { buildDatosDocumento } from '../methods/shared';

import {
  InputAdapterEngine,
  RequestGuardEngine,
  ResponseProcessorEngine
} from '../engines';
import { DiagnosticEngine } from '../engines/diagnostic.engine';
import {
  OrchestrationResult,
  PhaseResult,
  PhaseError
} from './types/orchestrator.types';

export type {
  OrchestrationResult,
  PhaseResult,
  PhaseError
};

/**
 * Fases del workflow de emisión
 */
export const PHASES = {
  INIT: 0,
  VALIDATE_PREREQUISITES: 1,
  ASSIGN_DOCUMENT_NUMBER: 2, // Asignar número fiscal secuencial
  EMIT_INVOICE: 3,
  DOWNLOAD_PDF: 4,
  DOWNLOAD_XML: 5,
  SEND_EMAIL: 6,
  VERIFY_STATUS: 7,
  UPDATE_INVENTORY: 9, // New phase for inventory deduction
  FINALIZE: 8,
} as const;

export const PHASE_NAMES: Record<number, string> = {
  0: 'Inicialización',
  1: 'Validación de Requisitos',
  2: 'Asignación de Número Fiscal',
  3: 'Emisión de Factura',
  4: 'Descarga PDF',
  5: 'Descarga XML',
  6: 'Envío de Correo',
  7: 'Verificación de Estado',
  8: 'Finalización',
  9: 'Actualización de Inventario',
};

export type PhaseIndex = typeof PHASES[keyof typeof PHASES];

// ...

export interface OrchestrationConfig {
  autoDownloadPDF?: boolean;
  autoDownloadXML?: boolean;
  autoSendEmail?: boolean;
  autoVerifyStatus?: boolean;
  /** Configuración de retry */
  retryConfig?: RetryConfig;
}

// ...

export class InvoiceOrchestrator {
  private logger: HKALogger;
  private config: OrchestrationConfig;
  private adapter: InputAdapterEngine;
  private guard: RequestGuardEngine;
  private processor: ResponseProcessorEngine;
  private doctor: DiagnosticEngine; // Engine 4

  constructor(config: OrchestrationConfig) {
    this.config = config;
    this.logger = new HKALogger();

    // Initialize Engines
    this.adapter = new InputAdapterEngine();
    this.guard = new RequestGuardEngine();
    this.processor = new ResponseProcessorEngine();

    // Initialize "The Doctor" (Diagnostic Engine)
    this.doctor = new DiagnosticEngine();
  }
  async emitInvoiceWithFullWorkflow(
    invoiceId: string,
    clientId: string,
    userId: string,
    userEmail?: string
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const phases: PhaseResult[] = [];
    const errors: PhaseError[] = [];
    let currentPhase: number = PHASES.INIT;

    try {
      // ===========================================
      // FASE 0: INICIALIZACIÓN
      // ===========================================
      await this.updatePhase(invoiceId, PHASES.INIT);
      phases.push(await this.runPhase(PHASES.INIT, 'Inicialización', async () => {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'PROCESSING',
            currentPhase: PHASES.INIT,
            hkaLastAttempt: new Date(),
            hkaAttempts: { increment: 1 },
          },
        });

        // TRACEABILITY: Log start of emission process
        await prisma.invoiceLog.create({
          data: {
            invoiceId,
            action: 'PROCESSING',
            message: 'Iniciando proceso de emisión de factura',
            userId,
            userEmail,
            metadata: { method: 'Orchestrator' }
          }
        });

        return { initialized: true };
      }));

      // ===========================================
      // FASE 1: ENGINE 2 - REQUEST GUARD
      // ===========================================
      currentPhase = PHASES.VALIDATE_PREREQUISITES;
      await this.updatePhase(invoiceId, currentPhase);

      phases.push(await this.runPhase(currentPhase, 'HKA Guard Check', async () => {
        const guardResult = await this.guard.checkPrerequisites(clientId, {
          checkFolios: false, // PERF: folios check is irrelevant for emission flow, saves 3-8s SOAP call
          autoRefreshToken: true,
          retryConfig: this.config.retryConfig as RetryConfig // Cast seguro o undefined
        });

        if (!guardResult.canProceed) {
          throw guardResult.blockReason || new Error('Guard blocked request');
        }

        return {
          guardPassed: true,
          metadata: guardResult.checkMetadata
        };
      }));

      // Preparar Factura + Config (cargados UNA vez y reutilizados)
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, customer: true },
      });
      if (!invoice) throw new Error('Invoice not found');

      // PERF: Load HKA config ONCE here, reuse in Fase 3 and all background phases
      const hkaConfig = await getHKAConfig(clientId);

      // ===========================================
      // LOOP DE AUTO-HEALING (FASES 2 Y 3)
      // ===========================================
      let assignResult: PhaseResult | undefined;
      let emitResult: PhaseResult | undefined;
      let effectiveInvoiceId = invoiceId;

      let attempts = 0;
      const maxAttempts = 5;
      let isDuplicateError = false;

      while (attempts < maxAttempts) {
        attempts++;
        isDuplicateError = false;

        // ===========================================
        // FASE 2: ASIGNAR NÚMERO DE DOCUMENTO FISCAL
        // ===========================================
        currentPhase = PHASES.ASSIGN_DOCUMENT_NUMBER;
        await this.updatePhase(invoiceId, currentPhase);

        assignResult = await this.runPhase(currentPhase, 'Asignar Número Fiscal', async () => {
          // Obtener siguiente número secuencial atómicamente
          const numeroDocFiscal = await getNextInvoiceNumber(clientId);

          // Guardar en invoice ANTES de emitir
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              invoiceNumber: numeroDocFiscal,
              numeroDocumentoFiscal: numeroDocFiscal
            }
          });

          // TRACEABILITY: Log number assignment
          await prisma.invoiceLog.create({
            data: {
              invoiceId,
              action: 'UPDATED',
              message: `Número fiscal asignado: ${numeroDocFiscal}`,
              userId,
              userEmail,
              metadata: { numeroDocFiscal, attempt: attempts }
            }
          });

          return { numeroDocFiscal };
        });

        // Verificar que se asignó correctamente
        if (assignResult.status !== 'SUCCESS' || !assignResult.data?.numeroDocFiscal) {
          throw new Error('No se pudo asignar número de documento fiscal');
        }

        // CRITICAL FIX: Update local invoice object with the assigned number
        // This ensures Phase 3 (Adapter) uses the correct number instead of stale data
        invoice.invoiceNumber = String(assignResult.data.numeroDocFiscal);
        invoice.numeroDocumentoFiscal = String(assignResult.data.numeroDocFiscal);

        // ===========================================
        // FASE 3: EMISIÓN A HKA (ADAPTER + PROCESSOR)
        // ===========================================
        currentPhase = PHASES.EMIT_INVOICE;
        await this.updatePhase(invoiceId, currentPhase);

        try {
          emitResult = await this.runPhase(currentPhase, 'Emisión HKA', async () => {
            // PERF: hkaConfig already loaded above, no need to re-fetch

            // 1. ADAPTER
            const adaptation = await this.adapter.process(invoice, 'object', hkaConfig);
            if (!adaptation.success || !adaptation.documento) {
              throw new Error(`Error en adaptación: ${adaptation.errors?.join(', ')}`);
            }

            // Extraer el numeroDocumentoFiscal que se construyó en el adapter
            const numeroDocumentoFiscal = adaptation.documento?.datosTransaccion?.numeroDocumentoFiscal;

            // 2. SOAP CLIENT
            const soapResponse = await retryWithBackoff(
              async () => HKAClient.enviarFactura(hkaConfig, adaptation.documento!),
              this.config.retryConfig || RETRY_CONFIGS.ENVIAR,
              this.logger,
              { method: 'Enviar', invoiceId }
            );

            // 3. PROCESSOR
            const processResult = await this.processor.processEmissionResponse(soapResponse, {
              persistToDB: true,
              autoMapStatus: true,
              entityId: invoiceId
            });

            if (!processResult.success) {
              throw processResult.error || new Error(processResult.uiMessage);
            }

            // 4. Guardar el numeroDocumentoFiscal si aún no existe
            // Use recordId if processor returned a different invoice (CUFE deduplication)
            const recordId = processResult.recordId || invoiceId;
            if (numeroDocumentoFiscal) {
              await prisma.invoice.update({
                where: { id: recordId },
                data: {
                  invoiceNumber: numeroDocumentoFiscal,
                  numeroDocumentoFiscal: numeroDocumentoFiscal
                }
              });
            }

            return {
              cufe: processResult.data?.cufe,
              protocol: processResult.data?.nroProtocoloAutorizacion,
              numeroDocumentoFiscal: numeroDocumentoFiscal,
              status: processResult.status,
              recordId: recordId // Pass back the effective invoice ID
            };
          });

          // Extraer ID efectivo desde la fase completada
          effectiveInvoiceId = (emitResult.data?.recordId as string) || invoiceId;

          // Emisión exitosa, rompemos el loop
          break;

        } catch (error) {
          // Analizar si es error de duplicado (102 "El documento está duplicado")
          const hkaError = error instanceof HKAError
            ? error
            : parseHKAError(undefined, error instanceof Error ? error.message : String(error));

          isDuplicateError = hkaError.type === HKAErrorType.DUPLICATE ||
            (hkaError.type === HKAErrorType.DOCUMENT_ERROR && hkaError.message.toLowerCase().includes('duplicad'));

          if (isDuplicateError && attempts < maxAttempts) {
            // Activar Auto-Healing y reintentar
            await prisma.client.update({
              where: { id: clientId },
              data: { lastInvoiceNumber: { increment: 1 } }
            });
            await this.logger.log({
              level: 'WARN',
              method: 'InvoiceOrchestrator',
              timestamp: new Date(),
              invoiceId, clientId, userId,
              metadata: {
                action: 'AUTO_HEAL_DUPLICATE_RETRY',
                message: 'Auto-incremented lastInvoiceNumber to heal sequence desync and retrying',
                attempt: attempts
              },
              phase: currentPhase
            });
            
            continue; // Volver al inicio del while para asignar nuevo número
          }

          // Si no es duplicado o se agotaron reintentos, realizamos Rollback (Opción B: JIT / Success-Append-Only)
          const isDgiTimeout = hkaError.type === HKAErrorType.DGI_TIMEOUT;
          
          if (!isDuplicateError && !isDgiTimeout && assignResult?.data?.numeroDocFiscal) {
            const assignedNum = parseInt(String(assignResult.data.numeroDocFiscal), 10);
            
            // Verificar si la DB sigue teniendo este número como el último.
            // Si nadie más ha emitido exitosamente después, decrementamos para "liberarlo".
            const currentClient = await prisma.client.findUnique({
              where: { id: clientId },
              select: { lastInvoiceNumber: true }
            });

            if (currentClient && currentClient.lastInvoiceNumber === assignedNum) {
               await prisma.client.update({
                 where: { id: clientId },
                 data: { lastInvoiceNumber: { decrement: 1 } }
               });
               
               await prisma.invoiceLog.create({
                 data: {
                   invoiceId,
                   action: 'UPDATED',
                   message: `Rollback de secuencia fiscal. El folio ${assignedNum} vuelve a estar disponible para la secuencia.`,
                   userId,
                   userEmail,
                   metadata: { action: 'SEQUENCE_ROLLBACK', numeroDocFiscal: assignedNum }
                 }
               });
            }

            // IMPORTANTE: Limpiamos el número de esta factura para que en el próximo 
            // intento (Retry) tome el número fresco que corresponda a la secuencia actual.
            await prisma.invoice.update({
              where: { id: invoiceId },
              data: {
                invoiceNumber: null,
                numeroDocumentoFiscal: null
              }
            });
            invoice.invoiceNumber = null;
            invoice.numeroDocumentoFiscal = null;
          }

          // Propagar error hacia el catch exterior
          throw error;
        }
      }

      if (assignResult) phases.push(assignResult);
      if (emitResult) phases.push(emitResult);

      // Validar resultado de emisión y obtener número de documento
      const emittedInvoice = await prisma.invoice.findUnique({ where: { id: effectiveInvoiceId } });

      if (!emittedInvoice) {
        throw new Error('Invoice not found after emission');
      }

      if (emittedInvoice.status !== 'EMITTED') {
        throw new Error(`Invoice emission incomplete. Status: ${emittedInvoice.status}`);
      }

      // El invoiceNumber debe existir después de una emisión exitosa
      const invoiceNumber = emittedInvoice.invoiceNumber || emittedInvoice.numeroDocumentoFiscal;

      if (!invoiceNumber) {
        this.logger.log({
          level: 'ERROR',
          method: 'InvoiceOrchestrator',
          timestamp: new Date(),
          invoiceId,
          clientId,
          metadata: {
            message: 'Factura emitida pero sin numeroDocumentoFiscal',
            status: emittedInvoice.status,
            cufe: emittedInvoice.cufe
          }
        });
        throw new Error('Factura emitida pero sin número de documento fiscal. No se pueden realizar descargas.');
      }

      // ===========================================
      // FASES BACKGROUND (PDF, XML, Email, Status)
      // PERF: Fire-and-forget — no bloquean la respuesta al usuario.
      // Los resultados se persisten en BD asincrónicamente.
      // ===========================================
      const datosDoc = buildDatosDocumento({ numeroDocumentoFiscal: invoiceNumber }, hkaConfig);

      // Fire background tasks without awaiting — captures effectiveInvoiceId in closure
      const bgInvoiceId = effectiveInvoiceId;
      const bgReceiverEmail = emittedInvoice.receiverEmail;

      // FASE 4: PDF (fire-and-forget)
      if (this.config.autoDownloadPDF) {
        this.runPhase(PHASES.DOWNLOAD_PDF, 'Descarga de PDF', async () => {
          const res = await downloadPDFWithConfig(hkaConfig, datosDoc);
          if (res.success && res.documentoBase64) {
            await prisma.invoice.update({ where: { id: bgInvoiceId }, data: { pdfBase64: res.documentoBase64, pdfDescargado: true } });
            return { downloaded: true };
          }
          throw new Error(res.error || 'PDF download failed');
        }, { allowFailure: true }).catch(() => { /* already logged by runPhase */ });
      }

      // FASE 5: XML (fire-and-forget)
      if (this.config.autoDownloadXML) {
        this.runPhase(PHASES.DOWNLOAD_XML, 'Descarga de XML', async () => {
          const res = await downloadXMLWithConfig(hkaConfig, datosDoc);
          if (res.success && res.contenido) {
            await prisma.invoice.update({ where: { id: bgInvoiceId }, data: { rawXml: res.contenido, xmlDescargado: true } });
            return { downloaded: true };
          }
          throw new Error(res.error || 'XML download failed');
        }, { allowFailure: true }).catch(() => { /* already logged by runPhase */ });
      }

      // FASE 6: Email (fire-and-forget)
      if (this.config.autoSendEmail && bgReceiverEmail) {
        this.runPhase(PHASES.SEND_EMAIL, 'Envío de Correo', async () => {
          const res = await sendInvoiceEmailWithConfig(hkaConfig, datosDoc, bgReceiverEmail!);
          if (res.success) {
            await prisma.emailDelivery.create({
              data: { invoiceId: bgInvoiceId, recipientEmail: bgReceiverEmail!, status: 'SENT', sentAt: new Date(), includePDF: true, includeXML: true }
            });
            return { sent: true };
          }
          throw new Error(res.error || 'Email sending failed');
        }, { allowFailure: true }).catch(() => { /* already logged by runPhase */ });
      }

      // FASE 7: Status Verify (fire-and-forget, no artificial delay)
      if (this.config.autoVerifyStatus) {
        this.runPhase(PHASES.VERIFY_STATUS, 'Verificación de Estado', async () => {
          const res = await consultarEstadoWithConfig(hkaConfig, datosDoc);
          if (res.success) return { status: res.estatusDocumento };
          throw new Error(res.error || 'Status check failed');
        }, { allowFailure: true }).catch(() => { /* already logged by runPhase */ });
      }

      // ===========================================
      // FASE 9: ACTUALIZACIÓN DE INVENTARIO
      // ===========================================
      currentPhase = PHASES.UPDATE_INVENTORY;
      await this.updatePhase(effectiveInvoiceId, currentPhase);
      phases.push(await this.runPhase(currentPhase, 'Actualización de Inventario', async () => {
        const { InvoiceService } = await import('@/features/invoicing/model/services/invoice.service');
        const invoiceService = new InvoiceService();
        // Método resuelve clientId desde el invoice; solo recibe invoiceId.
        await invoiceService.handleInventoryDeductionForInternal(effectiveInvoiceId);
        return { inventoryUpdated: true };
      }, { allowFailure: true })); // Inventory failure shouldn't block the UI summary but it's logged

      // ===========================================
      // FASE 8: FINALIZACIÓN
      // ===========================================
      currentPhase = PHASES.FINALIZE;
      await this.updatePhase(effectiveInvoiceId, currentPhase);
      phases.push(await this.runPhase(currentPhase, 'Finalización', async () => {
        await prisma.invoice.update({
          where: { id: effectiveInvoiceId },
          data: {
            currentPhase: PHASES.FINALIZE,
            phaseHistory: phases.map(p => ({
              phase: p.phase,
              name: p.name,
              status: p.status,
              timestamp: p.timestamp.toISOString(),
              duration: p.duration,
            })),
          },
        });

        // Final Log
        await prisma.invoiceLog.create({
          data: {
            invoiceId: effectiveInvoiceId,
            action: 'CERTIFIED',
            message: 'Factura emitida exitosamente',
            userId, userEmail,
            metadata: { totalPhases: phases.length, duration: Date.now() - startTime }
          }
        });
        return { completed: true };
      }));

      return {
        success: true,
        invoice: {
          id: effectiveInvoiceId,
          cufe: emittedInvoice.cufe || undefined,
          qrCode: emittedInvoice.qrCode || undefined,
          qrUrl: emittedInvoice.qrUrl || undefined,
          hkaProtocol: emittedInvoice.hkaProtocol || undefined,
          hkaProtocolDate: emittedInvoice.hkaProtocolDate?.toISOString() || undefined,
          invoiceNumber: emittedInvoice.invoiceNumber || emittedInvoice.numeroDocumentoFiscal || undefined,
          status: 'EMITTED',
          currentPhase: PHASES.FINALIZE,
        },
        phases,
        errors,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      // Error Global / Crítico
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (typeof error === 'object' && error !== null) {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = String(error);
        }
      }

      const hkaError = error instanceof HKAError ? error : new HKAError(HKAErrorType.UNKNOWN, errorMessage);

      // =====================================================
      // MANEJO ESPECIAL: DGI_TIMEOUT (código 202)
      // El documento YA está en cola de HKA. NO reintentar.
      // Marcar como PENDING_DGI y esperar resolución vía polling.
      // =====================================================
      if (hkaError.type === HKAErrorType.DGI_TIMEOUT) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'PROCESSING',
            currentPhase,
            hkaStatus: 'PENDING_DGI',
            hkaMessage: 'La DGI no respondió a tiempo. El documento está en cola de procesamiento. ' +
              'No intente emitirlo nuevamente. Use EstadoDocumento() para consultar.',
            hkaCode: hkaError.code,
          },
        });

        await prisma.invoiceLog.create({
          data: {
            invoiceId,
            action: 'MANUAL_INTERVENTION',
            message: `DGI Timeout (código 202): Documento en cola de HKA. NO reenviar.`,
            userId, userEmail,
            metadata: {
              phase: currentPhase,
              code: hkaError.code,
              action: 'POLL_WITH_ESTADO_DOCUMENTO',
            }
          }
        });

        await this.logger.log({
          level: 'WARN',
          method: 'InvoiceOrchestrator',
          timestamp: new Date(),
          invoiceId, clientId, userId,
          error: { message: hkaError.message, type: hkaError.type, recoverable: false },
          metadata: { action: 'DGI_TIMEOUT_PENDING', phase: currentPhase },
          phase: currentPhase
        });

        return {
          success: false,
          invoice: {
            id: invoiceId,
            status: 'PENDING_DGI',
            currentPhase,
          },
          phases,
          errors: [{ phase: currentPhase, error: hkaError, recoverable: false }],
          duration: Date.now() - startTime,
          // Signal to the caller that polling is needed
          pendingDGI: true,
        } as OrchestrationResult;
      }



      // 4. ENGINE 4: THE DOCTOR (DIAGNOSTIC)
      // Analizar causa raíz y obtener sugerencia
      const diagnosis = this.doctor.analyzeFailure({
        invoiceId,
        phase: currentPhase,
        error: error
      });

      errors.push({ phase: currentPhase, error: hkaError, recoverable: hkaError.recoverable });

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'ERROR',
          currentPhase,
          hkaStatus: 'ERROR',
          // Enrich error message with Doctor's prescription
          hkaMessage: `${diagnosis.userMessage} (Causa técnica: ${hkaError.message})`,
          hkaCode: hkaError.code,
          phaseErrors: {
            [currentPhase]: {
              message: hkaError.message,
              diagnosis: diagnosis.rootCause,
              prescription: diagnosis.suggestedAction,
              severity: diagnosis.severity,
              timestamp: new Date().toISOString()
            }
          }
        },
      });

      // TRACEABILITY: Log error
      await prisma.invoiceLog.create({
        data: {
          invoiceId,
          action: 'ERROR',
          message: `Fallo en emisión (Fase ${currentPhase}): ${hkaError.message}`,
          userId,
          userEmail,
          metadata: {
            diagnosis: diagnosis,
            phase: currentPhase,
            code: hkaError.code
          }
        }
      });

      await this.logger.log({
        level: 'CRITICAL',
        method: 'InvoiceOrchestrator',
        timestamp: new Date(),
        invoiceId, clientId, userId,
        error: { message: hkaError.message, type: hkaError.type, recoverable: hkaError.recoverable },
        metadata: { diagnosis },
        phase: currentPhase
      });

      return {
        success: false,
        invoice: { id: invoiceId, status: 'ERROR', currentPhase },
        phases,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Ejecuta una fase individual
   */
  private async runPhase<T>(
    phase: number,
    name: string,
    operation: () => Promise<T>,
    options: { allowFailure?: boolean } = {}
  ): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      const data = await operation();

      return {
        phase,
        name,
        status: 'SUCCESS',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        data: data as Record<string, unknown>,
      };
    } catch (error) {
      const hkaError = error instanceof HKAError
        ? error
        : parseHKAError(undefined, error instanceof Error ? error.message : 'Unknown error');

      if (options.allowFailure) {
        // Fase background que falló - marcar como SKIPPED y continuar
        await this.logger.log({
          level: 'WARN',
          method: PHASE_NAMES[phase],
          timestamp: new Date(),
          phase,
          duration: Date.now() - startTime,
          error: {
            type: hkaError.type,
            message: hkaError.message,
            recoverable: hkaError.recoverable,
          },
          metadata: { allowFailure: true },
        });

        return {
          phase,
          name,
          status: 'SKIPPED',
          timestamp: new Date(),
          duration: Date.now() - startTime,
          error: {
            type: hkaError.type,
            message: hkaError.message,
            recoverable: hkaError.recoverable,
          },
        };
      }

      // Fase crítica que falló - propagar el error
      throw error;
    }
  }

  /**
   * Actualiza la fase actual en la base de datos
   */
  private async updatePhase(invoiceId: string, phase: number): Promise<void> {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        currentPhase: phase,
        lastPhaseAttempt: new Date(),
      },
    });
  }
}
