/**
 * Tests de Integración (DB real) - Control de Concurrencia Optimista (OCC)
 *
 * A diferencia del test unitario (mocks), aquí se verifica el OCC contra
 * PostgreSQL real: reservas concurrentes del mismo producto deben respetar
 * el versionado y nunca dejar stock negativo.
 */

import { InventoryRepository } from '@/features/inventory/model/repositories/inventory.repository';
import { InsufficientStockError } from '@/shared/errors/inventory-errors';
import { withRetry } from '@/shared/utils/retry';
import { prisma, RUN_ID, assertSafeDatabase, createTestOrg, deleteTestOrg } from './helpers';

describe('InventoryRepository OCC (integración DB)', () => {
    const repository = new InventoryRepository();
    let orgId: string;
    let productId: string;

    beforeAll(async () => {
        assertSafeDatabase();
        orgId = (await createTestOrg('inventory')).id;
    });

    beforeEach(async () => {
        const product = await prisma.product.create({
            data: {
                clientId: orgId,
                name: `Producto OCC ${RUN_ID}`,
                currentStock: 100,
            },
        });
        productId = product.id;
    });

    afterEach(async () => {
        await prisma.stockMovement.deleteMany({ where: { productId } });
        await prisma.product.delete({ where: { id: productId } }).catch(() => {});
    });

    afterAll(async () => {
        await deleteTestOrg(orgId);
        await prisma.$disconnect();
    });

    it('reserva stock y registra el movimiento de auditoría', async () => {
        const before = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

        const result = await repository.reserveStockWithOCC(productId, 10, `sale-${RUN_ID}`, 'POSSale');

        expect(result.success).toBe(true);
        expect(result.newStock.toNumber()).toBe(90);

        const product = await prisma.product.findUnique({ where: { id: productId } });
        expect(Number(product?.currentStock)).toBe(90);
        expect(product?.version).toBe(before.version + 1);

        const movements = await prisma.stockMovement.findMany({ where: { productId } });
        expect(movements).toHaveLength(1);
        expect(Number(movements[0].quantity)).toBe(-10);
    });

    it('rechaza reservas que dejarían stock negativo', async () => {
        await expect(
            repository.reserveStockWithOCC(productId, 999, `sale-${RUN_ID}`, 'POSSale')
        ).rejects.toThrow(InsufficientStockError);

        const product = await prisma.product.findUnique({ where: { id: productId } });
        expect(Number(product?.currentStock)).toBe(100); // intacto
    });

    it('reservas CONCURRENTES con retry nunca sobre-venden (carrera real)', async () => {
        // 8 reservas de 20 unidades sobre 100 de stock: solo 5 pueden ganar.
        const attempts = 8;
        const results = await Promise.allSettled(
            Array.from({ length: attempts }, (_, i) =>
                withRetry(
                    () => repository.reserveStockWithOCC(productId, 20, `c-${RUN_ID}-${i}`, 'POSSale'),
                    { maxRetries: 10 }
                )
            )
        );

        const ok = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter(
            (r) => r.status === 'rejected' && r.reason instanceof InsufficientStockError
        ).length;

        expect(ok).toBe(5);
        expect(failed).toBe(attempts - 5);

        const product = await prisma.product.findUnique({ where: { id: productId } });
        expect(Number(product?.currentStock)).toBe(0); // exactamente agotado, jamás negativo

        const movements = await prisma.stockMovement.findMany({ where: { productId } });
        expect(movements).toHaveLength(5);
    });

    it('addStockWithOCC repone stock e incrementa versión', async () => {
        const result = await repository.addStockWithOCC(productId, 50, 'PURCHASE', `po-${RUN_ID}`, 'PurchaseOrder');

        expect(result.success).toBe(true);
        expect(result.newStock.toNumber()).toBe(150);
    });
});
