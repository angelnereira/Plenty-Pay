import { z } from 'zod';

/**
 * Esquema de validación para configuración HKA
 * Separado en su propio archivo para evitar problemas con server actions
 */
export const hkaSettingsSchema = z.object({
    // Autenticación
    hkaTokenUser: z.string().min(1, "Token de empresa es requerido"),
    hkaTokenPassword: z.string().optional(), // Opcional si ya existe

    // Datos Emisor
    branchCode: z.string().length(4, "Debe tener 4 dígitos (ej: 0000)"),
    locationCode: z.string().min(3, "Formato incorrecto (ej: 1-1-1)"),

    // Metadata (Configuración Técnica)
    tipoSucursal: z.enum(["1", "2"]).default("1"),
    puntoFacturacionFiscal: z.string().length(3, "Debe tener 3 dígitos (ej: 001)"),
    tipoEmision: z.string().default("01"),
    destinoOperacion: z.string().default("1"),
    formatoCAFE: z.string().default("1"),
    entregaCAFE: z.string().default("1"),
    envioContenedor: z.string().default("1"),
    procesoGeneracion: z.string().default("1"),
});

export type HkaSettingsInput = z.infer<typeof hkaSettingsSchema>;
