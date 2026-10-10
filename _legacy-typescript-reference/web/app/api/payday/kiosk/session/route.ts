import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session || !session.user || !session.user.clientId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        const body = await request.json()
        const { action } = body

        if (!action) {
            return NextResponse.json({ error: "Action is required" }, { status: 400 })
        }

        // Create new session valid for 5 minutes
        const kioskSession = await prisma.kioskSession.create({
            data: {
                clientId: session.user.clientId,
                action,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 mins
                status: "PENDING"
            }
        })

        return NextResponse.json({
            success: true,
            sessionId: kioskSession.id,
            expiresAt: kioskSession.expiresAt
        })

    } catch (error) {
        console.error("[KIOSK_SESSION] Create Error:", error)
        return NextResponse.json(
            { error: "Error al crear sesión de kiosco" },
            { status: 500 }
        )
    }
}
