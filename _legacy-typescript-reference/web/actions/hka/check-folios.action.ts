'use server'

import { auth } from "@core/auth"
import { checkFoliosDisponibles, FoliosResult } from "@/features/hka/model/methods/folios"
import { logger } from "@/lib/logger"

/**
 * Server Action to check available folios in HKA
 */
export async function checkFoliosAction(): Promise<FoliosResult> {
    try {
        const session = await auth()

        if (!session || !session.user || !session.user.clientId) {
            return {
                success: false,
                error: 'No autorizado o sin cliente asignado'
            }
        }

        const clientId = session.user.clientId

        logger.info({ clientId }, '[HKA] Checking available folios via Server Action')

        // Call the HKA method directly
        const result = await checkFoliosDisponibles(clientId)

        return result
    } catch (error) {
        logger.error({ error }, '[HKA] Error checking folios in Server Action')
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error interno al consultar folios'
        }
    }
}
