/**
 * Clients Repository
 */

import { prisma } from '@core/database';
import type { Client, CreateClientDTO } from '../types/client.types';

export class ClientRepository {
    async create(data: CreateClientDTO & { organizationId: string }): Promise<Client> {
        const client = await prisma.customer.create({
            data: {
                ruc: data.ruc,
                dv: '', // Se obtiene de HKA
                name: data.name,
                email: data.email,
                phone: data.phone,
                address: data.address || '',
                rucType: data.tipoRuc,
                clientId: data.organizationId,
            },
        });

        return client as unknown as Client;
    }

    async findByRUC(ruc: string, organizationId: string): Promise<Client | null> {
        const client = await prisma.customer.findFirst({
            where: { ruc, clientId: organizationId },
        });

        return client as Client | null;
    }

    async updateDV(id: string, dv: string): Promise<Client> {
        const client = await prisma.customer.update({
            where: { id },
            data: { dv },
        });

        return client as unknown as Client;
    }

    async list(organizationId: string): Promise<Client[]> {
        const clients = await prisma.customer.findMany({
            where: { clientId: organizationId },
            orderBy: { createdAt: 'desc' },
        });

        return clients as unknown as Client[];
    }
}
