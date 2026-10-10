'use server'

import { auth } from '@core/auth'
import { prismaServer as prisma } from '@core/database'
import { z } from 'zod'

const clientConfigSchema = z.object({
  autoSendToHKA: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  emailOnCertification: z.boolean().optional(),
  emailOnError: z.boolean().optional(),
  lowFoliosThreshold: z.number().int().min(1).max(100).optional(),
  inventoryValuationMethod: z.string().optional(),
  defaultLeadTimeDays: z.number().int().min(1).max(365).optional(),
  lowStockAlertEnabled: z.boolean().optional(),
  autoReorderEnabled: z.boolean().optional(),
})

export async function updateClientWorkflowConfig(data: z.infer<typeof clientConfigSchema>) {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  const parsed = clientConfigSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    await prisma.client.update({
      where: { id: session.user.clientId },
      data: parsed.data,
    })
    return { success: true }
  } catch {
    return { success: false, error: 'Error al guardar configuración' }
  }
}

export async function updateWorkflowSetting(key: string, value: string) {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  try {
    await prisma.systemConfig.upsert({
      where: {
        clientId_key: {
          clientId: session.user.clientId,
          key,
        },
      },
      update: { value },
      create: {
        clientId: session.user.clientId,
        key,
        value,
      },
    })
    return { success: true }
  } catch {
    return { success: false, error: 'Error al guardar' }
  }
}
