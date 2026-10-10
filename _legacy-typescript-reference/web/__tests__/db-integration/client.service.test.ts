/**
 * Tests de Integración (DB real) - ClientService
 *
 * Alta de clientes (Customer) contra PostgreSQL real:
 * verifica creación, detección de RUC duplicado y scoping por organización.
 */

import { ClientService } from '@/features/clients/model';
import type { CreateClientDTO } from '@/features/clients/model';
import { prisma, RUN_ID, assertSafeDatabase, createTestOrg, deleteTestOrg } from './helpers';

describe('ClientService (integración DB)', () => {
    const service = new ClientService();
    let orgId: string;
    let otherOrgId: string;

    const dto: CreateClientDTO = {
        ruc: '155596713-2-2015',
        tipoRuc: '2',
        name: 'Test Company SA',
        email: 'cliente@empresa.test',
    } as CreateClientDTO;

    beforeAll(async () => {
        assertSafeDatabase();
        orgId = (await createTestOrg('clients-a')).id;
        otherOrgId = (await createTestOrg('clients-b')).id;
    });

    afterAll(async () => {
        await deleteTestOrg(orgId);
        await deleteTestOrg(otherOrgId);
        await prisma.$disconnect();
    });

    it('crea un cliente nuevo en la organización', async () => {
        const result = await service.createClient(dto, orgId);

        expect(result.success).toBe(true);
        expect(result.data?.name).toBe(dto.name);

        const stored = await prisma.customer.findFirst({
            where: { ruc: dto.ruc, clientId: orgId },
        });
        expect(stored).not.toBeNull();
        expect(stored?.name).toBe(dto.name);
    });

    it('rechaza RUC duplicado dentro de la misma organización', async () => {
        const result = await service.createClient(dto, orgId);

        expect(result.success).toBe(false);
        expect(result.error).toContain('ya existe');
    });

    it('permite el mismo RUC en OTRA organización (aislamiento multi-tenant)', async () => {
        const result = await service.createClient(dto, otherOrgId);

        expect(result.success).toBe(true);
    });
});
