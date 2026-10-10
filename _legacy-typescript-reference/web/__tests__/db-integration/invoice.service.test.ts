/**
 * Tests de Integración (DB real) - InvoiceService
 *
 * Creación de borradores de factura contra PostgreSQL real:
 * valida reglas de negocio, persistencia de items y totales.
 */

import { InvoiceService } from '@/features/invoicing/model';
import type { CreateInvoiceDTO } from '@/features/invoicing/model';
import { prisma, RUN_ID, assertSafeDatabase, createTestOrg, deleteTestOrg } from './helpers';

describe('InvoiceService (integración DB)', () => {
    const service = new InvoiceService();
    let orgId: string;
    let userId: string;

    function buildDraft(overrides: Partial<CreateInvoiceDTO> = {}): CreateInvoiceDTO {
        return {
            clientId: orgId,
            createdBy: userId,
            clientReferenceId: `ref-${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`,

            issuerRuc: '155596713-2-2015',
            issuerDv: '60',
            issuerName: 'Emisor Test SA',
            issuerAddress: 'Ciudad de Panamá',
            issuerEmail: 'emisor@test.plentypay.local',

            receiverType: 'FINAL_CONSUMER',
            receiverName: 'Consumidor Final',

            documentType: 'FACTURA',
            paymentMethod: 'CASH',

            subtotal: 20.0,
            subtotalAfterDiscount: 20.0,
            itbms: 1.4,
            total: 21.4,

            items: [
                {
                    description: 'Producto Integración',
                    quantity: 2,
                    unitPrice: 10.0,
                    taxRate: 7,
                },
            ],
            ...overrides,
        } as CreateInvoiceDTO;
    }

    beforeAll(async () => {
        assertSafeDatabase();
        orgId = (await createTestOrg('invoicing')).id;
        const user = await prisma.user.create({
            data: {
                email: `invoicer-${RUN_ID}@test.plentypay.local`,
                password: 'hash-no-usado-en-este-test',
                name: 'Facturador Test',
                role: 'CLIENT',
                clientId: orgId,
            },
        });
        userId = user.id;
    });

    afterAll(async () => {
        await deleteTestOrg(orgId);
        await prisma.$disconnect();
    });

    it('crea un borrador de factura con items persistidos', async () => {
        const result = await service.createDraft(buildDraft());

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        const stored = await prisma.invoice.findUnique({
            where: { id: (result.data as any).id },
            include: { items: true },
        });
        expect(stored?.status).toBe('DRAFT');
        expect(stored?.items).toHaveLength(1);
        expect(Number(stored?.items[0].quantity)).toBe(2);
        expect(Number(stored?.total)).toBeCloseTo(21.4, 2);
    });

    it('rechaza factura sin items', async () => {
        const result = await service.createDraft(buildDraft({ items: [] }));

        expect(result.success).toBe(false);
        expect(result.error).toContain('al menos un item');
    });

    it('rechaza cantidades negativas o cero', async () => {
        const result = await service.createDraft(
            buildDraft({
                items: [
                    { description: 'Inválido', quantity: -1, unitPrice: 10, taxRate: 7 },
                ] as any,
            })
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('mayores a cero');
    });

    it('rechaza precios negativos', async () => {
        const result = await service.createDraft(
            buildDraft({
                items: [
                    { description: 'Inválido', quantity: 1, unitPrice: -5, taxRate: 7 },
                ] as any,
            })
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('no pueden ser negativos');
    });
});
