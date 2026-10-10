import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import { prismaServer as prisma } from "@core/database"
import { Truck } from "lucide-react"
import { listDeliveryOrders } from "@/features/logistics/model/services/delivery-order.service"
import { DeliveryOrdersClientList } from "@/features/logistics/ui/DeliveryOrdersClientList"

export const dynamic = "force-dynamic"

export default async function LogisticsPage() {
  const session = await auth()
  if (!session) redirect("/")

  const clientId = session.user.clientId
  if (!clientId) redirect("/dashboard")

  // Check module access
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { logisticsEnabled: true, approvalStatus: true },
  })

  const hasAccess =
    session.user.role === "SUPER_ADMIN" ||
    (client?.approvalStatus === "APPROVED" && client?.logisticsEnabled)

  if (!hasAccess) redirect("/dashboard")

  const orders = await listDeliveryOrders(clientId)

  return (
    <div className="min-h-screen pb-12 md:pb-6">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Truck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de Entrega</h1>
            <p className="text-sm text-gray-500">
              {orders.length} {orders.length === 1 ? "orden registrada" : "órdenes registradas"}
            </p>
          </div>
        </div>

        <DeliveryOrdersClientList initialOrders={orders as any} />
      </div>
    </div>
  )
}
