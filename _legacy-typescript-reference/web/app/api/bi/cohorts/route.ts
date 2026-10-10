import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { CohortService } from "@/features/bi"
import { isBIProEnabled } from "@/lib/constants/plans"

/** GET /api/bi/cohorts?months=12 */
export async function GET(request: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    const clientId = session.user.clientId
    if (!clientId) return NextResponse.json({ error: "Usuario sin organización" }, { status: 400 })
    const c = await prisma.client.findUnique({ where: { id: clientId }, select: { biProEnabled: true } })
    if (!c || !isBIProEnabled({ biProEnabled: c.biProEnabled })) {
        return NextResponse.json({ error: "BI Pro no activo" }, { status: 403 })
    }
    const url = new URL(request.url)
    const months = Math.max(3, Math.min(24, parseInt(url.searchParams.get("months") ?? "12", 10) || 12))
    const service = new CohortService()
    const matrix = await service.compute(clientId, { months })
    return NextResponse.json(matrix)
}
