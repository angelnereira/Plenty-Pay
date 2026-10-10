import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.clientId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { name, ruc, phone, email, isActive } = body

    const carrier = await prisma.carrier.updateMany({
        where: { id, clientId: session.user.clientId },
        data: {
            ...(name !== undefined && { name: name.trim() }),
            ...(ruc !== undefined && { ruc: ruc?.trim() || null }),
            ...(phone !== undefined && { phone: phone?.trim() || null }),
            ...(email !== undefined && { email: email?.trim() || null }),
            ...(isActive !== undefined && { isActive }),
        },
    })

    if (carrier.count === 0) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.clientId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check if carrier has orders
    const orderCount = await prisma.deliveryOrder.count({
        where: { carrierId: id, clientId: session.user.clientId }
    })

    if (orderCount > 0) {
        // Soft delete - just deactivate
        await prisma.carrier.updateMany({
            where: { id, clientId: session.user.clientId },
            data: { isActive: false },
        })
        return NextResponse.json({ success: true, deactivated: true })
    }

    await prisma.carrier.deleteMany({
        where: { id, clientId: session.user.clientId },
    })

    return NextResponse.json({ success: true })
}
