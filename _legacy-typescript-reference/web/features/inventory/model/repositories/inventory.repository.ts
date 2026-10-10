import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { CreateProductInput, UpdateProductInput, CreateLotInput, CreateTransactionInput } from "../types/inventory.types";
import { ConcurrencyConflictError, InsufficientStockError } from "@/shared/errors/inventory-errors";

interface ReserveStockResult {
    success: boolean;
    previousStock: Decimal;
    newStock: Decimal;
    version: number;
    movementId: string;
}

export class InventoryRepository {
    async findProductById(id: string) {
        return prisma.product.findUnique({
            where: { id },
            include: {
                lots: {
                    where: { isActive: true },
                    orderBy: { entryDate: 'asc' }
                }
            }
        });
    }

    async findProductBySku(clientId: string, sku: string) {
        return prisma.product.findFirst({
            where: { clientId, sku, deletedAt: null }
        });
    }

    async findProductByBarcode(clientId: string, barcode: string) {
        return prisma.product.findFirst({
            where: { clientId, barcode, deletedAt: null }
        });
    }

    async listProducts(clientId: string) {
        return prisma.product.findMany({
            where: { clientId, deletedAt: null },
            orderBy: { name: 'asc' }
        });
    }

    async createProduct(clientId: string, input: CreateProductInput) {
        return prisma.product.create({
            data: {
                ...input,
                clientId,
                currentStock: 0,
            }
        });
    }

    async updateProduct(input: UpdateProductInput) {
        const { id, ...data } = input;
        return prisma.product.update({
            where: { id },
            data
        });
    }

    async deleteProduct(id: string) {
        return prisma.product.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }

    async createLot(input: CreateLotInput) {
        return prisma.inventoryLot.create({
            data: {
                ...input,
                initialQuantity: input.quantity,
            }
        });
    }

    /**
     * Reserve stock with Optimistic Concurrency Control.
     * Uses version checking to prevent race conditions.
     * 
     * @throws ConcurrencyConflictError if version mismatch
     * @throws InsufficientStockError if not enough stock
     */
    async reserveStockWithOCC(
        productId: string,
        quantity: number,
        referenceId: string,
        referenceType: string,
        userId?: string
    ): Promise<ReserveStockResult> {
        return prisma.$transaction(async (tx) => {
            // 1. Read current state
            const product = await tx.product.findUniqueOrThrow({
                where: { id: productId }
            });

            const quantityDecimal = new Decimal(quantity);
            const newStock = product.currentStock.minus(quantityDecimal);

            // 2. Validate business rules - no negative stock allowed
            if (newStock.lessThan(0)) {
                throw new InsufficientStockError(
                    `Stock insuficiente para ${product.name}. Disponible: ${product.currentStock.toNumber()}, Solicitado: ${quantity}`,
                    {
                        productId,
                        requested: quantity,
                        available: product.currentStock.toNumber()
                    }
                );
            }

            // 3. Optimistic update with version check
            const updateResult = await tx.product.updateMany({
                where: {
                    id: productId,
                    version: product.version // Only update if version matches
                },
                data: {
                    currentStock: newStock,
                    version: { increment: 1 }
                }
            });

            if (updateResult.count === 0) {
                throw new ConcurrencyConflictError(
                    `Conflicto de concurrencia: ${product.name} fue modificado por otra transacción. Intente de nuevo.`,
                    {
                        productId,
                        expectedVersion: product.version
                    }
                );
            }

            // 4. Record stock movement for audit
            const movement = await tx.stockMovement.create({
                data: {
                    productId,
                    type: 'SALE',
                    quantity: quantityDecimal.negated(), // Negative for deduction
                    previousStock: product.currentStock,
                    newStock,
                    productVersion: product.version,
                    referenceId,
                    referenceType,
                    createdById: userId
                }
            });

            return {
                success: true,
                previousStock: product.currentStock,
                newStock,
                version: product.version + 1,
                movementId: movement.id
            };
        });
    }

