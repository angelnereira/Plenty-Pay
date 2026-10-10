import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { AskService } from "@/features/bi"
import { aiRatelimit } from "@/lib/ai/gateway"
import { isBIProEnabled } from "@/lib/constants/plans"

const schema = z.object({
    question: z.string().min(3).max(500),
})

/**
 * POST /api/bi/ask
 *
 * Pregunta en lenguaje natural sobre los datos del cliente.
 * Detrás del gate de BI Pro. Rate-limited contra el bucket AI
 * compartido (30 requests/día por client del proyecto).
 */
export async function POST(request: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    const clientId = session.user.clientId
    if (!clientId) return NextResponse.json({ error: "Usuario sin organización" }, { status: 400 })

    const c = await prisma.client.findUnique({ where: { id: clientId }, select: { biProEnabled: true } })
    if (!c || !isBIProEnabled({ biProEnabled: c.biProEnabled })) {
        return NextResponse.json({ error: "BI Pro no activo" }, { status: 403 })
    }

    // Rate limit por client (no por user) — el cupo es del tenant.
    const rl = await aiRatelimit.limit(clientId)
    if (!rl.success) {
        return NextResponse.json(
            { error: "Límite diario de preguntas AI alcanzado. Inténtalo mañana." },
            { status: 429 },
        )
    }

    try {
        const body = await request.json()
        const parsed = schema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Body inválido", details: parsed.error.issues },
                { status: 400 },
            )
        }
        const service = new AskService()
        const answer = await service.ask(clientId, parsed.data.question)
        return NextResponse.json(answer)
    } catch (err) {
        console.error("[bi ask POST]", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
