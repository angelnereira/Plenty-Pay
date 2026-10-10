import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import { prismaServer as prisma } from "@core/database"
import { UpgradeRequestsList } from "./upgrade-requests-list"

export const metadata = {
    title: "Solicitudes de Upgrade | Admin",
    description: "Gestión de solicitudes de cambio de plan y módulos"
}

export default async function UpgradeRequestsPage() {
    const session = await auth()

    if (!session || session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard")
    }

    const requests = await prisma.upgradeRequest.findMany({
        where: { status: "PENDING" },
        include: {
            client: {
                select: {
                    id: true,
                    name: true,
                    planType: true,
                    facturacionEnabled: true,
                    inventoryEnabled: true,
                    posEnabled: true,
                    paydayEnabled: true,
                    logisticsEnabled: true,
                    creditosEnabled: true,
                    motorCreditTier: true,
                    apiAccessEnabled: true,
                    maxUsers: true,
                    maxPosStations: true,
                    extraBranches: true,
                }
            },
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        },
        orderBy: { createdAt: "desc" }
    })

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
                    Solicitudes de Upgrade
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                    Gestiona las solicitudes de cambio de plan y activación de módulos
                </p>
            </div>

            <UpgradeRequestsList requests={requests} />
        </div>
    )
}
