import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { NextRequest, NextResponse } from "next/server"

export type LogisticsDefaults = {
    // Transporte
    defaultCarrierId?: string | null
    defaultDriverId?: string | null
    defaultVehiclePlate?: string
    defaultInsurancePolicy?: string
    // Condiciones
    defaultShippingMode?: string
    defaultIncoterm?: string
    defaultPackaging?: string
    defaultPriority?: string
    defaultControlledTemp?: boolean
    defaultHazardousMat?: boolean
    // Emisor / Remitente
    senderName?: string
    senderPhone?: string
    senderAddress?: string
    // Notas
    defaultNotes?: string
}

const METADATA_KEY = "logisticsDefaults"

export async function GET() {
    const session = await auth()
    if (!session?.user?.clientId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const client = await prisma.client.findUnique({
        where: { id: session.user.clientId },
        select: { metadata: true },
    })

    const metadata = (client?.metadata as Record<string, unknown>) || {}
    const defaults = (metadata[METADATA_KEY] as LogisticsDefaults) || {}

    return NextResponse.json(defaults)
}

export async function PUT(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.clientId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: LogisticsDefaults = await req.json()

    // Get current metadata to merge
    const client = await prisma.client.findUnique({
        where: { id: session.user.clientId },
        select: { metadata: true },
    })

    const currentMetadata = (client?.metadata as Record<string, unknown>) || {}

    await prisma.client.update({
        where: { id: session.user.clientId },
        data: {
            metadata: {
                ...currentMetadata,
                [METADATA_KEY]: body,
            },
        },
    })

    return NextResponse.json({ success: true })
}
