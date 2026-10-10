import { Crown } from "lucide-react"
import Link from "next/link"
import { prisma } from "@core/database"
import { requireBIAccess } from "@/features/bi"
import { CampaignsManager } from "@/features/bi/ui/campaigns-manager"

export const dynamic = "force-dynamic"

export default async function BICampaignsPage({
    searchParams,
}: {
    searchParams: Promise<{ segment?: string }>
}) {
    const access = await requireBIAccess()
    if (!access.pro) {
        return (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-8 text-center">
                <Crown className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Campañas</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Convierte un segmento en una campaña por WhatsApp o email. Disponible en <strong>BI Pro</strong>.
                </p>
                <Link
                    href="/dashboard/configuracion"
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500"
                >
                    Activar BI Pro
                </Link>
            </div>
        )
    }

    const params = await searchParams
    // Promise.allSettled: independencia entre lista de campañas y segmentos.
    // Si una falla, la otra renderiza igual.
    const settled = await Promise.allSettled([
        prisma.bICampaign.findMany({
            where: { clientId: access.clientId },
            orderBy: { createdAt: "desc" },
            include: { segment: { select: { id: true, name: true, cachedCount: true } } },
        }),
        prisma.bISavedSegment.findMany({
            where: { clientId: access.clientId },
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, cachedCount: true },
        }),
    ])
    const campaigns = settled[0].status === "fulfilled" ? settled[0].value : []
    const segments = settled[1].status === "fulfilled" ? settled[1].value : []
    for (const r of settled) {
        if (r.status === "rejected") console.warn("[BI campaigns] query falló:", r.reason instanceof Error ? r.reason.message : r.reason)
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Campañas
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Envía un mensaje masivo a un segmento. WhatsApp requiere addon activo; email usa el canal base de PlentyPay.
                </p>
            </header>

            <CampaignsManager
                initialCampaigns={campaigns.map((c) => ({
                    id: c.id,
                    channel: c.channel as "whatsapp" | "email",
                    message: c.message,
                    status: c.status,
                    recipients: c.recipients,
                    conversions: c.conversions,
                    sentAt: c.sentAt ? c.sentAt.toISOString() : null,
                    createdAt: c.createdAt.toISOString(),
                    segment: c.segment,
                }))}
                segments={segments}
                preselectedSegmentId={params.segment ?? null}
            />
        </div>
    )
}
