'use server'

import { auth } from '@core/auth'
import { prismaServer as prisma } from '@core/database'
import { z } from 'zod'

const payrollConfigSchema = z.object({
  payFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  commercialZone: z.enum(['NORMAL', 'ZONA_FRANCA', 'CASINO', 'HOTEL']),
  operationalHours: z.object({
    start: z.string(),
    end: z.string(),
    days: z.array(z.number()),
  }).optional(),
})

export async function updatePayrollConfig(data: z.infer<typeof payrollConfigSchema>) {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  const parsed = payrollConfigSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    await prisma.paydayConfig.upsert({
      where: { clientId: session.user.clientId },
      update: {
        payFrequency: parsed.data.payFrequency,
        commercialZone: parsed.data.commercialZone,
        operationalHours: parsed.data.operationalHours as any,
      },
      create: {
        clientId: session.user.clientId,
        payFrequency: parsed.data.payFrequency,
        commercialZone: parsed.data.commercialZone,
        operationalHours: parsed.data.operationalHours as any,
      },
    })
    return { success: true }
  } catch {
    return { success: false, error: 'Error al guardar configuración' }
  }
}

const payrollSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
})

export async function updatePayrollSetting(data: z.infer<typeof payrollSettingSchema>) {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  const parsed = payrollSettingSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    await prisma.systemConfig.upsert({
      where: {
        clientId_key: {
          clientId: session.user.clientId,
          key: parsed.data.key,
        },
      },
      update: { value: parsed.data.value },
      create: {
        clientId: session.user.clientId,
        key: parsed.data.key,
        value: parsed.data.value,
      },
    })
    return { success: true }
  } catch {
    return { success: false, error: 'Error al guardar configuración' }
  }
}
