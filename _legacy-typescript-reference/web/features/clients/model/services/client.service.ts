/**
 * Clients Service
 */

import { ClientRepository } from '../repositories/client.repository';
import type { CreateClientDTO, ValidateClientResult, Client } from '../types/client.types';
import type { ApiResponse } from '@shared/lib/types';

export class ClientService {
    constructor(
        private clientRepo: ClientRepository = new ClientRepository()
    ) { }

    async createClient(
        data: CreateClientDTO,
        organizationId: string
    ): Promise<ApiResponse<Client>> {
        try {
            // Verificar si ya existe
            const existing = await this.clientRepo.findByRUC(data.ruc, organizationId);
            if (existing) {
                return { success: false, error: 'Cliente ya existe' };
            }

            // Validar con HKA (opcional aquí, se puede hacer después)
            // const hkaValidation = await this.validateWithHKA(data.ruc, data.tipoRuc);

            // Crear cliente
            const client = await this.clientRepo.create({
                ...data,
                organizationId,
            });

            return { success: true, data: client };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error al crear cliente',
            };
        }
    }

    async validateClientRUC(
        ruc: string,
        tipoRuc: '1' | '2'
    ): Promise<ValidateClientResult> {
        try {
            // Aquí llamarías al servicio HKA para validar
            // const hkaResult = await validateRUC(clientId, { ruc, tipoRuc });

            return {
                valid: true,
                dv: '00', // Placeholder
            };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Error validando RUC',
            };
        }
    }
}
