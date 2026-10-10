import { prisma } from "@/lib/db";
import {
    CreateSupplierInput,
    UpdateSupplierInput,
    SupplierProductInput,
    SupplierEvaluationInput,
    SupplierListFilters,
} from "../types/purchase.types";

export class SupplierRepository {
    // ============================================
    // SUPPLIER CRUD
    // ============================================

    async findById(id: string) {
        return prisma.supplier.findUnique({
            where: { id },
            include: {
                supplierProducts: {
                    include: { product: true },
                    where: { isActive: true },
                },
                evaluations: {
                    orderBy: { periodEnd: "desc" },
                    take: 5,
                },
            },
        });
    }

    async findByCode(clientId: string, code: string) {
        return prisma.supplier.findFirst({
            where: { clientId, code, deletedAt: null },
        });
    }

    async list(clientId: string, filters?: SupplierListFilters) {
        const where: any = {
            clientId,
            deletedAt: null,
        };

        if (filters?.search) {
            where.OR = [
                { name: { contains: filters.search, mode: "insensitive" } },
                { code: { contains: filters.search, mode: "insensitive" } },
                { tradeName: { contains: filters.search, mode: "insensitive" } },
            ];
        }

        if (filters?.tier) {
            where.tier = filters.tier;
        }

        if (filters?.category) {
            where.category = filters.category;
        }

        if (filters?.isActive !== undefined) {
            where.isActive = filters.isActive;
        }

        return prisma.supplier.findMany({
            where,
            orderBy: { name: "asc" },
            include: {
                _count: {
                    select: { purchaseOrders: true, supplierProducts: true },
                },
            },
        });
    }

    async create(clientId: string, input: CreateSupplierInput) {
        return prisma.supplier.create({
            data: {
                clientId,
                code: input.code,
                name: input.name,
                tradeName: input.tradeName,
                ruc: input.ruc,
                dv: input.dv,
                email: input.email,
                phone: input.phone,
                address: input.address,
                city: input.city,
                country: input.country || "PA",
                contactName: input.contactName,
                contactPhone: input.contactPhone,
                contactEmail: input.contactEmail,
                website: input.website,
                paymentTerms: input.paymentTerms,
                creditLimit: input.creditLimit,
                currency: input.currency || "USD",
                bankAccount: input.bankAccount,
                bankName: input.bankName,
                defaultLeadTimeDays: input.defaultLeadTimeDays || 7,
                category: input.category,
                tier: input.tier || "STANDARD",
                certifications: input.certifications || [],
                notes: input.notes,
            },
        });
    }

    async update(input: UpdateSupplierInput) {
        const { id, ...data } = input;
        return prisma.supplier.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return prisma.supplier.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
    }

    // ============================================
    // SUPPLIER PRODUCTS
    // ============================================

    async addProduct(input: SupplierProductInput) {
        // If marking as primary, unmark other primaries for this product
        if (input.isPrimary) {
            await prisma.supplierProduct.updateMany({
                where: { productId: input.productId, isPrimary: true },
                data: { isPrimary: false },
            });
        }

        return prisma.supplierProduct.upsert({
            where: {
                supplierId_productId: {
                    supplierId: input.supplierId,
                    productId: input.productId,
                },
            },
            create: {
                supplierId: input.supplierId,
                productId: input.productId,
                unitPrice: input.unitPrice,
                currency: input.currency || "USD",
                minOrderQty: input.minOrderQty,
                leadTimeDays: input.leadTimeDays,
                supplierSku: input.supplierSku,
                isPrimary: input.isPrimary || false,
            },
            update: {
                unitPrice: input.unitPrice,
                currency: input.currency,
                minOrderQty: input.minOrderQty,
                leadTimeDays: input.leadTimeDays,
                supplierSku: input.supplierSku,
                isPrimary: input.isPrimary,
                isActive: true,
            },
        });
    }

    async removeProduct(supplierId: string, productId: string) {
        return prisma.supplierProduct.update({
            where: {
                supplierId_productId: { supplierId, productId },
            },
            data: { isActive: false },
        });
    }

    async getProductsBySupplier(supplierId: string) {
        return prisma.supplierProduct.findMany({
            where: { supplierId, isActive: true },
            include: { product: true },
        });
    }

    async getSuppliersByProduct(productId: string) {
        return prisma.supplierProduct.findMany({
            where: { productId, isActive: true },
            include: { supplier: true },
            orderBy: { isPrimary: "desc" },
        });
    }

    async getPrimarySupplier(productId: string) {
        return prisma.supplierProduct.findFirst({
            where: { productId, isPrimary: true, isActive: true },
            include: { supplier: true },
        });
    }

    // ============================================
    // SUPPLIER EVALUATIONS
    // ============================================

    async createEvaluation(input: SupplierEvaluationInput) {
        // Calculate overall score (weighted average)
        const overallScore =
            input.onTimeDeliveryRate * 0.3 +
            input.qualityRate * 0.3 +
            input.responseTimeScore * 0.2 +
            input.priceCompetitiveness * 0.2;

        return prisma.supplierEvaluation.create({
            data: {
                supplierId: input.supplierId,
                periodStart: input.periodStart,
                periodEnd: input.periodEnd,
                onTimeDeliveryRate: input.onTimeDeliveryRate,
                qualityRate: input.qualityRate,
                responseTimeScore: input.responseTimeScore,
                priceCompetitiveness: input.priceCompetitiveness,
                overallScore,
                notes: input.notes,
                evaluatedBy: input.evaluatedBy,
            },
        });
    }

    async getEvaluationHistory(supplierId: string, limit = 12) {
        return prisma.supplierEvaluation.findMany({
            where: { supplierId },
            orderBy: { periodEnd: "desc" },
            take: limit,
        });
    }

    async getLatestEvaluation(supplierId: string) {
        return prisma.supplierEvaluation.findFirst({
            where: { supplierId },
            orderBy: { periodEnd: "desc" },
        });
    }

    // ============================================
    // STATISTICS
    // ============================================

    async getSupplierStats(clientId: string) {
        const [total, active, byTier] = await Promise.all([
            prisma.supplier.count({ where: { clientId, deletedAt: null } }),
            prisma.supplier.count({
                where: { clientId, deletedAt: null, isActive: true },
            }),
            prisma.supplier.groupBy({
                by: ["tier"],
                where: { clientId, deletedAt: null, isActive: true },
                _count: true,
            }),
        ]);

        return {
            total,
            active,
            inactive: total - active,
            byTier: byTier.reduce(
                (acc, item) => {
                    acc[item.tier] = item._count;
                    return acc;
                },
                {} as Record<string, number>
            ),
        };
    }
}
