// NOTA: no importar 'jest' desde @jest/globals — rompe el hoisting de jest.mock con next/jest (SWC). Se usan los globals inyectados.

// Mock database MUST be before imports that use it
jest.mock('@core/database', () => ({
  prismaServer: {
    $transaction: jest.fn(),
    deliveryOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    deliveryOrderStatusHistory: {
      create: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
    },
  },
}));

import { prismaServer as prisma } from '@core/database';
import { createFromInvoice, updateOrderStatus } from '@/features/logistics/model/services/delivery-order.service';

const mockedPrisma = prisma as unknown as {
    $transaction: jest.MockedFunction<any>;
    deliveryOrder: {
        findFirst: jest.MockedFunction<any>;
        findMany: jest.MockedFunction<any>;
        create: jest.MockedFunction<any>;
        updateMany: jest.MockedFunction<any>;
    };
    deliveryOrderStatusHistory: {
        create: jest.MockedFunction<any>;
    };
    invoice: {
        findFirst: jest.MockedFunction<any>;
    };
};

describe('DeliveryOrderService', () => {
    const clientId = 'test-client-id';
    const userId = 'test-user-id';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createFromInvoice', () => {
        it('should successfully create a delivery order from an invoice (happy path)', async () => {
            const invoiceId = 'invoice-123';
            const mockInvoice = {
                id: invoiceId,
                clientId,
                invoiceNumber: 'FAC-001',
                subtotal: 100,
                taxAmount: 7,
                total: 107,
                customer: { name: 'John Doe' },
                items: [
                    {
                        productId: 'prod-1',
                        description: 'Product 1',
                        quantity: 2,
                        unitPrice: 50,
                        taxRate: 0.07,
                        taxAmount: 3.5,
                        lineTotal: 53.5,
                    }
                ]
            };

            const input = { invoiceId };

            // Mock invoice lookup
            mockedPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);

            // Mock transaction and order code generation
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mockTx: any = {
                deliveryOrder: {
                    // @ts-expect-error Mocking jest return value
                    findFirst: jest.fn().mockResolvedValue(null),
                    // @ts-expect-error Mocking jest return value
                    create: jest.fn().mockResolvedValue({ id: 'order-789', code: 'OE-2026-000001' }),
                },
                client: {
                    // @ts-expect-error Mocking jest return value
                    findFirst: jest.fn().mockResolvedValue({ logisticsSecret: 'test-secret', name: 'Test' }),
                },
                deliveryEvent: {
                    // @ts-expect-error Mocking jest return value
                    create: jest.fn().mockResolvedValue({}),
                },
            };

            mockedPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
                return callback(mockTx);
            });

            const result = await createFromInvoice(clientId, userId, input);

            expect(result).toEqual({ id: 'order-789', code: 'OE-2026-000001' });
            expect(prisma.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: invoiceId, clientId }
            }));
            expect(mockTx.deliveryOrder.create).toHaveBeenCalled();
        });

        it('should throw error if invoice is not found', async () => {
            mockedPrisma.invoice.findFirst.mockResolvedValue(null);

            await expect(createFromInvoice(clientId, userId, { invoiceId: 'invalid' }))
                .rejects.toThrow('Factura no encontrada');
        });
    });

    describe('updateOrderStatus', () => {
        it('should update status and record history', async () => {
            const orderId = 'order-123';
            const currentStatus = 'PENDING';
            const newStatus = 'SHIPPED';

            mockedPrisma.deliveryOrder.findFirst.mockResolvedValue({ status: currentStatus });
            mockedPrisma.$transaction.mockImplementation(async (promises: any[]) => {
                return promises;
            });

            await updateOrderStatus(orderId, clientId, userId, { status: newStatus as any });

            expect(prisma.deliveryOrder.findFirst).toHaveBeenCalled();
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('should throw error if order not found for status update', async () => {
            mockedPrisma.deliveryOrder.findFirst.mockResolvedValue(null);

            await expect(updateOrderStatus('invalid', clientId, userId, { status: 'DELIVERED' as any }))
                .rejects.toThrow('Orden no encontrada');
        });
    });
});
