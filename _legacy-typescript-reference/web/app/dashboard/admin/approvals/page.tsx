import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { redirect } from "next/navigation"
import { CheckCircle2, XCircle, Clock, Building2, User, ShieldAlert } from "lucide-react"
import { ApproveButton, RejectButton } from "./approve-button" // Client component for action
import { Badge } from "@/components/ui/badge"

export default async function AdminApprovalsPage() {
    const session = await auth()

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard")
    }

    // Fetch pending clients
    const pendingClients = await prisma.client.findMany({
        where: {
            approvalStatus: "PENDING",
            // Not deleted
            deletedAt: null
        },
        include: {
            users: {
                where: { role: "CLIENT" }, // Should be the creator/admin of that client
                take: 1
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <ShieldAlert className="h-8 w-8 text-violet-600" />
                        Solicitudes Pendientes
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Revisar y aprobar nuevas organizaciones
                    </p>
                </div>
            </div>

            {pendingClients.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Todo al día</h3>
                    <p className="text-gray-500 dark:text-gray-400">No hay solicitudes de registro pendientes.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {pendingClients.map((client) => {
                        const user = client.users[0]
                        return (
                            <div key={client.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                <Building2 className="h-5 w-5 text-violet-500" />
                                                {client.name}
                                            </h3>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">
                                                    RUC: {client.ruc || "N/A"}
                                                </span>
                                                <span>•</span>
                                                <Clock className="h-3 w-3" />
                                                {new Date(client.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                                            {client.planType}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                                <User className="h-4 w-4 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name || "Sin usuario"}</p>
                                                <p className="text-xs text-gray-500">{user?.email}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-gray-500 uppercase">Módulos Solicitados</p>
                                            <div className="flex flex-wrap gap-2">
                                                {(client.pendingModules as string[] || []).length > 0 ? (
                                                    (client.pendingModules as string[]).map((mod) => (
                                                        <Badge key={mod} variant="secondary" className="text-xs">
                                                            {mod === 'inventory' && 'Inventario'}
                                                            {mod === 'pos' && 'POS'}
                                                            {mod === 'payday' && 'Planilla'}
                                                            {mod === 'logistics' && 'Logística'}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-slate-400">Solo Facturación</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 md:border-l md:pl-6 border-gray-100 dark:border-gray-700">
                                    <RejectButton clientId={client.id} clientName={client.name} />
                                    <ApproveButton
                                        clientId={client.id}
                                        clientName={client.name}
                                        requestedModules={client.pendingModules as string[]}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
