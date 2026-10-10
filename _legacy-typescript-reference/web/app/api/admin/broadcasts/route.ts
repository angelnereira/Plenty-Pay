import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"

export async function POST(request: NextRequest) {
    try {
        const session = await auth()

        // Verificar que sea Super Admin
        if (!session?.user || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json(
                { error: "No autorizado" },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { title, message, type, targetAll, targetPlans } = body

        // Validar campos requeridos
        if (!title || !message) {
            return NextResponse.json(
                { error: "Título y mensaje son requeridos" },
                { status: 400 }
            )
        }

        // Crear broadcast
        const broadcast = await prisma.adminBroadcast.create({
            data: {
                title,
                message,
                type: type || "INFO",
                targetAll: targetAll !== false,
                targetPlans: targetPlans || [],
                createdBy: session.user.id,
            },
        })

        return NextResponse.json({
            success: true,
            data: broadcast,
        })
    } catch (error: any) {
        console.error("[ADMIN_BROADCAST_CREATE]", error)
        return NextResponse.json(
            { error: "Error al crear notificación" },
            { status: 500 }
        )
    }
}
