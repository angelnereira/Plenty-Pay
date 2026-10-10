import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session || !session.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        const { id } = await params

        const kioskSession = await prisma.kioskSession.findUnique({
            where: { id },
            select: {
                status: true,
                employeeId: true
            }
        })

        if (!kioskSession) {
            return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })
        }

        let employeeName = null
        if (kioskSession.employeeId) {
            const employee = await prisma.paydayEmployee.findUnique({
                where: { id: kioskSession.employeeId },
                select: { firstName: true, lastName: true }
            })
            if (employee) {
                employeeName = `${employee.firstName} ${employee.lastName}`
            }
        }

        return NextResponse.json({
            status: kioskSession.status,
            employeeName
        })

    } catch (error) {
        console.error("[KIOSK_SESSION_STATUS] Error:", error)
        return NextResponse.json(
            { error: "Error al consultar estado" },
            { status: 500 }
        )
    }
}
