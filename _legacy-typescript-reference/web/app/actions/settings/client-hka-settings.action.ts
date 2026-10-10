'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { encrypt } from '@/lib/utils/encryption';
import { hkaSettingsSchema, type HkaSettingsInput } from './hka-settings.schema';
import { detectHKAEnvironment } from '@/features/hka/model/services/hka-detection.service';

/**
 * Obtiene la configuración HKA del cliente actual
 */
export async function getClientHkaSettings() {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.clientId) {
            return { success: false, error: 'No autorizado' };
        }

        const client = await prisma.client.findUnique({
            where: { id: session.user.clientId },
            select: {
                hkaTokenUser: true,
                hkaEnvironment: true,
                branchCode: true,
                locationCode: true,
                metadata: true,
                // No devolvemos el password por seguridad
            }
        });

        if (!client) return { success: false, error: 'Cliente no encontrado' };

        const metadata = client.metadata as any;
        const hkaConfig = metadata?.hkaConfig || {};

        return {
            success: true,
            data: {
                hkaTokenUser: client.hkaTokenUser || '',
                branchCode: client.branchCode || '0000',
                locationCode: client.locationCode || '1-1-1',

                // Configuración técnica con defaults
                tipoSucursal: hkaConfig.tipoSucursal || '1',
                puntoFacturacionFiscal: hkaConfig.puntoFacturacionFiscal || '001',
                tipoEmision: hkaConfig.tipoEmision || '01',
                destinoOperacion: hkaConfig.destinoOperacion || '1',
                formatoCAFE: hkaConfig.formatoCAFE || '1',
                entregaCAFE: hkaConfig.entregaCAFE || '1',
                envioContenedor: hkaConfig.envioContenedor || '1',
                procesoGeneracion: hkaConfig.procesoGeneracion || '1',
            }
        };
    } catch (error) {
        console.error('Error fetching HKA settings:', error);
        return { success: false, error: 'Error al obtener configuración' };
    }
}

/**
 * Actualiza la configuración HKA del cliente
 */
export async function updateClientHkaSettings(input: HkaSettingsInput) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.clientId) {
            return { success: false, error: 'No autorizado' };
        }

        const clientId = session.user.clientId;

        // Validar input
        const result = hkaSettingsSchema.safeParse(input);
        if (!result.success) {
            return { success: false, error: result.error.issues[0]?.message };
        }

        const data = result.data;

        // Obtener metadata actual para no sobrescribir otros datos
        const currentClient = await prisma.client.findUnique({
            where: { id: clientId },
            select: { metadata: true }
        });

        const currentMetadata = (currentClient?.metadata as any) || {};

        // Encriptar password solo si se proporciona
        let decryptedPassword = '';
        if (data.hkaTokenPassword && data.hkaTokenPassword.trim().length > 0) {
            decryptedPassword = data.hkaTokenPassword.trim();
        } else {
            // Si no se pasó password, necesitamos el actual para la detección
            const clientWithCreds = await prisma.client.findUnique({
                where: { id: clientId },
                select: { hkaTokenPassword: true }
            });

            if (clientWithCreds?.hkaTokenPassword) {
                const { decrypt } = await import('@/lib/utils/encryption');
                decryptedPassword = decrypt(clientWithCreds.hkaTokenPassword);
            }
        }

        if (!decryptedPassword) {
            return { success: false, error: 'Se requiere contraseña del token para validar el ambiente' };
        }

        // Detectar ambiente automáticamente
        const detectedEnv = await detectHKAEnvironment(data.hkaTokenUser, decryptedPassword);

        if (!detectedEnv) {
            return {
                success: false,
                error: 'No se pudo validar el ambiente con las credenciales proporcionadas. Verifique el token y la contraseña.'
            };
        }

        // Preparar datos para actualización
        const updateData: any = {
            hkaTokenUser: data.hkaTokenUser,
            hkaEnvironment: detectedEnv,
            branchCode: data.branchCode,
            locationCode: data.locationCode,

            // Guardar configuración técnica en metadata
            metadata: {
                ...currentMetadata,
                hkaConfig: {
                    tipoSucursal: data.tipoSucursal,
                    puntoFacturacionFiscal: data.puntoFacturacionFiscal,
                    tipoEmision: data.tipoEmision,
                    destinoOperacion: data.destinoOperacion,
                    formatoCAFE: data.formatoCAFE,
                    entregaCAFE: data.entregaCAFE,
                    envioContenedor: data.envioContenedor,
                    procesoGeneracion: data.procesoGeneracion,
                }
            }
        };

        if (data.hkaTokenPassword && data.hkaTokenPassword.trim().length > 0) {
            updateData.hkaTokenPassword = encrypt(data.hkaTokenPassword);
        }

        // Actualizar cliente
        await prisma.client.update({
            where: { id: clientId },
            data: updateData,
        });

        revalidatePath('/dashboard/settings');

        return { success: true };
    } catch (error) {
        console.error('Error updating HKA settings:', error);
        return { success: false, error: 'Error al actualizar configuración' };
    }
}
