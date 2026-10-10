// NOTA: no importar 'jest' desde @jest/globals — rompe el hoisting de jest.mock con next/jest (SWC). Se usan los globals inyectados.
import { prisma } from '@/lib/db';
import { InventoryRepository } from '@/features/inventory/model/repositories/inventory.repository';
import { ConcurrencyConflictError, InsufficientStockError } from '@/shared/errors/inventory-errors';
import { Decimal } from '@prisma/client/runtime/library';

// Mock prisma with $transaction
jest.mock('@/lib/db', () => ({
    prisma: {
        $transaction: jest.fn(),
        product: {
            findUniqueOrThrow: jest.fn(),
            updateMany: jest.fn(),
        },
        stockMovement: {
            create: jest.fn(),
        },
    },
}));

describe('InventoryRepository - OCC', () => {
    let repository: InventoryRepository;

    beforeEach(() => {
        repository = new InventoryRepository();
        jest.clearAllMocks();
    });

    describe('reserveStockWithOCC', () => {
        it('should successfully reserve stock when version matches', async () => {
            const mockProduct = {
                id: 'prod-1',
                name: 'Test Product',
                currentStock: new Decimal(100),
                version: 1
            };

            const mockTx = {
                product: {
                    findUniqueOrThrow: (jest.fn() as any).mockResolvedValue(mockProduct),
                    updateMany: (jest.fn() as any).mockResolvedValue({ count: 1 }),
                },
                stockMovement: {
                    create: (jest.fn() as any).mockResolvedValue({ id: 'mov-1' }),
                },
            };

            (prisma.$transaction as any).mockImplementation(async (fn: any) => {
                return fn(mockTx);
            });

            const result = await repository.reserveStockWithOCC(
                'prod-1',
                10,
                'sale-1',
                'POSSale'
            );

            expect(result.success).toBe(true);
            expect(result.previousStock.toNumber()).toBe(100);
            expect(result.newStock.toNumber()).toBe(90);
            expect(result.version).toBe(2);
            expect(mockTx.product.updateMany).toHaveBeenCalledWith({
                where: { id: 'prod-1', version: 1 },
                data: { currentStock: expect.any(Decimal), version: { increment: 1 } }
            });
        });

        it('should throw ConcurrencyConflictError when version mismatch', async () => {
            const mockProduct = {
                id: 'prod-1',
                name: 'Test Product',
                currentStock: new Decimal(100),
                version: 1
            };

            const mockTx = {
                product: {
                    findUniqueOrThrow: (jest.fn() as any).mockResolvedValue(mockProduct),
                    updateMany: (jest.fn() as any).mockResolvedValue({ count: 0 }),
                },
                stockMovement: { create: jest.fn() },
            };

            (prisma.$transaction as any).mockImplementation(async (fn: any) => {
                return fn(mockTx);
            });

            await expect(
                repository.reserveStockWithOCC('prod-1', 10, 'sale-1', 'POSSale')
            ).rejects.toThrow(ConcurrencyConflictError);
        });

        it('should throw InsufficientStockError when stock is not enough', async () => {
            const mockProduct = {
                id: 'prod-1',
                name: 'Test Product',
                currentStock: new Decimal(5),
                version: 1
            };

            const mockTx = {
                product: {
                    findUniqueOrThrow: (jest.fn() as any).mockResolvedValue(mockProduct),
                    updateMany: jest.fn(),
                },
                stockMovement: { create: jest.fn() },
            };

            (prisma.$transaction as any).mockImplementation(async (fn: any) => {
                return fn(mockTx);
            });

            await expect(
                repository.reserveStockWithOCC('prod-1', 10, 'sale-1', 'POSSale')
            ).rejects.toThrow(InsufficientStockError);
        });

        it('should record stock movement on successful reservation', async () => {
            const mockProduct = {
                id: 'prod-1',
                name: 'Test Product',
                currentStock: new Decimal(100),
                version: 1
            };

            const mockTx = {
                product: {
                    findUniqueOrThrow: (jest.fn() as any).mockResolvedValue(mockProduct),
                    updateMany: (jest.fn() as any).mockResolvedValue({ count: 1 }),
                },
                stockMovement: {
                    create: (jest.fn() as any).mockResolvedValue({ id: 'mov-1' }),
                },
            };

            (prisma.$transaction as any).mockImplementation(async (fn: any) => {
                return fn(mockTx);
            });

            await repository.reserveStockWithOCC('prod-1', 10, 'sale-1', 'POSSale', 'user-1');

            expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
                data: {
                    productId: 'prod-1',
                    type: 'SALE',
                    quantity: expect.any(Decimal),
                    previousStock: expect.any(Decimal),
                    newStock: expect.any(Decimal),
                    productVersion: 1,
                    referenceId: 'sale-1',
                    referenceType: 'POSSale',
                    createdById: 'user-1'
                }
            });
        });
    });

    describe('addStockWithOCC', () => {
        it('should successfully add stock', async () => {
            const mockProduct = {
                id: 'prod-1',
                name: 'Test Product',
                currentStock: new Decimal(50),
                version: 3
            };

            const mockTx = {
                product: {
                    findUniqueOrThrow: (jest.fn() as any).mockResolvedValue(mockProduct),
                    updateMany: (jest.fn() as any).mockResolvedValue({ count: 1 }),
                },
                stockMovement: {
                    create: (jest.fn() as any).mockResolvedValue({ id: 'mov-1' }),
                },
            };

            (prisma.$transaction as any).mockImplementation(async (fn: any) => {
                return fn(mockTx);
            });

            const result = await repository.addStockWithOCC(
                'prod-1',
                25,
                'PURCHASE',
                'po-1',
                'PurchaseOrder'
            );

            expect(result.success).toBe(true);
            expect(result.newStock.toNumber()).toBe(75);
            expect(result.version).toBe(4);
        });
    });
});
