import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { AnomalyService } from "@/features/bi"
import { isBIProEnabled } from "@/lib/constants/plans"

async function gatePro() {
    const session = await auth()
    if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
    const clientId = session.user.clientId
    if (!clientId) return { error: NextResponse.json({ error: "Usuario sin organización" }, { status: 400 }) }
    const c = await prisma.client.findUnique({ where: { id: clientId }, select: { biProEnabled: true } })
    if (!c || !isBIProEnabled({ biProEnabled: c.biProEnabled })) {
        return { error: NextResponse.json({ error: "BI Pro no activo" }, { status: 403 }) }
    }
    return { clientId }
}

/** GET /api/bi/anomalies?metric=sales_total&days=60 */
export async function GET(request: Request) {
    const g = await gatePro()
    if ("error" in g) return g.error
    const url = new URL(request.url)
    const metric = (url.searchParams.get("metric") === "invoice_count" ? "invoice_count" : "sales_total") as "sales_total" | "invoice_count"
    const days = Math.max(30, Math.min(180, parseInt(url.searchParams.get("days") ?? "60", 10) || 60))
    const service = new AnomalyService()
    const result = await service.detect(g.clientId, { metric, days })
    return NextResponse.json(result)
}
