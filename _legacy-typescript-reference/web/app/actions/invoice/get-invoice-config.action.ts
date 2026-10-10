'use server';

import { auth } from '@core/auth';
import { prismaServer } from '@core/database';
import { createLogger } from '@/lib/utils/logger';
import { extractHKAConfig } from '@shared/types/client-metadata';

const logger = createLogger('InvoiceConfig');

export interface InvoiceConfig {
    // Datos del emisor
    issuer: {
        ruc: string;
        dv: string;
        razonSocial: string;
        nombreComercial?: string;
        direccion: string;
        email?: string;
        telefono?: string;
        provincia: string;
        distrito: string;
        corregimiento: string;
        codigoUbicacion: string;
    };

    // Configuración HKA
    hka: {
        environment: 'DEMO' | 'PROD';
        codigoSucursalEmisor: string;
        puntoFacturacionFiscal: string;
        tipoSucursal: string;
    };

    // Credenciales HKA (para server-side use)
    tokenEmpresa?: string;
    tokenPassword?: string;

    // Configuración de facturación
    billing: {
        tipoEmision: string;
        tipoDocumento: string;
        naturalezaOperacion: string;
        tipoOperacion: string;
        destinoOperacion: string;
        formatoCAFE: string;
        entregaCAFE: string;
        envioContenedor: string;
        procesoGeneracion: string;
        tipoVenta: string;
    };
}

export async function getInvoiceConfig() {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.clientId) {
        return { success: false, error: 'No autorizado' };
    }

    try {

        const user = await prismaServer.user.findUnique({
            where: { id: session.user.id },
            include: { client: true }
        });

        if (!user?.client) {
            return { success: false, error: 'Usuario sin organización' };
        }

        const client = user.client;

        // Obtener metadata HKA si existe (tipado seguro)
        const hkaConfig = extractHKAConfig(client.metadata);

        const config: InvoiceConfig = {
            issuer: {
                ruc: client.ruc || '',
                dv: client.dv || '',
                razonSocial: client.name,
                nombreComercial: client.tradeName || undefined,
                direccion: client.address || 'Ciudad de Panamá',
                email: client.email || undefined,
                telefono: client.phone || undefined,
                provincia: client.province || 'Panamá',
                distrito: client.district || 'Panamá',
                corregimiento: client.corregimiento || 'San Felipe',
                codigoUbicacion: client.locationCode || '8-8-1',
            },

            hka: {
                environment: (client.hkaEnvironment?.toUpperCase() === 'PROD' ? 'PROD' : 'DEMO') as 'DEMO' | 'PROD',
                codigoSucursalEmisor: client.branchCode || '0000',
                puntoFacturacionFiscal: hkaConfig.puntoFacturacionFiscal || '001',
                tipoSucursal: hkaConfig.tipoSucursal || '1',
            },

            // Credentials from client fields OR metadata
            tokenEmpresa: client.hkaTokenUser || hkaConfig.tokenEmpresa,
            tokenPassword: client.hkaTokenPassword || hkaConfig.tokenPassword,

            billing: {
                tipoEmision: hkaConfig.tipoEmision || '01', // Normal
                tipoDocumento: '01', // Factura
                naturalezaOperacion: '01', // Venta
                tipoOperacion: '1', // Salida
                destinoOperacion: hkaConfig.destinoOperacion || '1', // Panamá
                formatoCAFE: hkaConfig.formatoCAFE || '1', // Sin CAFE
                entregaCAFE: hkaConfig.entregaCAFE || '1',
                envioContenedor: '1',
                procesoGeneracion: '1', // Sistema propio
                tipoVenta: '1', // Giro del negocio
            },
        };

        logger.debug({ hasCredentials: !!config.tokenEmpresa }, 'Invoice config retrieved');

        return {
            success: true,
            data: config
        };

    } catch (error: unknown) {
        logger.error({ err: error }, 'Failed to get invoice config');
        const errorMessage = error instanceof Error ? error.message : 'Error al obtener configuración';
        return { success: false, error: errorMessage };
    }
}
