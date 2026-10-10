"use server";

import { auth } from "@core/auth";
import { prisma } from "@/lib/db";
import { InvoiceService } from "@/features/invoicing/model/services/invoice.service";
import { InventoryRepository } from "@/features/inventory/model/repositories/inventory.repository";
import { CartItem } from "@/features/pos/stores/pos.store";
import { revalidatePath } from "next/cache";
import type { PaymentMethod, PaymentDetails, Discount } from "@/features/pos/types/pos-types";
import { getHKAConfig } from "@/features/hka/model/repositories/hka-config.repository";
import { getNextInvoiceNumber } from "@/features/hka/model/services/invoice-numbering.service";
import { generarCUFELocal } from "@/features/hka/model/services/cufe.service";
import { after } from "next/server";
import { processInvoiceForMotor } from "@core/motor/credit-hook";

const invoiceService = new InvoiceService();
const inventoryRepo = new InventoryRepository();

/**
 * Descuenta el stock de cada ítem del carrito directamente usando OCC.
 * Se llama desde el server action con el carrito disponible en memoria,
 * sin depender de que invoiceItem esté persistido en la BD.
 * Es idempotente con el guard de stockMovement.referenceId + referenceType.
 */
async function deductInventoryFromCart(
    cart: CartItem[],
    invoiceId: string,
    clientId: string,
    userId: string
): Promise<void> {
    const itemsWithStock = cart.filter(item => item.stock > 0);
    if (itemsWithStock.length === 0) return;

    // Idempotency check: if we already deducted for this invoice, skip
    const existingMovement = await prisma.stockMovement.findFirst({
        where: { referenceId: invoiceId, referenceType: 'Invoice', type: 'SALE' }
    });
    if (existingMovement) {
        console.log(`[POS_INVENTORY] Already deducted for invoice ${invoiceId}. Skipping.`);
        return;
    }

    for (const item of cart) {
        // Verify product exists and belongs to this client
        const product = await prisma.product.findFirst({
            where: { id: item.id, clientId, deletedAt: null }
        });
        if (!product) {
            console.warn(`[POS_INVENTORY] Product ${item.id} (${item.name}) not found in inventory for client ${clientId}. Skipping.`);
            continue;
        }

        try {
            await inventoryRepo.reserveStockWithOCC(
                product.id,
                item.quantity,
                invoiceId,
                'Invoice',
                userId
            );
            console.log(`[POS_INVENTORY] Deducted ${item.quantity}x ${product.name} (ID: ${product.id})`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            // Non-blocking: log but don't fail the sale
            console.error(`[POS_INVENTORY] Failed to deduct ${product.name}:`, msg);
        }
    }
}

export async function processSaleAction(
    cart: CartItem[],
    paymentMethod: PaymentMethod,
    options?: {
        draftOnly?: boolean,
        internalOnly?: boolean, // NEW: Create as internal sale (no HKA emission)
        customer?: {
            razonSocial: string;
            tipoClienteFE: string;
            numeroRUC?: string;
            digitoVerificadorRUC?: string;
            correoElectronico1?: string;
            telefono1?: string;
            direccion?: string;
        } | null,
        discount?: Discount | null,
        notes?: string,
        paymentDetails?: PaymentDetails | null
    }
) {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
        return { success: false, error: "No autorizado" };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { client: true }
    });

    if (!user || !user.clientId) {
        return { success: false, error: "Usuario o Cliente no encontrado" };
    }

    try {
        // 1. Prepare Invoice Data
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        // 1.a Resolver descuento POR LÍNEA (independiente del global) en B/.
        // Mantiene la fórmula:
        //   lineDiscountFor(item) = item.lineDiscount.type === 'PERCENTAGE'
        //     ? lineSubtotal * pct/100
        //     : min(value, lineSubtotal)
        const resolveLineDiscount = (item: CartItem): number => {
            if (!item.lineDiscount) return 0;
            const lineSubtotal = item.price * item.quantity;
            if (item.lineDiscount.type === 'PERCENTAGE') {
                const pct = Math.min(Math.max(item.lineDiscount.value, 0), 100);
                return lineSubtotal * (pct / 100);
            }
            return Math.min(Math.max(item.lineDiscount.value, 0), lineSubtotal);
        };

        const lineDiscountAmount = cart.reduce(
            (acc, item) => acc + resolveLineDiscount(item),
            0
        );
        const baseAfterLineDiscount = Math.max(subtotal - lineDiscountAmount, 0);

        // 1.b Resolver descuento GLOBAL aplicado sobre (subtotal − descuentos
        // por línea). Capeado para no generar negativos.
        let globalDiscountAmount = 0;
        if (options?.discount) {
            if (options.discount.type === 'PERCENTAGE') {
                const pct = Math.min(Math.max(options.discount.value, 0), 100);
                globalDiscountAmount = baseAfterLineDiscount * (pct / 100);
            } else {
                globalDiscountAmount = Math.min(
                    Math.max(options.discount.value, 0),
                    baseAfterLineDiscount
                );
            }
        }

        const discountAmount = lineDiscountAmount + globalDiscountAmount;
        const subtotalAfterDiscount = Math.max(subtotal - discountAmount, 0);
        const tax = subtotalAfterDiscount * 0.07; // 7% ITBMS on discounted amount
        const total = subtotalAfterDiscount + tax;

        // Format payment method for metadata
        const paymentInfo: any = {
            method: paymentMethod
        };

        if (paymentMethod === 'MIXED' && options?.paymentDetails) {
            paymentInfo.details = {
                cash: options.paymentDetails.cashAmount || 0,
                card: options.paymentDetails.cardAmount || 0,
                transfer: options.paymentDetails.transferAmount || 0
            };
        }

        // Detectar pago a crédito en POS: cualquier "CREDIT" o variantes que el
        // front mande (ej. "CREDITO"). Si el cajero elige crédito, el cobro no
        // entra ahora — se registra como cargo en el ledger del Motor.
        const isCreditPayment = String(paymentMethod).toUpperCase() === "CREDIT"
            || String(paymentMethod).toUpperCase() === "CREDITO";

        const invoiceData = {
            clientId: user.clientId, // The issuer/business clientId
            createdBy: user.id,
            clientReferenceId: `POS-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            issuerRuc: user.client.ruc || "PENDING",
            issuerDv: user.client.dv || "00",
            issuerName: user.client.name,
            issuerAddress: user.client.address || "Ciudad de Panama",
            issuerEmail: user.client.email || user.email,
            receiverName: options?.customer?.razonSocial || "CONSUMIDOR FINAL",
            receiverType: options?.customer ? (options.customer.tipoClienteFE === '02' ? "FINAL_CONSUMER" : "TAXPAYER") : "FINAL_CONSUMER",
            receiverRuc: options?.customer?.numeroRUC || undefined,
            receiverDv: options?.customer?.digitoVerificadorRUC || undefined,
            receiverEmail: options?.customer?.correoElectronico1 || undefined,
            receiverPhone: options?.customer?.telefono1 || undefined,
            receiverAddress: options?.customer?.direccion || undefined,
            documentType: "FACTURA" as any,
            paymentMethod: paymentMethod,
            paymentTerm: isCreditPayment ? "CREDIT" : "CASH",
            pointOfSale: "POS-01",
            subtotal: subtotal,
            itbms: tax,
            total: total,
            subtotalAfterDiscount: subtotalAfterDiscount,
            discount: discountAmount,
            items: cart.map((item, index) => {
                // Para cada línea persistimos en InvoiceItem.discount el
                // descuento total de la línea: descuento POR-LÍNEA (input
                // explícito del cajero en esa fila) + porción PRORRATEADA del
                // descuento global (si lo hay). El mapper HKA
                // (invoice-to-hka.ts) divide ese monto por la cantidad para
                // construir precioUnitarioDescuento por unidad y reducir
                // proporcionalmente la base imponible del ITBMS (Opción A:
                // descuento por-ítem alineado con HKA Panamá).
                const itemSubtotal = item.price * item.quantity;
                const lineDisc = resolveLineDiscount(item);
                // El global se prorratea sobre el subtotal POST descuento por
                // línea, para que líneas con su propio descuento no absorban
                // doble.
                const lineSubtotalAfter = itemSubtotal - lineDisc;
                const ratio = baseAfterLineDiscount > 0
                    ? (lineSubtotalAfter / baseAfterLineDiscount)
                    : 0;
                const itemGlobalShare = globalDiscountAmount * ratio;
                const itemDiscount = lineDisc + itemGlobalShare;
                const itemSubtotalAfterDiscount = Math.max(itemSubtotal - itemDiscount, 0);
                const itemTax = itemSubtotalAfterDiscount * 0.07;
                const itemTotal = itemSubtotalAfterDiscount + itemTax;

                return {
                    lineNumber: index + 1,
                    code: (item.sku || `SKU-${item.id}`).substring(0, 20),
                    description: item.name,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    discount: itemDiscount,
                    subtotal: itemSubtotal,
                    taxAmount: itemTax,
                    total: itemTotal,
                    taxRate: 7,
                    unit: "und"
                };
            }),
            notes: options?.notes || undefined,
            internalNotes: JSON.stringify({
                payment: paymentInfo,
                source: 'POS',
                isInternal: options?.internalOnly || false
            })
        };

        const finalInvoiceData = invoiceData;

        console.log("[POS_PROCESS] Creating draft...", {
            items: cart.length,
            draftOnly: options?.draftOnly,
            internalOnly: options?.internalOnly
        });

        // 2. Create Draft
        // @ts-ignore
        const draftResult = await invoiceService.createDraft(finalInvoiceData as any);

        if (!draftResult.success || !draftResult.data) {
            console.error("[POS_PROCESS] Draft creation failed", draftResult.error);
            throw new Error(draftResult.error || "Fallo al crear borrador");
        }

        const invoiceId = draftResult.data.id;

        // If Draft Only requested (e.g. for edit mode), return early
        if (options?.draftOnly) {
            return {
                success: true,
                invoiceId: invoiceId,
                invoiceNumber: "DRAFT"
            };
        }

        // If Internal Only requested (FACTURAR button - no HKA emission)
        if (options?.internalOnly) {
            // Generate internal invoice number
            const today = new Date();
            const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

            // Get count of internal invoices for today for this client
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const todayEnd = new Date(todayStart);
            todayEnd.setDate(todayEnd.getDate() + 1);

            const internalCount = await prisma.invoice.count({
                where: {
                    clientId: user.clientId,
                    status: 'INTERNAL',
                    createdAt: {
                        gte: todayStart,
                        lt: todayEnd
                    }
                }
            });

            const internalNumber = `INT-${dateStr}-${String(internalCount + 1).padStart(4, '0')}`;

            // Update invoice to INTERNAL status with internal number
            const updatedInvoice = await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'INTERNAL',
                    invoiceNumber: internalNumber,
                    issueDate: new Date(),
                    notes: options?.notes ?? undefined
                }
            });

            // Deduct inventory (same as COBRAR). El método resuelve clientId
            // a partir del invoice, así que solo se le pasa invoiceId.
            await invoiceService.handleInventoryDeductionForInternal(invoiceId);

            // Log the action
            await prisma.invoiceLog.create({
                data: {
                    invoiceId: invoiceId,
                    action: 'CREATED',
                    message: 'Factura interna creada desde POS',
                    userId: user.id,
                    userEmail: user.email || undefined
                }
            });

            // Hook Motor: crédito → cargo en ledger (best-effort, no bloquea)
            if (isCreditPayment) {
                await processInvoiceForMotor(invoiceId);
            }

            revalidatePath("/dashboard/pos");
            revalidatePath("/dashboard/inventory");
            revalidatePath("/dashboard/facturas");

            console.log("[POS_PROCESS] Internal invoice created:", internalNumber);

            return {
                success: true,
                invoiceId: invoiceId,
                invoiceNumber: internalNumber,
                isInternal: true,
                issueDate: updatedInvoice.issueDate
            };
        }

        // ============================================================
        // 3. FORK: ASÍNCRONO vs SÍNCRONO
        //
        // Regla DGI + negocio:
        //   ASÍNCRONO  → Consumidor Final (02) + entregaCAFE=3 (email)
        //                La DGI permite "Autorización Posterior" (tipoEmision=03)
        //                para B2C. El cajero no espera. HKA autoriza en background
        //                y EnvioCorreo() lleva el CAFE PDF al cliente.
        //
        //   SÍNCRONO   → Contribuyente (01) / Gobierno (03): requieren Autorización
        //                Previa (tipoEmision=01) para crédito fiscal ITBMS.
        //                También síncrono si entregaCAFE=2 (papel impreso), porque
        //                el QR del CAFE requiere el digestValue de la firma de HKA.
        // ============================================================
        const isConsumidorFinal = finalInvoiceData.receiverType === "FINAL_CONSUMER";
        let useAsync = false;

        if (isConsumidorFinal) {
            try {
                const hkaConfig = await getHKAConfig(user.clientId);
                // Async sólo si la entrega es electrónica (email) — no papel
                useAsync = hkaConfig.entregaCAFE === '3';
            } catch {
                // Si no se puede leer el config, fall-back a síncrono seguro
                useAsync = false;
            }
        }

        // -------------------------------------------------------
        // FLUJO ASÍNCRONO: pre-asignar número + CUFE, encolar
        // -------------------------------------------------------
        if (useAsync) {
            let preAssignedNumber: string;
            let localCufe: string | undefined;

            try {
                // Asignar número fiscal secuencial ahora (el worker lo reutilizará)
                preAssignedNumber = await getNextInvoiceNumber(user.clientId);

                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: {
                        invoiceNumber: preAssignedNumber,
                        numeroDocumentoFiscal: preAssignedNumber,
                        status: 'QUEUED',
                        issueDate: new Date(),
                    },
                });

                // Generar CUFE local para mostrar en el ticket del cajero
                // (el worker obtendrá el CUFE oficial de 66 chars de HKA)
                try {
                    const hkaConfig = await getHKAConfig(user.clientId);
                    const rucParaCufe = hkaConfig.emisorRuc || user.client.ruc;
                    const dvParaCufe  = hkaConfig.emisorDv  || user.client.dv;
                    if (rucParaCufe && dvParaCufe) {
                        const cufeResult = generarCUFELocal({
                            tipoDocumento: '01',
                            tipoContribuyente: hkaConfig.emisorTipoContribuyente ?? '2',
                            rucEmisor: rucParaCufe,
                            digitoVerificadorRuc: dvParaCufe,
                            codigoSucursal: hkaConfig.branchCode,
                            fechaEmision: new Date(),
                            numeroDocumentoFiscal: preAssignedNumber,
                            puntoFacturacion: hkaConfig.puntoFacturacionFiscal,
                            tipoEmision: '03', // Consumidor Final → Autorización Posterior
                            ambiente: hkaConfig.environment === 'prod' ? '1' : '2',
                        });
                        localCufe = cufeResult.cufe;
                    }
                } catch {
                    // Non-blocking: el CUFE local es sólo para display en el ticket
                }
            } catch (numError: any) {
                throw new Error(`Error asignando número fiscal: ${numError.message}`);
            }

            // Descontar inventario inmediatamente desde el carrito (no esperar al orquestrador)
            // El orquestrador tiene un guard de idempotencia: si ya descontamos aquí, la Fase 9 lo detecta y salta.
            await deductInventoryFromCart(cart, invoiceId, user.clientId, user.id);

            // Ejecutar en background (Vercel native)
            after(async () => {
                try {
                    const { InvoiceOrchestrator } = await import("@/features/hka/model");
                    const orchestrator = new InvoiceOrchestrator({
                        autoDownloadPDF: false,
                        autoDownloadXML: false,
                        autoSendEmail: true,
                        autoVerifyStatus: true,
                    });
                    await orchestrator.emitInvoiceWithFullWorkflow(
                        invoiceId,
                        user.clientId,
                        user.id,
                        user.email || undefined
                    );
                } catch (err) {
                    console.error("[POS_PROCESS] Error en emisión asíncrona:", err);
                }
                // Hook Motor (también en background): si es venta a crédito,
                // registra el cargo. Idempotente vs cualquier llamada previa.
                if (isCreditPayment) {
                    await processInvoiceForMotor(invoiceId);
                }
            });

            console.log(`[POS_PROCESS] Async — invoice ${invoiceId} en background, número: ${preAssignedNumber}`);

            revalidatePath("/dashboard/pos");
            revalidatePath("/dashboard/inventory");
            revalidatePath("/dashboard/facturas");

            return {
                success: true,
                invoiceId,
                invoiceNumber: preAssignedNumber,
                cufe: localCufe,         // CUFE local (64 chars) para el ticket
                isQueued: true,           // Señal para el UI: "procesando en background"
                issueDate: new Date(),
            };
        }

        // -------------------------------------------------------
        // FLUJO SÍNCRONO: esperar respuesta HKA (comportamiento existente)
        // -------------------------------------------------------
        const { InvoiceOrchestrator } = await import("@/features/hka/model");

        const config = {
            autoDownloadPDF: false,
            autoDownloadXML: false,
            autoSendEmail: true,
            autoVerifyStatus: true,
        };

        const orchestrator = new InvoiceOrchestrator(config);

        const result = await orchestrator.emitInvoiceWithFullWorkflow(
            invoiceId,
            user.clientId,
            user.id,
            user.email || undefined
        );

        if (!result.success) {
            const errorMsg = result.errors?.[0]?.error?.message || "Error desconocido al emitir fiscalmente";
            throw new Error(errorMsg);
        }

        // Fetch refreshed invoice to get CUFE/QR
        let emittedInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
        let retries = 0;

        while (retries < 5 && (!emittedInvoice?.invoiceNumber || emittedInvoice?.status !== 'EMITTED')) {
            await new Promise(r => setTimeout(r, 500));
            emittedInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
            retries++;
        }

        if (!emittedInvoice) {
            throw new Error("Factura emitida no encontrada");
        }

        // Descontar inventario directamente desde el carrito.
        // El orquestrador (Fase 9) tiene guard de idempotencia; si ya descontamos aquí, salta sin duplicar.
        await deductInventoryFromCart(cart, invoiceId, user.clientId, user.id);

        // Hook Motor síncrono: si fue venta a crédito, generar el cargo
        if (isCreditPayment) {
            await processInvoiceForMotor(invoiceId);
        }

        revalidatePath("/dashboard/pos");
        revalidatePath("/dashboard/inventory");
        revalidatePath("/dashboard/facturas");

        return {
            success: true,
            invoiceId: invoiceId,
            invoiceNumber: emittedInvoice.invoiceNumber || "PENDING",
            cufe: emittedInvoice.cufe,
            authProtocol: emittedInvoice.hkaProtocol,
            qrCode: emittedInvoice.qrCode,
            issueDate: emittedInvoice.issueDate,
            isQueued: false,
        };

    } catch (error: any) {
        console.error("[PROCESS_SALE_ACTION]", error);
        return { success: false, error: error.message || "Error al procesar la venta" };
    }
}

