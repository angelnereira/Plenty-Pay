import { redirect } from "next/navigation"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { ClientsAndUsersPanel } from "./clients-users-panel"

export const dynamic = "force-dynamic"

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard")
  }

  const { tab } = await searchParams

  const [clients, users] = await Promise.all([
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        ruc: true,
        isActive: true,
        facturacionEnabled: true,
        inventoryEnabled: true,
        posEnabled: true,
        paydayEnabled: true,
        logisticsEnabled: true,
        creditosEnabled: true,
        motorCreditTier: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        client: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return (
    <ClientsAndUsersPanel
      clients={clients}
      users={users}
      initialTab={tab === "users" ? "users" : "clients"}
    />
  )
}
