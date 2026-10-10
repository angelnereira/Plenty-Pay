"use server";

import { auth } from "@core/auth";
import { prisma } from "@/lib/db";
import { ConfigService } from "@/features/config/services/config.service";
import { revalidatePath } from "next/cache";

const configService = new ConfigService();

export async function updateSettingsAction(key: string, value: any, revalidatePathUrl?: string) {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
        return { success: false, error: "No autorizado" };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id }
    });

    if (!user || !user.clientId) {
        return { success: false, error: "Usuario o Cliente no encontrado" };
    }

    try {
        if (key === 'posCheckoutPreference') {
            await prisma.user.update({
                where: { id: session.user.id },
                data: { checkoutPreference: value }
            });
        } else {
            await configService.set(user.clientId, key, value, session.user.id);
        }

        if (revalidatePathUrl) {
            revalidatePath(revalidatePathUrl);
        }

        return { success: true };
    } catch (error) {
        console.error("[UPDATE_SETTINGS_ACTION]", error);
        return { success: false, error: "Error al guardar la configuración" };
    }
}

export async function getSettingsAction(keys: string[]) {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
        return { success: false, error: "No autorizado" };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id }
    });

    if (!user || !user.clientId) {
        return { success: false, error: "Usuario o Cliente no encontrado" };
    }

    try {
        const settings = await configService.getMany(user.clientId, keys);

        // Inject user preference if requested
        if (keys.includes('posCheckoutPreference')) {
            settings['posCheckoutPreference'] = user.checkoutPreference || 'ALWAYS_DGI'; // Default fallback
        }

        return { success: true, data: settings };
    } catch (error) {
        console.error("[GET_SETTINGS_ACTION]", error);
        return { success: false, error: "Error al leer la configuración" };
    }
}
