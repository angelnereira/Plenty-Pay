import { auth } from "@core/auth"
import { redirect, notFound } from "next/navigation"
import { prismaServer as prisma } from "@core/database"
import { getDeliveryOrderById } from "@/features/logistics/model/services/delivery-order.service"
import { DeliveryOrderDetailClient } from "@/features/logistics/ui/DeliveryOrderDetailClient"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
}

export default async function DeliveryOrderDetailPage({ params }: Props) {
  const { id } = await params
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

  const order = await getDeliveryOrderById(id, clientId)
  if (!order) notFound()

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <DeliveryOrderDetailClient order={order} />
    </div>
  )
}
