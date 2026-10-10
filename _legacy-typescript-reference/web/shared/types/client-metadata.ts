/**
 * Client Metadata Type Definitions
 * 
 * Define tipos seguros para el campo `metadata` del modelo Client.
 * Reemplaza el uso de `as any` con validación Zod.
 * 
 * @module lib/types/client-metadata
 */

import { z } from 'zod';

/**
 * Schema para configuración HKA del cliente
 */
export const HKAConfigSchema = z.object({
    // Credenciales (pueden estar en client model directamente o en metadata)
    tokenEmpresa: z.string().optional(),
    tokenPassword: z.string().optional(),

    // Ambiente
    environment: z.enum(['demo', 'prod']).optional().default('demo'),

    // Datos del emisor
    rucEmisor: z.string().optional(),
    branchCode: z.string().optional().default('0000'),
    tipoSucursal: z.string().optional().default('1'),
    puntoFacturacionFiscal: z.string().optional().default('001'),
    locationCode: z.string().optional(),

    // Ubicación
    provincia: z.string().optional(),
    distrito: z.string().optional(),
    corregimiento: z.string().optional(),
    direccion: z.string().optional(),

    // Configuración de emisión
    tipoEmision: z.string().optional().default('01'),
    destinoOperacion: z.string().optional().default('1'),
    entregaCAFE: z.string().optional().default('1'),
    formatoCAFE: z.string().optional().default('1'),
});

/**
 * Schema principal para metadata del cliente
 */
export const ClientMetadataSchema = z.object({
    hka: HKAConfigSchema.optional(),

    // Campos adicionales que puedan existir en metadata
    // Agregar según necesidad
}).passthrough(); // Permite campos adicionales no definidos

/**
 * Tipo inferido de HKAConfig
 */
export type HKAConfig = z.infer<typeof HKAConfigSchema>;

/**
 * Tipo inferido de ClientMetadata
 */
export type ClientMetadata = z.infer<typeof ClientMetadataSchema>;

/**
 * Parsea metadata de cliente de forma segura
 * 
 * @param metadata - Valor de metadata del cliente (unknown)
 * @returns Metadata parseada o objeto vacío si falla
 * 
 * @example
 * ```typescript
 * const client = await prisma.client.findUnique({ where: { id } });
 * const metadata = parseClientMetadata(client.metadata);
 * const hkaConfig = metadata.hka;
 * ```
 */
export function parseClientMetadata(metadata: unknown): ClientMetadata {
    const result = ClientMetadataSchema.safeParse(metadata);

    if (result.success) {
        return result.data;
    }

    // Si falla, retornar objeto vacío
    return {};
}

/**
 * Extrae configuración HKA de metadata de forma segura
 * 
 * @param metadata - Valor de metadata del cliente (unknown)
 * @returns Configuración HKA o objeto vacío
 * 
 * @example
 * ```typescript
 * const client = await prisma.client.findUnique({ where: { id } });
 * const hka = extractHKAConfig(client.metadata);
 * console.log(hka.environment); // 'demo' | 'prod'
 * ```
 */
export function extractHKAConfig(metadata: unknown): Partial<HKAConfig> {
    const parsed = parseClientMetadata(metadata);
    return parsed.hka || {};
}
