// NOTA: no importar 'jest' desde @jest/globals — rompe el hoisting de jest.mock con next/jest (SWC). Se usan los globals inyectados.
import { prisma } from '@/lib/db';
import { CartReservationService } from '@/features/pos/services/cart-reservation.service';
import { Decimal } from '@prisma/client/runtime/library';

// Mock prisma
jest.mock('@/lib/db', () => ({
    prisma: {
        product: {
            findUnique: jest.fn(),
        },
        cartReservation: {
            aggregate: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));

const mockPrisma = prisma as unknown as {
    product: { findUnique: jest.Mock };
    cartReservation: {
        aggregate: jest.Mock;
        findFirst: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        updateMany: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
        findMany: jest.Mock;
    };
};

describe('CartReservationService', () => {
    let service: CartReservationService;

    beforeEach(() => {
        service = new CartReservationService();
        jest.clearAllMocks();
    });

    describe('getAvailableStock', () => {
        it('should calculate available stock minus reservations', async () => {
            const mockProduct = { currentStock: new Decimal(100) };
            const mockAggregation = { _sum: { quantity: new Decimal(30) } };

            mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);
            mockPrisma.cartReservation.aggregate.mockResolvedValue(mockAggregation as never);

            const result = await service.getAvailableStock('prod-1');

            expect(result.currentStock.toNumber()).toBe(100);
            expect(result.reservedStock.toNumber()).toBe(30);
            expect(result.availableStock.toNumber()).toBe(70);
        });

        it('should return full stock when no reservations exist', async () => {
            const mockProduct = { currentStock: new Decimal(50) };
            const mockAggregation = { _sum: { quantity: null } };

            mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);
            mockPrisma.cartReservation.aggregate.mockResolvedValue(mockAggregation as never);

            const result = await service.getAvailableStock('prod-1');

            expect(result.availableStock.toNumber()).toBe(50);
            expect(result.reservedStock.toNumber()).toBe(0);
        });

        it('should throw error for non-existent product', async () => {
            mockPrisma.product.findUnique.mockResolvedValue(null as never);

            await expect(service.getAvailableStock('invalid-id'))
                .rejects.toThrow('Producto no encontrado');
        });
    });

    describe('reserveStock', () => {
        beforeEach(() => {
            // Default mock for getAvailableStock
            mockPrisma.product.findUnique.mockResolvedValue({
                currentStock: new Decimal(100)
            } as never);
            mockPrisma.cartReservation.aggregate.mockResolvedValue({
                _sum: { quantity: new Decimal(0) }
            } as never);
        });

        it('should create new reservation when none exists', async () => {
            mockPrisma.cartReservation.findFirst.mockResolvedValue(null as never);
            mockPrisma.cartReservation.create.mockResolvedValue({
                id: 'res-1',
                quantity: new Decimal(10)
            } as never);

            const result = await service.reserveStock('session-1', 'prod-1', 10);

            expect(result.success).toBe(true);
            expect(result.reservationId).toBe('res-1');
            expect(mockPrisma.cartReservation.create).toHaveBeenCalled();
        });

        it('should update existing reservation', async () => {
            mockPrisma.cartReservation.findFirst.mockResolvedValue({
                id: 'existing-res'
            } as never);
            mockPrisma.cartReservation.update.mockResolvedValue({
                id: 'existing-res',
                quantity: new Decimal(15)
            } as never);

            const result = await service.reserveStock('session-1', 'prod-1', 15);

            expect(result.success).toBe(true);
            expect(result.reservationId).toBe('existing-res');
            expect(mockPrisma.cartReservation.update).toHaveBeenCalled();
        });

        it('should fail when insufficient stock', async () => {
            mockPrisma.cartReservation.aggregate.mockResolvedValue({
                _sum: { quantity: new Decimal(95) }
            } as never);

            const result = await service.reserveStock('session-1', 'prod-1', 10);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Stock insuficiente');
            expect(result.availableStock).toBe(5);
        });
    });

    describe('cleanupExpiredReservations', () => {
        it('should delete expired reservations', async () => {
            mockPrisma.cartReservation.deleteMany.mockResolvedValue({
                count: 5
            } as never);

            const result = await service.cleanupExpiredReservations();

            expect(result).toBe(5);
            expect(mockPrisma.cartReservation.deleteMany).toHaveBeenCalledWith({
                where: {
                    expiresAt: { lt: expect.any(Date) }
                }
            });
        });
    });

    describe('releaseSessionReservations', () => {
        it('should release all reservations for a session', async () => {
            mockPrisma.cartReservation.deleteMany.mockResolvedValue({
                count: 3
            } as never);

            const result = await service.releaseSessionReservations('session-1');

            expect(result).toBe(3);
            expect(mockPrisma.cartReservation.deleteMany).toHaveBeenCalledWith({
                where: { sessionId: 'session-1' }
            });
        });
    });
});
