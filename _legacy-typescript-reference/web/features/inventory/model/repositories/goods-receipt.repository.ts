import { prisma } from "@/lib/db";
import {
    CreateGoodsReceiptInput,
    CompleteInspectionInput,
} from "../types/purchase.types";

export class GoodsReceiptRepository {
    // ============================================
    // GOODS RECEIPT CRUD
    // ============================================

    async findById(id: string) {
        return prisma.goodsReceipt.findUnique({
            where: { id },
            include: {
                purchaseOrder: {
                    include: { supplier: true, items: true },
                },
                items: true,
            },
        });
    }

    async list(clientId: string, purchaseOrderId?: string) {
        const where: any = { clientId };

        if (purchaseOrderId) {
            where.purchaseOrderId = purchaseOrderId;
        }

        return prisma.goodsReceipt.findMany({
            where,
            include: {
                purchaseOrder: { select: { poNumber: true, supplier: { select: { name: true } } } },
                _count: { select: { items: true } },
            },
            orderBy: { receivedDate: "desc" },
        });
    }

    async create(clientId: string, receivedBy: string, input: CreateGoodsReceiptInput) {
        // Generate receipt number
        const receiptNumber = await this.generateReceiptNumber(clientId);

        return prisma.goodsReceipt.create({
            data: {
                clientId,
                receiptNumber,
                purchaseOrderId: input.purchaseOrderId,
                receivedBy,
                deliveryNote: input.deliveryNote,
                invoiceNumber: input.invoiceNumber,
                warehouseLocation: input.warehouseLocation,
                notes: input.notes,
                items: {
                    create: input.items.map((item) => ({
                        poItemId: item.poItemId,
                        productId: item.productId,
                        quantityReceived: item.quantityReceived,
                        quantityAccepted: item.quantityAccepted,
                        quantityRejected: item.quantityRejected || 0,
                        batchNumber: item.batchNumber,
                        serialNumber: item.serialNumber,
                        expiryDate: item.expiryDate,
                        qualityStatus: item.qualityStatus || "PENDING",
                        rejectionReason: item.rejectionReason,
                        unitCost: item.unitCost,
                        notes: item.notes,
                    })),
                },
            },
            include: {
                purchaseOrder: true,
                items: true,
            },
        });
    }

    async completeInspection(input: CompleteInspectionInput) {
        return prisma.goodsReceipt.update({
            where: { id: input.goodsReceiptId },
            data: {
                inspectionStatus: input.inspectionStatus,
                inspectionNotes: input.inspectionNotes,
                inspectedAt: new Date(),
            },
        });
    }

    async updateItemQuality(
        itemId: string,
        qualityStatus: string,
        rejectionReason?: string
    ) {
        return prisma.goodsReceiptItem.update({
            where: { id: itemId },
            data: {
                qualityStatus,
                rejectionReason,
            },
        });
    }

    // ============================================
    // PENDING RECEIPTS
    // ============================================

    async getPendingPurchaseOrders(clientId: string) {
        return prisma.purchaseOrder.findMany({
            where: {
                clientId,
                status: { in: ["CONFIRMED", "PARTIAL_RECEIVED"] },
            },
            include: {
                supplier: { select: { name: true } },
                items: {
                    where: { quantityPending: { gt: 0 } },
                },
            },
            orderBy: { expectedDate: "asc" },
        });
    }

    // ============================================
    // HELPERS
    // ============================================

    private async generateReceiptNumber(clientId: string): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = `GR-${year}-`;

        const lastReceipt = await prisma.goodsReceipt.findFirst({
            where: {
                clientId,
                receiptNumber: { startsWith: prefix },
            },
            orderBy: { receiptNumber: "desc" },
        });

        let sequence = 1;
        if (lastReceipt) {
            const lastSequence = parseInt(lastReceipt.receiptNumber.replace(prefix, ""), 10);
            sequence = lastSequence + 1;
        }

        return `${prefix}${sequence.toString().padStart(5, "0")}`;
    }
}