    /**
     * Add stock with OCC (for purchases, returns, adjustments).
     */
    async addStockWithOCC(
        productId: string,
        quantity: number,
        type: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT',
        referenceId?: string,
        referenceType?: string,
        userId?: string,
        notes?: string
    ): Promise<ReserveStockResult> {
        return prisma.$transaction(async (tx) => {
            const product = await tx.product.findUniqueOrThrow({
                where: { id: productId }
            });

            const quantityDecimal = new Decimal(quantity);
            const newStock = product.currentStock.plus(quantityDecimal);

            // Optimistic update with version check
            const updateResult = await tx.product.updateMany({
                where: {
                    id: productId,
                    version: product.version
                },
                data: {
                    currentStock: newStock,
                    version: { increment: 1 }
                }
            });

            if (updateResult.count === 0) {
                throw new ConcurrencyConflictError(
                    `Conflicto de concurrencia: ${product.name} fue modificado por otra transacción.`,
                    { productId, expectedVersion: product.version }
                );
            }

            const movement = await tx.stockMovement.create({
                data: {
                    productId,
                    type,
                    quantity: quantityDecimal,
                    previousStock: product.currentStock,
                    newStock,
                    productVersion: product.version,
                    referenceId,
                    referenceType,
                    notes,
                    createdById: userId
                }
            });

            return {
                success: true,
                previousStock: product.currentStock,
                newStock,
                version: product.version + 1,
                movementId: movement.id
            };
        });
    }

    async createTransaction(input: CreateTransactionInput) {
        return prisma.$transaction(async (tx) => {
            // Create the transaction record
            const transaction = await tx.inventoryTransaction.create({
                data: input
            });

            // Update product current stock
            const adjustment = input.type === 'ENTRY' ? input.quantity : -input.quantity;

            // Read product first for OCC
            const product = await tx.product.findUniqueOrThrow({
                where: { id: input.productId }
            });

            const newStock = product.currentStock.plus(new Decimal(adjustment));

            // Validate - no negative stock
            if (newStock.lessThan(0)) {
                throw new InsufficientStockError(
                    `Stock insuficiente. Disponible: ${product.currentStock.toNumber()}`,
                    {
                        productId: input.productId,
                        requested: Math.abs(adjustment),
                        available: product.currentStock.toNumber()
                    }
                );
            }

            // Update with version check
            const updateResult = await tx.product.updateMany({
                where: { id: input.productId, version: product.version },
                data: {
                    currentStock: newStock,
                    version: { increment: 1 }
                }
            });

            if (updateResult.count === 0) {
                throw new ConcurrencyConflictError(
                    `Producto modificado por otra transacción`,
                    { productId: input.productId, expectedVersion: product.version }
                );
            }

            // Record stock movement for audit
            await tx.stockMovement.create({
                data: {
                    productId: input.productId,
                    type: input.type === 'ENTRY' ? 'PURCHASE' : input.type === 'EXIT' ? 'SALE' : 'ADJUSTMENT',
                    quantity: new Decimal(adjustment),
                    previousStock: product.currentStock,
                    newStock,
                    productVersion: product.version,
                    referenceId: input.invoiceId || input.lotId,
                    referenceType: input.invoiceId ? 'Invoice' : input.lotId ? 'Lot' : 'Manual',
                    notes: input.reason,
                    createdById: input.userId
                }
            });

            // If it's a lot-based entry or exit, update the lot specific stock
            if (input.lotId) {
                await tx.inventoryLot.update({
                    where: { id: input.lotId },
                    data: {
                        quantity: {
                            increment: adjustment
                        }
                    }
                });
            }

            return transaction;
        });
    }

    async getStats(clientId: string) {
        const [totalProducts, outOfStock, lowStock, totalValueResult] = await Promise.all([
            prisma.product.count({ where: { clientId, deletedAt: null } }),
            prisma.product.count({ where: { clientId, deletedAt: null, currentStock: { lte: 0 } } }),
            prisma.product.count({
                where: {
                    clientId,
                    deletedAt: null,
                    currentStock: { gt: 0 },
                }
            }),
            prisma.$queryRaw<any[]>`
                SELECT SUM("currentStock" * "purchasePrice") as total_value
                FROM products
                WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
            `
        ]);

        const lowStockCountRes = await prisma.$queryRaw<any[]>`
            SELECT COUNT(*)::int as count
            FROM products
            WHERE "clientId" = ${clientId} 
            AND "deletedAt" IS NULL 
            AND "currentStock" > 0 
            AND "currentStock" <= "minStock"
        `;

        return {
            totalProducts,
            lowStockProducts: lowStockCountRes[0]?.count || 0,
            outOfStockProducts: outOfStock,
            totalInventoryValue: Number(totalValueResult[0]?.total_value || 0) || 0
        };
    }
}
