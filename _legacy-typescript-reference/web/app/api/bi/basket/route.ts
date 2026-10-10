import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { BasketService } from "@/features/bi"
import { isBIProEnabled } from "@/lib/constants/plans"

/** GET /api/bi/basket?minPairCount=3&minConfidence=0.1&limit=50 */
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
    const minPairCount = Math.max(2, Math.min(50, parseInt(url.searchParams.get("minPairCount") ?? "3", 10) || 3))
    const minConfidence = Math.max(0.01, Math.min(1, parseFloat(url.searchParams.get("minConfidence") ?? "0.1")))
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50))
    const service = new BasketService()
    const rules = await service.topPairs(clientId, { minPairCount, minConfidence, limit })
    return NextResponse.json({ rules })
}
