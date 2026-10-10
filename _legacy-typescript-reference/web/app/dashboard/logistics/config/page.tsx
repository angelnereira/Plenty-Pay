import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import { prisma } from "@core/database"
import { Truck } from "lucide-react"
import { LogisticsConfigClient } from "./logistics-config-client"
import { ModuleExportCard } from "@/components/dataport/module-export-card"

export default async function LogisticsConfigPage() {
    const session = await auth()

    if (!session?.user?.clientId) {
        redirect("/")
    }

    const client = await prisma.client.findUnique({
        where: { id: session.user.clientId },
        select: { logisticsEnabled: true, approvalStatus: true }
    })

    if (!client?.logisticsEnabled && session.user.role !== "SUPER_ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <Truck className="h-12 w-12 text-rose-500 mb-4" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Módulo no disponible
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                    El módulo de Logística no está habilitado para su plan actual.
                </p>
            </div>
        )
    }

    return (
        <>
            <LogisticsConfigClient />
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
                <ModuleExportCard module="logistics" />
            </div>
        </>
    )
}
