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
    const { firstName, lastName, phone, licenseNo, carrierId, isActive } = body

    // Validate carrier if changing
    if (carrierId) {
        const carrier = await prisma.carrier.findFirst({
            where: { id: carrierId, clientId: session.user.clientId }
        })
        if (!carrier) {
            return NextResponse.json({ error: "Transportista no encontrado" }, { status: 400 })
        }
    }

    const driver = await prisma.driver.updateMany({
        where: { id, clientId: session.user.clientId },
        data: {
            ...(firstName !== undefined && { firstName: firstName.trim() }),
            ...(lastName !== undefined && { lastName: lastName.trim() }),
            ...(phone !== undefined && { phone: phone?.trim() || null }),
            ...(licenseNo !== undefined && { licenseNo: licenseNo?.trim() || null }),
            ...(carrierId !== undefined && { carrierId: carrierId || null }),
            ...(isActive !== undefined && { isActive }),
        },
    })

    if (driver.count === 0) {
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

    const orderCount = await prisma.deliveryOrder.count({
        where: { driverId: id, clientId: session.user.clientId }
    })

    if (orderCount > 0) {
        await prisma.driver.updateMany({
            where: { id, clientId: session.user.clientId },
            data: { isActive: false },
        })
        return NextResponse.json({ success: true, deactivated: true })
    }

    await prisma.driver.deleteMany({
        where: { id, clientId: session.user.clientId },
    })

    return NextResponse.json({ success: true })
}
