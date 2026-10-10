import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function POST(request: Request) {
    try {
        const session = await auth()

        if (!session || !session.user || !session.user.id) {
            return NextResponse.json(
                { error: "No autorizado" },
                { status: 401 }
            )
        }

        const { subscription } = await request.json()

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
        }

        // Check if exists
        const existing = await prisma.pushSubscription.findFirst({
            where: {
                userId: session.user.id,
                endpoint: subscription.endpoint,
            }
        })

        if (!existing) {
            await prisma.pushSubscription.create({
                data: {
                    userId: session.user.id,
                    endpoint: subscription.endpoint,
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth
                }
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error saving push subscription:", error)
        return NextResponse.json(
            { error: "Error interno" },
            { status: 500 }
        )
    }
}
