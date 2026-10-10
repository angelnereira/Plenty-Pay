import { prisma } from "@/lib/db";
import {
    CreatePurchaseOrderInput,
    UpdatePurchaseOrderStatusInput,
    PurchaseOrderListFilters,
    PurchaseOrderStatus,
} from "../types/purchase.types";

export class PurchaseOrderRepository {
    // ============================================
    // PURCHASE ORDER CRUD
    // ============================================

    async findById(id: string) {
        return prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: true,
                requisition: true,
                items: {
                    orderBy: { lineNumber: "asc" },
                },
                goodsReceipts: {
                    include: { items: true },
                    orderBy: { receivedDate: "desc" },
                },
            },
        });
    }

    async findByPoNumber(clientId: string, poNumber: string) {
        return prisma.purchaseOrder.findFirst({
            where: { clientId, poNumber },
        });
    }

    async list(clientId: string, filters?: PurchaseOrderListFilters) {
        const where: any = { clientId };

        if (filters?.search) {
            where.OR = [
                { poNumber: { contains: filters.search, mode: "insensitive" } },
                { supplier: { name: { contains: filters.search, mode: "insensitive" } } },
            ];
        }

        if (filters?.status) {
            where.status = filters.status;
        }

        if (filters?.supplierId) {
            where.supplierId = filters.supplierId;
        }

        if (filters?.fromDate || filters?.toDate) {
            where.orderDate = {};
            if (filters.fromDate) {
                where.orderDate.gte = filters.fromDate;
            }
            if (filters.toDate) {
                where.orderDate.lte = filters.toDate;
            }
        }

        return prisma.purchaseOrder.findMany({
            where,
            include: {
                supplier: { select: { id: true, name: true, code: true } },
                _count: { select: { items: true, goodsReceipts: true } },
            },
            orderBy: { orderDate: "desc" },
        });
    }

    async create(clientId: string, createdBy: string, input: CreatePurchaseOrderInput) {
        // Generate PO number
        const poNumber = await this.generatePoNumber(clientId);

        // Calculate line totals
        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;

        const items = input.items.map((item, index) => {
            const itemSubtotal = item.quantityOrdered * item.unitPrice;
            const itemDiscount = item.discount || 0;
            const itemTaxAmount = (itemSubtotal - itemDiscount) * ((item.taxRate || 0) / 100);
            const itemTotal = itemSubtotal - itemDiscount + itemTaxAmount;

            subtotal += itemSubtotal;
            totalTax += itemTaxAmount;
            totalDiscount += itemDiscount;

            return {
                lineNumber: index + 1,
                productId: item.productId,
                description: item.description,
                unit: item.unit || "UND",
                quantityOrdered: item.quantityOrdered,
                quantityPending: item.quantityOrdered,
                unitPrice: item.unitPrice,
                discount: itemDiscount,
                taxRate: item.taxRate || 0,
                taxAmount: itemTaxAmount,
                subtotal: itemSubtotal,
                total: itemTotal,
                notes: item.notes,
            };
        });

        const total = subtotal - totalDiscount + totalTax;

        return prisma.purchaseOrder.create({
            data: {
                clientId,
                poNumber,
                supplierId: input.supplierId,
                requisitionId: input.requisitionId,
                status: "DRAFT",
                expectedDate: input.expectedDate,
                shippingAddress: input.shippingAddress,
                shippingMethod: input.shippingMethod,
                paymentTerms: input.paymentTerms,
                paymentMethod: input.paymentMethod,
                currency: input.currency || "USD",
                subtotal,
                taxAmount: totalTax,
                discount: totalDiscount,
                total,
                createdBy,
                notes: input.notes,
                internalNotes: input.internalNotes,
                items: {
                    create: items,
                },
            },
            include: {
                supplier: true,
                items: true,
            },
        });
    }

    async updateStatus(input: UpdatePurchaseOrderStatusInput) {
        const updates: any = {
            status: input.status,
        };

        // Set corresponding date based on status
        switch (input.status) {
            case "SENT":
                updates.orderDate = new Date();
                break;
            case "CONFIRMED":
                updates.confirmedDate = new Date();
                break;
            case "RECEIVED":
                updates.deliveryDate = new Date();
                break;
            case "CLOSED":
                updates.closedDate = new Date();
                break;
            case "CANCELLED":
                updates.cancelledDate = new Date();
                updates.cancellationReason = input.reason;
                break;
        }

        return prisma.purchaseOrder.update({
            where: { id: input.purchaseOrderId },
            data: updates,
        });
    }

    async updateItemReceived(itemId: string, quantityReceived: number) {
        const item = await prisma.purchaseOrderItem.findUnique({
            where: { id: itemId },
        });

        if (!item) throw new Error("PO Item not found");

        const newReceivedTotal = Number(item.quantityReceived) + quantityReceived;
        const newPending = Number(item.quantityOrdered) - newReceivedTotal;

        return prisma.purchaseOrderItem.update({
            where: { id: itemId },
            data: {
                quantityReceived: newReceivedTotal,
                quantityPending: Math.max(0, newPending),
            },
        });
    }

    async checkAndUpdatePOStatus(purchaseOrderId: string) {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: purchaseOrderId },
            include: { items: true },
        });

        if (!po) return null;

        const totalOrdered = po.items.reduce(
            (sum, item) => sum + Number(item.quantityOrdered),
            0
        );
        const totalReceived = po.items.reduce(
            (sum, item) => sum + Number(item.quantityReceived),
            0
        );

        let newStatus: PurchaseOrderStatus = po.status as PurchaseOrderStatus;

        if (totalReceived === 0) {
            // No change
        } else if (totalReceived >= totalOrdered) {
            newStatus = "RECEIVED";
        } else if (totalReceived > 0 && totalReceived < totalOrdered) {
            newStatus = "PARTIAL_RECEIVED";
        }

        if (newStatus !== po.status) {
            return this.updateStatus({
                purchaseOrderId,
                status: newStatus,
            });
        }

        return po;
    }

    // ============================================
    // STATISTICS
    // ============================================

    async getStats(clientId: string) {
        const [total, byStatus, thisMonth] = await Promise.all([
            prisma.purchaseOrder.count({ where: { clientId } }),
            prisma.purchaseOrder.groupBy({
                by: ["status"],
                where: { clientId },
                _count: true,
            }),
            prisma.purchaseOrder.aggregate({
                where: {
                    clientId,
                    orderDate: {
                        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                    },
                },
                _sum: { total: true },
                _count: true,
            }),
        ]);

        return {
            total,
            byStatus: byStatus.reduce(
                (acc, item) => {
                    acc[item.status] = item._count;
                    return acc;
                },
                {} as Record<string, number>
            ),
            thisMonth: {
                count: thisMonth._count,
                total: Number(thisMonth._sum.total || 0),
            },
        };
    }

    // ============================================
    // HELPERS
    // ============================================

    private async generatePoNumber(clientId: string): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = `PO-${year}-`;

        const lastPO = await prisma.purchaseOrder.findFirst({
            where: {
                clientId,
                poNumber: { startsWith: prefix },
            },
            orderBy: { poNumber: "desc" },
        });

        let sequence = 1;
        if (lastPO) {
            const lastSequence = parseInt(lastPO.poNumber.replace(prefix, ""), 10);
            sequence = lastSequence + 1;
        }

        return `${prefix}${sequence.toString().padStart(5, "0")}`;
    }
}
