import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function POST(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 })
        }

        const { requestId } = await request.json()

        await prisma.upgradeRequest.update({
            where: { id: requestId },
            data: {
                status: "REJECTED",
                processedAt: new Date(),
                processedBy: session.user.id
            }
        })

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error("[REJECT_UPGRADE] Error:", error)
        return NextResponse.json({ error: error?.message || "Error" }, { status: 500 })
    }
}
