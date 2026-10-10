import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import { prismaServer as prisma } from "@core/database"
import { PayrollConfigClient } from "./payroll-config-client"

export default async function PayrollConfigPage() {
  const session = await auth()
  if (!session?.user?.clientId) redirect("/dashboard")

  // Fetch or create PaydayConfig
  let config = await prisma.paydayConfig.findUnique({
    where: { clientId: session.user.clientId },
  })

  if (!config) {
    config = await prisma.paydayConfig.create({
      data: { clientId: session.user.clientId },
    })
  }

  // Fetch payroll metadata from SystemConfig
  const systemConfigs = await prisma.systemConfig.findMany({
    where: {
      clientId: session.user.clientId,
      key: { in: [
        'payroll.deductions',
        'payroll.benefits',
        'payroll.overtime_rules',
        'payroll.thirteenth_month',
      ] },
    },
  })

  const configMap: Record<string, string> = {}
  for (const sc of systemConfigs) {
    configMap[sc.key] = sc.value
  }

  return (
    <PayrollConfigClient
      initialConfig={JSON.parse(JSON.stringify(config))}
      initialSettings={configMap}
    />
  )
}
