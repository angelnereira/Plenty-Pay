'use server'

import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { revalidatePath } from "next/cache"
import { logger } from "@/lib/logger"

export type BillingCardMode = 'DEFAULT' | 'DISCRETE' | 'HIDDEN' | 'MASKED';

export async function updateBillingCardMode(mode: BillingCardMode) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }

        const userId = session.user.id;

        // Fetch current user options/metadata to merge
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { metadata: true } as any
        }) as any;

        const currentMetadata = (user?.metadata as Record<string, any>) || {};

        const newMetadata = {
            ...currentMetadata,
            billingCardMode: mode
        };

        await prisma.user.update({
            where: { id: userId },
            data: {
                metadata: newMetadata
            } as any
        });

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/configuracion/apariencia');

        return { success: true };
    } catch (error) {
        logger.error({ error }, "Failed to update billing card mode");
        return { success: false, error: "Failed to update preference" };
    }
}
