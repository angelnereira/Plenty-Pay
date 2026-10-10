/**
 * Client Repository
 * 
 * Centralized data access layer for Client entity.
 * Uses Result Pattern for type-safe error handling.
 * 
 * @module lib/features/clients/repositories/organization.repository
 */

import { prisma } from '@core/database';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import {
    Ok,
    Err,
    Result,
    NotFoundError,
    DatabaseError,
    ConfigurationError,
    type AsyncServiceResult,
} from '@shared/lib/result';

// ============================================
// TYPES
// ============================================

/**
 * Client entity with all fields
 */
export interface ClientEntity {
    id: string;
    slug: string;
    name: string;
    ruc: string | null;
    dv: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    website: string | null;
    logo: string | null;

    // HKA Configuration
    hkaEnabled: boolean;
    hkaTokenUser: string | null;
    hkaTokenPassword: string | null;
    hkaEnvironment: string | null;

    // XML/HKA fields
    rucType: string;
    tradeName: string | null;
    commercialName: string | null;
    branchCode: string;
    locationCode: string;
    province: string;
    district: string;
    corregimiento: string;

    // Auto invoice settings
    autoSendToHKA: boolean;
    requireApproval: boolean;
    emailOnCertification: boolean;
    emailOnError: boolean;
    lowFoliosThreshold: number;

    // Limits
    maxUsers: number;
    maxFolios: number | null;

    // Invoice numbering
    lastInvoiceNumber: number;

    // Status
    isActive: boolean;
    suspendedAt: Date | null;
    suspendReason: string | null;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

/**
 * HKA Configuration for a client (decrypted)
 */
export interface ClientHKAConfig {
    hkaEnabled: boolean;
    tokenEmpresa: string;
    tokenPassword: string;
    environment: 'demo' | 'prod';
    branchCode: string;
    locationCode: string;
    province: string;
    district: string;
    corregimiento: string;
}

/**
 * Update HKA config input
 */
export interface UpdateHKAConfigInput {
    hkaEnabled?: boolean;
    hkaTokenUser?: string;
    hkaTokenPassword?: string;
    hkaEnvironment?: 'demo' | 'prod';
    branchCode?: string;
    locationCode?: string;
}

/**
 * Create client input
 */
export interface CreateClientInput {
    slug: string;
    name: string;
    ruc?: string;
    dv?: string;
    email?: string;
    phone?: string;
    address?: string;
}

// ============================================
// REPOSITORY CLASS
// ============================================

export class OrganizationRepository {
    // ============================================
    // READ OPERATIONS
    // ============================================

