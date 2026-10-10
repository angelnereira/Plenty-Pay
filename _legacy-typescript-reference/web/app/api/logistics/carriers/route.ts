import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.clientId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const carriers = await prisma.carrier.findMany({
        where: { clientId: session.user.clientId },
        include: {
            _count: { select: { drivers: true, deliveryOrders: true } }
        },
        orderBy: { name: "asc" },
    })

    return NextResponse.json(carriers)
}

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.clientId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, ruc, phone, email } = body

    if (!name?.trim()) {
        return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }

    const carrier = await prisma.carrier.create({
        data: {
            clientId: session.user.clientId,
            name: name.trim(),
            ruc: ruc?.trim() || null,
            phone: phone?.trim() || null,
            email: email?.trim() || null,
        },
    })

    return NextResponse.json(carrier, { status: 201 })
}
