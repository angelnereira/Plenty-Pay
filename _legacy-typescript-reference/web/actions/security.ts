'use server'

import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { compare } from "bcryptjs"
import { logger } from "@/lib/logger"

export async function verifyPassword(password: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return { success: false, error: 'Unauthorized' }
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { password: true }
        })

        if (!user || !user.password) {
            return { success: false, error: 'User not found' }
        }

        const isValid = await compare(password, user.password)

        if (isValid) {
            return { success: true }
        } else {
            return { success: false, error: 'Contraseña incorrecta' }
        }
    } catch (error) {
        logger.error({ error }, '[Security] Error verifying password')
        return { success: false, error: 'Error verificando contraseña' }
    }
}
