import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import { prismaServer as prisma } from "@core/database"
import { WorkflowConfigClient } from "./workflow-config-client"

export default async function WorkflowConfigPage() {
  const session = await auth()
  if (!session?.user?.clientId) redirect("/dashboard")

  const client = await prisma.client.findUnique({
    where: { id: session.user.clientId },
    select: {
      id: true,
      autoSendToHKA: true,
      requireApproval: true,
      emailOnCertification: true,
      emailOnError: true,
      lowFoliosThreshold: true,
      inventoryValuationMethod: true,
      defaultLeadTimeDays: true,
      lowStockAlertEnabled: true,
      autoReorderEnabled: true,
      inventoryEnabled: true,
      posEnabled: true,
      paydayEnabled: true,
      logisticsEnabled: true,
    },
  })

  if (!client) redirect("/dashboard")

  // Fetch workflow system configs
  const systemConfigs = await prisma.systemConfig.findMany({
    where: {
      clientId: session.user.clientId,
      key: { startsWith: 'workflow.' },
    },
  })

  const configMap: Record<string, string> = {}
  for (const sc of systemConfigs) {
    configMap[sc.key] = sc.value
  }

  return (
    <WorkflowConfigClient
      clientConfig={JSON.parse(JSON.stringify(client))}
      workflowSettings={configMap}
    />
  )
}