    /**
     * Find client by ID
     */
    async findById(id: string): AsyncServiceResult<ClientEntity> {
        try {
            const client = await prisma.client.findUnique({
                where: { id },
            });

            if (!client) {
                return Err(new NotFoundError('Client', id));
            }

            return Ok(client as unknown as ClientEntity);
        } catch (error) {
            return Err(new DatabaseError('findById', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Find client by slug
     */
    async findBySlug(slug: string): AsyncServiceResult<ClientEntity> {
        try {
            const client = await prisma.client.findUnique({
                where: { slug },
            });

            if (!client) {
                return Err(new NotFoundError('Client', slug));
            }

            return Ok(client as unknown as ClientEntity);
        } catch (error) {
            return Err(new DatabaseError('findBySlug', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Find client by RUC
     */
    async findByRuc(ruc: string): AsyncServiceResult<ClientEntity | null> {
        try {
            const client = await prisma.client.findUnique({
                where: { ruc },
            });

            return Ok(client as unknown as ClientEntity | null);
        } catch (error) {
            return Err(new DatabaseError('findByRuc', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Get HKA configuration for a client (with decrypted password)
     */
    async getHKAConfig(clientId: string): AsyncServiceResult<ClientHKAConfig> {
        try {
            const client = await prisma.client.findUnique({
                where: { id: clientId },
                select: {
                    hkaEnabled: true,
                    hkaTokenUser: true,
                    hkaTokenPassword: true,
                    hkaEnvironment: true,
                    branchCode: true,
                    locationCode: true,
                    province: true,
                    district: true,
                    corregimiento: true,
                },
            });

            if (!client) {
                return Err(new NotFoundError('Client', clientId));
            }

            if (!client.hkaEnabled) {
                return Err(new ConfigurationError('hkaEnabled', 'HKA is not enabled for this client'));
            }

            if (!client.hkaTokenUser) {
                return Err(new ConfigurationError('hkaTokenUser', 'HKA token user is not configured'));
            }

            if (!client.hkaTokenPassword) {
                return Err(new ConfigurationError('hkaTokenPassword', 'HKA token password is not configured'));
            }

            // Decrypt password
            let decryptedPassword: string;
            try {
                decryptedPassword = decrypt(client.hkaTokenPassword);
            } catch {
                return Err(new ConfigurationError('hkaTokenPassword', 'Failed to decrypt HKA password'));
            }

            return Ok({
                hkaEnabled: client.hkaEnabled,
                tokenEmpresa: client.hkaTokenUser,
                tokenPassword: decryptedPassword,
                environment: (client.hkaEnvironment === 'prod' ? 'prod' : 'demo') as 'demo' | 'prod',
                branchCode: client.branchCode,
                locationCode: client.locationCode,
                province: client.province,
                district: client.district,
                corregimiento: client.corregimiento,
            });
        } catch (error) {
            return Err(new DatabaseError('getHKAConfig', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Check if HKA is enabled and configured for a client
     */
    async isHKAEnabled(clientId: string): AsyncServiceResult<boolean> {
        try {
            const client = await prisma.client.findUnique({
                where: { id: clientId },
                select: {
                    hkaEnabled: true,
                    hkaTokenUser: true,
                    hkaTokenPassword: true,
                },
            });

            if (!client) {
                return Err(new NotFoundError('Client', clientId));
            }

            const isEnabled = !!(
                client.hkaEnabled &&
                client.hkaTokenUser &&
                client.hkaTokenPassword
            );

            return Ok(isEnabled);
        } catch (error) {
            return Err(new DatabaseError('isHKAEnabled', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Get next invoice number (atomic increment)
     */
    async getNextInvoiceNumber(clientId: string): AsyncServiceResult<number> {
        try {
            const result = await prisma.client.update({
                where: { id: clientId },
                data: {
                    lastInvoiceNumber: { increment: 1 },
                },
                select: {
                    lastInvoiceNumber: true,
                },
            });

            return Ok(result.lastInvoiceNumber);
        } catch (error) {
            return Err(new DatabaseError('getNextInvoiceNumber', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Peek at next invoice number without incrementing
     */
    async peekNextInvoiceNumber(clientId: string): AsyncServiceResult<number> {
        try {
            const client = await prisma.client.findUnique({
                where: { id: clientId },
                select: { lastInvoiceNumber: true },
            });

            if (!client) {
                return Err(new NotFoundError('Client', clientId));
            }

            return Ok(client.lastInvoiceNumber + 1);
        } catch (error) {
            return Err(new DatabaseError('peekNextInvoiceNumber', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    // ============================================
    // WRITE OPERATIONS
    // ============================================

    /**
     * Create a new client
     */
    async create(data: CreateClientInput): AsyncServiceResult<ClientEntity> {
        try {
            const client = await prisma.client.create({
                data: {
                    slug: data.slug,
                    name: data.name,
                    ruc: data.ruc,
                    dv: data.dv,
                    email: data.email,
                    phone: data.phone,
                    address: data.address,
                },
            });

            return Ok(client as unknown as ClientEntity);
        } catch (error) {
            return Err(new DatabaseError('create', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Update HKA configuration for a client
     */
    async updateHKAConfig(clientId: string, config: UpdateHKAConfigInput): AsyncServiceResult<void> {
        try {
            // Encrypt password if provided
            const updateData: Record<string, unknown> = {};

            if (config.hkaEnabled !== undefined) {
                updateData.hkaEnabled = config.hkaEnabled;
            }
            if (config.hkaTokenUser !== undefined) {
                updateData.hkaTokenUser = config.hkaTokenUser;
            }
            if (config.hkaTokenPassword !== undefined) {
                updateData.hkaTokenPassword = encrypt(config.hkaTokenPassword);
            }
            if (config.hkaEnvironment !== undefined) {
                updateData.hkaEnvironment = config.hkaEnvironment;
            }
            if (config.branchCode !== undefined) {
                updateData.branchCode = config.branchCode;
            }
            if (config.locationCode !== undefined) {
                updateData.locationCode = config.locationCode;
            }

            await prisma.client.update({
                where: { id: clientId },
                data: updateData,
            });

            return Ok(undefined);
        } catch (error) {
            return Err(new DatabaseError('updateHKAConfig', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Update client status
     */
    async updateStatus(
        clientId: string,
        isActive: boolean,
        reason?: string
    ): AsyncServiceResult<void> {
        try {
            await prisma.client.update({
                where: { id: clientId },
                data: {
                    isActive,
                    suspendedAt: isActive ? null : new Date(),
                    suspendReason: isActive ? null : reason,
                },
            });

            return Ok(undefined);
        } catch (error) {
            return Err(new DatabaseError('updateStatus', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    // ============================================
    // LIST OPERATIONS
    // ============================================

    /**
     * List all active clients
     */
    async listActive(options?: {
        page?: number;
        limit?: number;
    }): AsyncServiceResult<{ clients: ClientEntity[]; total: number }> {
        try {
            const page = options?.page ?? 1;
            const limit = options?.limit ?? 20;
            const skip = (page - 1) * limit;

            const [clients, total] = await Promise.all([
                prisma.client.findMany({
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                prisma.client.count({
                    where: { isActive: true },
                }),
            ]);

            return Ok({
                clients: clients as unknown as ClientEntity[],
                total,
            });
        } catch (error) {
            return Err(new DatabaseError('listActive', error instanceof Error ? error.message : 'Unknown error'));
        }
    }
}

// Export singleton instance for convenience
export const organizationRepository = new OrganizationRepository();
