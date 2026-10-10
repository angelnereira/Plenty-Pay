import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.clientId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const carrierId = req.nextUrl.searchParams.get("carrierId")

    const drivers = await prisma.driver.findMany({
        where: {
            clientId: session.user.clientId,
            ...(carrierId && { carrierId }),
        },
        include: {
            carrier: { select: { name: true } },
            _count: { select: { deliveryOrders: true } },
        },
        orderBy: { firstName: "asc" },
    })

    return NextResponse.json(drivers)
}

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.clientId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { firstName, lastName, phone, licenseNo, carrierId } = body

    if (!firstName?.trim() || !lastName?.trim()) {
        return NextResponse.json({ error: "Nombre y apellido son requeridos" }, { status: 400 })
    }

    // Validate carrier belongs to same client if provided
    if (carrierId) {
        const carrier = await prisma.carrier.findFirst({
            where: { id: carrierId, clientId: session.user.clientId }
        })
        if (!carrier) {
            return NextResponse.json({ error: "Transportista no encontrado" }, { status: 400 })
        }
    }

    const driver = await prisma.driver.create({
        data: {
            clientId: session.user.clientId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone?.trim() || null,
            licenseNo: licenseNo?.trim() || null,
            carrierId: carrierId || null,
        },
    })

    return NextResponse.json(driver, { status: 201 })
}
