import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        const body = await request.json()
        const { subject, description, category, priority, browserInfo, urlPath, errorLogId } = body

        if (!subject || !description) {
            return NextResponse.json({ error: "Asunto y descripción son requeridos" }, { status: 400 })
        }

        const ticket = await prisma.supportTicket.create({
            data: {
                userId: session.user.id,
                subject,
                description,
                category: category || "TECHNICAL",
                priority: priority || "MEDIUM",
                browserInfo,
                urlPath,
                errorLogId,
                status: "OPEN"
            }
        })

        // Enviar notificación a los admins (Podríamos usar el sistema de broadcast o email)
        // Por ahora lo dejamos en DB

        return NextResponse.json({ success: true, data: ticket })
    } catch (error: any) {
        console.error("[TICKET_CREATE_ERROR]", error)
        return NextResponse.json({ error: "Error al crear el ticket de soporte" }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        // Si es admin, ve todos. Si no, solo los suyos.
        const isAdmin = session.user.role === "SUPER_ADMIN"

        const tickets = await prisma.supportTicket.findMany({
            where: isAdmin ? {} : { userId: session.user.id },
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { name: true, email: true }
                }
            }
        })

        return NextResponse.json({ success: true, data: tickets })
    } catch (e) {
        return NextResponse.json({ error: "Error al obtener tickets" }, { status: 500 })
    }
}
