/**
 * Invoice Service
 * LÓGICA DE NEGOCIO PURA - NO conoce Express/Next.js
 */

import { InvoiceRepository } from '../repositories/invoice.repository';
import type { ApiResponse } from '@shared/lib/types';
import { InventoryService } from '@/features/inventory/model/services/inventory.service';
import { prisma } from '@core/database';
import { CreateInvoiceDTO, ProcessInvoiceResult, Invoice, InvoiceItem } from '../types/invoice.types';

export class InvoiceService {
    constructor(
        private invoiceRepo: InvoiceRepository = new InvoiceRepository(),
        private inventoryService: InventoryService = new InventoryService()
    ) { }

    /**
     * Crear factura (sin procesarla aún)
     */
    async createDraft(data: CreateInvoiceDTO): Promise<ApiResponse<Invoice>> {
        try {
            // Validaciones de negocio
            await this.validateInvoiceData(data);

            // Crear en BD
            const invoice = await this.invoiceRepo.create(data);

            return {
                success: true,
                data: invoice,
                message: 'Factura creada como borrador',
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido',
            };
        }
    }

    /**
     * Procesar factura con HKA
     */
    async processInvoice(invoiceId: string): Promise<ApiResponse<ProcessInvoiceResult>> {
        try {
            // 1. Obtener factura
            const invoice = await this.invoiceRepo.findById(invoiceId);

            if (!invoice) {
                throw new Error('Factura no encontrada');
            }

            if (invoice.status !== 'DRAFT') {
                throw new Error('Solo se pueden procesar facturas en borrador');
            }

            // 2. Marcar como procesando
            await this.invoiceRepo.updateStatus(invoiceId, 'PROCESSING');

            // 3. Enviar a HKA (aquí usarías el servicio HKA)
            // Ejemplo: const hkaResult = await this.hkaService.enviar(invoice);

            // 4. Simular respuesta HKA (reemplazar con servicio real)
            const hkaResult = await this.simulateHKAProcessing(invoice);

            // 5. Guardar datos de HKA
            const updatedInvoice = await this.invoiceRepo.saveHKAData(invoiceId, {
                cufe: hkaResult.cufe,
                qrCode: hkaResult.qrCode,
                pdfUrl: hkaResult.pdfUrl,
                xmlUrl: hkaResult.xmlUrl,
            });

            // 6. Inventario: Descontar stock si está habilitado
            await this.handleInventoryDeduction(updatedInvoice);

            return {
                success: true,
                data: {
                    invoice: updatedInvoice,
                    cufe: hkaResult.cufe,
                    qrCode: hkaResult.qrCode,
                    approved: true,
                },
                message: 'Factura procesada exitosamente',
            };
        } catch (error) {
            // Marcar como error si falla
            await this.invoiceRepo.updateStatus(invoiceId, 'REJECTED');

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error al procesar factura',
            };
        }
    }

    /**
     * Obtener factura por ID
     */
    async getById(id: string): Promise<ApiResponse<Invoice>> {
        try {
            const invoice = await this.invoiceRepo.findById(id);

            if (!invoice) {
                return {
                    success: false,
                    error: 'Factura no encontrada',
                };
            }

            return {
                success: true,
                data: invoice,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido',
            };
        }
    }

    // Métodos privados de validación
    private async validateInvoiceData(data: CreateInvoiceDTO): Promise<void> {
        if (!data.items || data.items.length === 0) {
            throw new Error('La factura debe tener al menos un item');
        }

        if (data.items.some((item: InvoiceItem) => item.quantity <= 0)) {
            throw new Error('Las cantidades deben ser mayores a cero');
        }

        if (data.items.some((item: InvoiceItem) => item.unitPrice < 0)) {
            throw new Error('Los precios no pueden ser negativos');
        }
    }

    private async simulateHKAProcessing(invoice: Invoice) {
        // TODO: Reemplazar con integración HKA real
        return {
            cufe: `CUFE-${invoice.id}-${Date.now()}`,
            qrCode: `https://qr.example.com/${invoice.id}`,
            pdfUrl: `https://storage.example.com/pdf/${invoice.id}.pdf`,
            xmlUrl: `https://storage.example.com/xml/${invoice.id}.xml`,
        };
    }

    private async handleInventoryDeduction(invoice: Invoice) {
        console.log(`[INVENTORY_SYNC] Starting deduction for Invoice ${invoice.id} (${invoice.invoiceNumber || 'DRAFT'})`);

        try {
            // 1. Verificamos si el cliente tiene inventario habilitado
            const client = await prisma.client.findUnique({
                where: { id: invoice.clientId },
                select: { id: true, inventoryEnabled: true, name: true }
            });

            if (!client) {
                console.warn(`[INVENTORY_SYNC] Client ${invoice.clientId} not found. Skipping.`);
                return;
            }

            if (!client.inventoryEnabled) {
                console.log(`[INVENTORY_SYNC] Inventory disabled for client ${client.name}. Skipping.`);
                return;
            }

            // 2. Idempotency check: Have we already deducted stock for this invoice?
            const existingMovement = await prisma.stockMovement.findFirst({
                where: {
                    referenceId: invoice.id,
                    type: 'SALE'
                }
            });

            if (existingMovement) {
                console.log(`[INVENTORY_SYNC] Stock already deducted for invoice ${invoice.id}. Skipping to prevent double deduction.`);
                return;
            }

            // 3. Iteramos sobre los ítems de la factura
            // Cast: productId exists in DB but Prisma client types may not reflect it yet
            const dbItems = await prisma.invoiceItem.findMany({
                where: { invoiceId: invoice.id }
            });

            let items: InvoiceItem[] = dbItems.map(item => ({
                description: item.description,
                quantity: Number(item.quantity) || 0,
                unitPrice: Number(item.unitPrice) || 0,
                taxRate: Number(item.taxRate) || 0,
                taxAmount: item.taxAmount ? Number(item.taxAmount) : undefined,
                subtotal: item.subtotal ? Number(item.subtotal) : undefined,
                total: item.total ? Number(item.total) : undefined,
                discount: item.discount ? Number(item.discount) : undefined,
                code: item.code || undefined,
                unit: item.unit || undefined,
                cpbsCode: item.cpbsCode,
                cpbsUnit: item.cpbsUnit,
                productId: item.productId,
            }));

            // CRITICAL FIX: DRAFT manual invoices store their items as JSON in notes, not in DB
            if (items.length === 0 && invoice.notes) {
                try {
                    const notesData = JSON.parse(invoice.notes);
                    const hkaItems = notesData.documentoCompleto?.listaItems;
                    if (Array.isArray(hkaItems) && hkaItems.length > 0) {
                        console.log(`[INVENTORY_SYNC] Found 0 DB items. Extracted ${hkaItems.length} items from DRAFT notes.`);
                        // Map back to expected structure
                        items = hkaItems.map((hi: { _productId?: string, codigo: string, descripcion: string, cantidad: string | number }) => ({
                            productId: hi._productId,
                            code: hi.codigo,
                            description: hi.descripcion,
                            quantity: Number(hi.cantidad) || 1,
                            unitPrice: 0, // Fallback value
                            taxRate: 0    // Fallback value
                        }));
                    }
                } catch {
                    console.warn(`[INVENTORY_SYNC] Failed to parse invoice notes for items fallback`);
                }
            }

            console.log(`[INVENTORY_SYNC] Processing ${items.length} items for deduction.`);

            for (const item of items) {
                // Strategy: prefer productId (direct FK) over SKU lookup
                let product = null;

                // 1. Direct lookup by productId (most reliable — set when user picks from inventory)
                if (item.productId) {
                    product = await prisma.product.findUnique({
                        where: { id: item.productId }
                    });
                    if (product) {
                        console.log(`[INVENTORY_SYNC] Matched item "${item.description}" by productId: ${product.name}`);
                    }
                }

                // 2. Fallback: lookup by SKU/code (for items without productId but with real SKU)
                if (!product && item.code && item.code !== 'GEN-01') {
                    product = await prisma.product.findFirst({
                        where: {
                            clientId: invoice.clientId,
                            sku: item.code,
                            deletedAt: null
                        }
                    });
                    if (product) {
                        console.log(`[INVENTORY_SYNC] Matched item "${item.description}" by SKU: ${item.code}`);
                    }
                }

                if (!product) {
                    console.warn(`[INVENTORY_SYNC] Item "${item.description}" has no linked product (no productId, no matching SKU). Skipping.`);
                    continue;
                }

                console.log(`[INVENTORY_SYNC] Deducting ${item.quantity} units of ${product.name} (ID: ${product.id})`);

                try {
                    await this.inventoryService.registerSale(
                        invoice.clientId,
                        product.id,
                        Number(item.quantity),
                        invoice.id,
                        invoice.createdBy
                    );
                    console.log(`[INVENTORY_SYNC] Successfully deducted ${item.quantity} units of ${product.name}`);
                } catch (deductionError: unknown) {
                    const message = deductionError instanceof Error ? deductionError.message : 'Error desconocido';
                    console.error(`[INVENTORY_SYNC] Failed to deduct product ${product.id}:`, message);
                    // Flag for manual review but don't block the invoice flow
                }
            }

            console.log(`[INVENTORY_SYNC] Completed inventory sync for Invoice ${invoice.id}`);

        } catch (error) {
            console.error('[INVENTORY_SYNC] Critical error during inventory sync:', error);
            // No bloqueamos el flujo principal de la factura
        }
    }

    /**
     * Handle inventory deduction for internal invoices
     * Public method that can be called from process-sale.action.ts
     */
    async handleInventoryDeductionForInternal(invoiceId: string) {
        try {
            // Get invoice with items
            const invoice = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                include: { items: true }
            });

            if (!invoice) {
                throw new Error('Invoice not found');
            }

            // Reuse existing inventory deduction logic
            await this.handleInventoryDeduction(invoice);
        } catch (error) {
            console.error('Error deducting inventory for internal invoice:', error);
            // Don't block the sale if inventory fails, just log it
        }
    }
}
