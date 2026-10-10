import { prisma } from "@/lib/db";
import { PurchaseOrderRepository } from "../repositories/purchase-order.repository";
import { GoodsReceiptRepository } from "../repositories/goods-receipt.repository";
import { SupplierRepository } from "../repositories/supplier.repository";
import {
    CreatePurchaseOrderInput,
    UpdatePurchaseOrderStatusInput,
    PurchaseOrderListFilters,
    CreateGoodsReceiptInput,
    ReorderSuggestion,
} from "../types/purchase.types";

export class PurchaseOrderService {
    private poRepository: PurchaseOrderRepository;
    private grRepository: GoodsReceiptRepository;
    private supplierRepository: SupplierRepository;

    constructor() {
        this.poRepository = new PurchaseOrderRepository();
        this.grRepository = new GoodsReceiptRepository();
        this.supplierRepository = new SupplierRepository();
    }

    // ============================================
    // PURCHASE ORDER MANAGEMENT
    // ============================================

    async createPurchaseOrder(
        clientId: string,
        userId: string,
        input: CreatePurchaseOrderInput
    ) {
        // Verify supplier
        const supplier = await this.supplierRepository.findById(input.supplierId);
        if (!supplier || supplier.clientId !== clientId) {
            throw new Error("Proveedor no autorizado");
        }

        if (!supplier.isActive) {
            throw new Error("No se pueden crear órdenes para proveedores inactivos");
        }

        return this.poRepository.create(clientId, userId, input);
    }

    async getPurchaseOrder(clientId: string, poId: string) {
        const po = await this.poRepository.findById(poId);
        if (!po || po.clientId !== clientId) {
            throw new Error("Orden de compra no encontrada");
        }
        return po;
    }

    async listPurchaseOrders(clientId: string, filters?: PurchaseOrderListFilters) {
        return this.poRepository.list(clientId, filters);
    }

    async sendPurchaseOrder(clientId: string, poId: string) {
        const po = await this.poRepository.findById(poId);
        if (!po || po.clientId !== clientId) {
            throw new Error("Orden de compra no encontrada");
        }

        if (po.status !== "DRAFT") {
            throw new Error("Solo se pueden enviar órdenes en estado BORRADOR");
        }

        return this.poRepository.updateStatus({
            purchaseOrderId: poId,
            status: "SENT",
        });
    }

    async confirmPurchaseOrder(clientId: string, poId: string, approvedBy: string) {
        const po = await this.poRepository.findById(poId);
        if (!po || po.clientId !== clientId) {
            throw new Error("Orden de compra no encontrada");
        }

        if (po.status !== "SENT") {
            throw new Error("Solo se pueden confirmar órdenes enviadas");
        }

        await prisma.purchaseOrder.update({
            where: { id: poId },
            data: { approvedBy, approvedAt: new Date() },
        });

        return this.poRepository.updateStatus({
            purchaseOrderId: poId,
            status: "CONFIRMED",
        });
    }

    async cancelPurchaseOrder(clientId: string, poId: string, reason: string) {
        const po = await this.poRepository.findById(poId);
        if (!po || po.clientId !== clientId) {
            throw new Error("Orden de compra no encontrada");
        }

        const nonCancellableStates = ["RECEIVED", "CLOSED", "CANCELLED"];
        if (nonCancellableStates.includes(po.status)) {
            throw new Error("No se puede cancelar esta orden");
        }

        return this.poRepository.updateStatus({
            purchaseOrderId: poId,
            status: "CANCELLED",
            reason,
        });
    }

    async closePurchaseOrder(clientId: string, poId: string) {
        const po = await this.poRepository.findById(poId);
        if (!po || po.clientId !== clientId) {
            throw new Error("Orden de compra no encontrada");
        }

        if (po.status !== "RECEIVED") {
            throw new Error("Solo se pueden cerrar órdenes completamente recibidas");
        }

        return this.poRepository.updateStatus({
            purchaseOrderId: poId,
            status: "CLOSED",
        });
    }

    // ============================================
    // GOODS RECEIPT
    // ============================================

