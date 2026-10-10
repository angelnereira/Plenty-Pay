"use server";

import { prisma } from "@core/database/prisma-singleton";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ConfigSchema = z.object({
    clientId: z.string(),
    commercialZone: z.enum(["NORMAL", "ZONA_FRANCA", "CASINO", "HOTEL"]),
    payFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
    // operationalHours can be complex, skipping for now or treating as JSON
});

export async function getPaydayConfig(clientId: string) {
    return await prisma.paydayConfig.findUnique({
        where: { clientId }
    });
}

export async function upsertPaydayConfig(data: z.infer<typeof ConfigSchema>) {
    try {
        const config = await prisma.paydayConfig.upsert({
            where: { clientId: data.clientId },
            update: {
                commercialZone: data.commercialZone,
                payFrequency: data.payFrequency,
            },
            create: {
                clientId: data.clientId,
                commercialZone: data.commercialZone,
                payFrequency: data.payFrequency,
            }
        });
        revalidatePath('/dashboard/payday/settings');
        return { success: true, data: config };
    } catch (error) {
        return { success: false, error: 'Error al guardar la configuración.' };
    }
}
