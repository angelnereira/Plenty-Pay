/**
 * API Route: POS Sync Offline Invoices
 *
 * Receives pending invoices generated offline (no internet) and processes them:
 *   1. Assigns a real sequential invoice number via getNextInvoiceNumber()
 *   2. Recalculates CUFE with the real number (tipoEmision='02', contingencia internet)
 *   3. Creates the Invoice record and enqueues for HKA emission via BullMQ
 *
 * Idempotent: invoices already in DB (matched by clientReferenceId/localId) are
 * acknowledged as synced without re-processing.
 *
 * POST /api/pos/sync-offline
 *
 * Body: { invoices: PendingInvoice[] }
 *
 * Response:
 *   { results: [{ localId, success, invoiceId?, error? }] }
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { after } from 'next/server';
import { InvoiceOrchestrator } from '@/features/hka/model/services/invoice-orchestrator.service';
import { getNextInvoiceNumber } from '@/features/hka/model/services/invoice-numbering.service';
import { getHKAConfig } from '@/features/hka/model/repositories/hka-config.repository';
import { generarCUFELocal } from '@/features/hka/model/services/cufe.service';
import type { PendingInvoice } from '@/lib/offline-db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { clientId, id: userId, email: userEmail } = session.user as {
      clientId: string;
      id: string;
      email?: string;
    };

    const body = await request.json();
    const invoices: PendingInvoice[] = body.invoices ?? [];

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Load HKA config once for CUFE recalculation
    const hkaConfig = await getHKAConfig(clientId);

    const results: Array<{ localId: string; success: boolean; invoiceId?: string; error?: string }> = [];

    for (const inv of invoices) {
      try {
        // 1. Idempotency: check if already synced by localId reference
        const existing = await prisma.invoice.findFirst({
          where: {
            clientId,
            clientReferenceId: inv.id,
          },
          select: { id: true, status: true },
        });

        if (existing) {
          results.push({ localId: inv.id, success: true, invoiceId: existing.id });
          continue;
        }

        // 2. Assign real sequential invoice number (atomic)
        const realInvoiceNumber = await getNextInvoiceNumber(clientId);

        // 2b. Regla DGI 72 horas: si transcurrieron más de 72h desde el inicio de la
        // contingencia, el motivoContingencia DEBE incluir la justificación del retraso.
        const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
        const fechaInicioMs = inv.fechaInicioContingencia ?? inv.createdAt;
        const elapsedMs = Date.now() - fechaInicioMs;
        const fechaInicioContingencia = new Date(fechaInicioMs);
        let motivoFinal = (inv.motivoContingencia ?? 'Falla de conectividad a internet en el local comercial').slice(0, 200);
        if (elapsedMs > SEVENTY_TWO_HOURS_MS) {
          const horas = Math.floor(elapsedMs / (1000 * 60 * 60));
          const justificacion = ` RETRASO ${horas}h: La factura no pudo transmitirse por falla sostenida de conectividad.`;
          // DGI máximo 250 chars para motivoContingencia
          motivoFinal = (motivoFinal + justificacion).slice(0, 250);
        }

        // 3. Recalculate CUFE with the real invoice number
        const issueDate = new Date(inv.createdAt);
        const cufeResult = generarCUFELocal({
          tipoDocumento: '01',
          tipoContribuyente: hkaConfig.emisorTipoContribuyente ?? '1',
          rucEmisor: hkaConfig.emisorRuc ?? '',
          digitoVerificadorRuc: hkaConfig.emisorDv ?? '',
          codigoSucursal: hkaConfig.branchCode,
          fechaEmision: issueDate,
          numeroDocumentoFiscal: realInvoiceNumber,
          puntoFacturacion: hkaConfig.puntoFacturacionFiscal,
          tipoEmision: '02',
          ambiente: hkaConfig.environment === 'prod' ? '1' : '2',
        });

        // 4. Create Invoice in QUEUED state with the real number and recalculated CUFE
        const subtotal = inv.subtotal
        const discount = inv.discount ?? 0
        const subtotalAfterDiscount = subtotal - discount
        const itbms = inv.tax

        const created = await prisma.invoice.create({
          data: {
            clientId,
            createdBy: userId,
            clientReferenceId: inv.id, // localId as idempotency key
            status: 'QUEUED',
            invoiceNumber: realInvoiceNumber,
            numeroDocumentoFiscal: realInvoiceNumber,
            cufeLocal: cufeResult.cufe,
            // Emisor snapshot (from offline config cached on device)
            issuerRuc: inv.businessRuc,
            issuerDv: inv.businessDv,
            issuerName: inv.businessName,
            issuerAddress: inv.businessAddress,
            issuerEmail: '',
            // Receptor snapshot
            receiverName: inv.customerName ?? 'Consumidor Final',
            receiverRuc: inv.customerRuc,
            receiverType: inv.customerRuc ? 'CONTRIBUTOR' : 'FINAL_CONSUMER',
            // Montos
            subtotal,
            discount,
            subtotalAfterDiscount,
            itbms,
            total: inv.total,
            paymentMethod: inv.paymentMethod.toUpperCase(),
            notes: `[OFFLINE] Generada offline el ${new Date(inv.createdAt).toLocaleString('es-PA')}`,
            issueDate: new Date(inv.createdAt),
            // Persistir modo de emisión y campos de contingencia DGI (B04/B05)
            // para que el worker los use incluso si la contingencia ya fue desactivada.
            tipoEmisionOverride: inv.tipoEmision,
            fechaInicioContingencia,
            motivoContingencia: motivoFinal,
            queuedAt: new Date(),
            // Items
            items: {
              create: inv.items.map((item, idx) => {
                const itemSubtotal = item.quantity * item.unitPrice
                const itemTax = itemSubtotal * (item.taxRate / 100)
                return {
                  lineNumber: idx + 1,
                  code: item.productId.slice(0, 20),
                  productId: item.productId,
                  description: item.productName,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  taxRate: item.taxRate,
                  taxAmount: itemTax,
                  subtotal: itemSubtotal,
                  total: itemSubtotal + itemTax,
                }
              }),
            },
          },
          select: { id: true },
        });

        // 3. Emit using Vercel Native `after()`
        const orchestrator = new InvoiceOrchestrator({
          autoDownloadPDF: true,
          autoDownloadXML: false,
          autoVerifyStatus: false,
          autoSendEmail: false, // avoid spamming customer for offline invoices
        });

        after(async () => {
          try {
            await orchestrator.emitInvoiceWithFullWorkflow(
              created.id,
              clientId,
              userId,
              userEmail ?? undefined
            );
          } catch (emitError) {
            console.error(`[SYNC_OFFLINE_EMIT_ERROR] Invoice ${created.id}:`, emitError);
          }
        });

        results.push({ localId: inv.id, success: true, invoiceId: created.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ localId: inv.id, success: false, error: message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