    async receiveGoods(
        clientId: string,
        userId: string,
        input: CreateGoodsReceiptInput
    ) {
        // Verify PO exists and is receivable
        const po = await this.poRepository.findById(input.purchaseOrderId);
        if (!po || po.clientId !== clientId) {
            throw new Error("Orden de compra no encontrada");
        }

        const receivableStates = ["CONFIRMED", "PARTIAL_RECEIVED"];
        if (!receivableStates.includes(po.status)) {
            throw new Error("Esta orden no está en estado para recibir mercancía");
        }

        // Create goods receipt
        const receipt = await this.grRepository.create(clientId, userId, input);

        // Update PO item quantities
        for (const item of input.items) {
            if (item.poItemId) {
                await this.poRepository.updateItemReceived(
                    item.poItemId,
                    item.quantityAccepted
                );
            }
        }

        // Check and update PO status
        await this.poRepository.checkAndUpdatePOStatus(input.purchaseOrderId);

        // Create inventory lots for accepted items
        await this.createInventoryLotsFromReceipt(receipt.id, po.supplierId);

        return receipt;
    }

    async getGoodsReceipts(clientId: string, purchaseOrderId?: string) {
        return this.grRepository.list(clientId, purchaseOrderId);
    }

    async getPendingReceipts(clientId: string) {
        return this.grRepository.getPendingPurchaseOrders(clientId);
    }

    // ============================================
    // REORDER SUGGESTIONS
    // ============================================

    async getReorderSuggestions(clientId: string): Promise<ReorderSuggestion[]> {
        // Find products below reorder point
        const products = await prisma.product.findMany({
            where: {
                clientId,
                deletedAt: null,
                isActive: true,
                // Products where current stock <= reorder point
            },
            include: {
                supplierProducts: {
                    where: { isPrimary: true, isActive: true },
                    include: { supplier: true },
                },
            },
        });

        const suggestions: ReorderSuggestion[] = [];

        for (const product of products) {
            const currentStock = Number(product.currentStock);
            const reorderPoint = Number(product.reorderPoint);

            if (currentStock <= reorderPoint) {
                const primarySupplier = product.supplierProducts[0];

                suggestions.push({
                    productId: product.id,
                    productName: product.name,
                    currentStock,
                    reorderPoint,
                    safetyStock: Number(product.safetyStock),
                    suggestedQuantity: this.calculateSuggestedQuantity(product),
                    eoqQuantity: Number(product.eoqQuantity),
                    avgDailyDemand: Number(product.avgDailyDemand),
                    leadTimeDays: primarySupplier?.leadTimeDays || 7,
                    primarySupplierId: primarySupplier?.supplierId,
                    primarySupplierName: primarySupplier?.supplier.name,
                });
            }
        }

        return suggestions.sort((a, b) => a.currentStock - a.reorderPoint - (b.currentStock - b.reorderPoint));
    }

    async getStats(clientId: string) {
        return this.poRepository.getStats(clientId);
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private calculateSuggestedQuantity(product: any): number {
        const eoq = Number(product.eoqQuantity);
        const maxStock = Number(product.maxStock);
        const currentStock = Number(product.currentStock);

        if (eoq > 0) {
            return eoq;
        }

        if (maxStock > 0) {
            return maxStock - currentStock;
        }

        // Default: order enough for 30 days
        const avgDailyDemand = Number(product.avgDailyDemand) || 1;
        return Math.ceil(avgDailyDemand * 30);
    }

    private async createInventoryLotsFromReceipt(receiptId: string, supplierId: string) {
        const receipt = await this.grRepository.findById(receiptId);
        if (!receipt) return;

        for (const item of receipt.items) {
            if (item.productId && Number(item.quantityAccepted) > 0 && item.qualityStatus === "ACCEPTED") {
                // Create inventory lot
                await prisma.inventoryLot.create({
                    data: {
                        productId: item.productId,
                        batchNumber: item.batchNumber,
                        quantity: item.quantityAccepted,
                        initialQuantity: item.quantityAccepted,
                        purchasePrice: item.unitCost,
                        supplierId,
                        expiryDate: item.expiryDate,
                        goodsReceiptItemId: item.id,
                        unitCost: item.unitCost,
                        totalCost: Number(item.quantityAccepted) * Number(item.unitCost),
                        notes: `Received from GR-${receipt.receiptNumber}`,
                    },
                });

                // Create inventory transaction
                await prisma.inventoryTransaction.create({
                    data: {
                        productId: item.productId,
                        type: "ENTRY",
                        quantity: item.quantityAccepted,
                        reason: "Recepción de mercancía",
                        reference: receipt.receiptNumber,
                    },
                });

                // Update product stock
                await prisma.product.update({
                    where: { id: item.productId },
                    data: {
                        currentStock: { increment: Number(item.quantityAccepted) },
                    },
                });
            }
        }
    }
}
