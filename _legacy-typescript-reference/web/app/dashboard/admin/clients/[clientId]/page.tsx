import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { ClientDetailTabs } from "./client-detail-tabs"

export const dynamic = "force-dynamic"

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard")
  }

  const { clientId } = await params
  const { tab } = await searchParams

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      users: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      },
    },
  })

  if (!client) {
    notFound()
  }

  // Fetch audit logs for this client and its users
  const userIds = client.users.map((u) => u.id)
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entity: "Client",  entityId: clientId },
        { entity: "User",    entityId: { in: userIds } },
        { userId: { in: userIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/admin/clients"
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{client.name}</h1>
        {client.ruc && (
          <span className="text-sm text-gray-500 dark:text-gray-400">RUC: {client.ruc}</span>
        )}
      </div>

      <ClientDetailTabs
        client={client as any}
        users={client.users as any}
        auditLogs={auditLogs as any}
        activeTab={(tab as string) || "info"}
      />
    </div>
  )
}
