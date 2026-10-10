import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import type { MotorCreditTier } from "@prisma/client"

export async function POST(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id || !session?.user?.clientId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        const body = await request.json()
        const {
            requestedPlan,
            requestedModules,
            requestedCreditTier,
            requestedApiAccess,
            requestedExtraBranches,
            extraUsers,
            extraPosStations,
            message,
        } = body as {
            requestedPlan?: string | null
            requestedModules?: string[]
            requestedCreditTier?: MotorCreditTier | null
            requestedApiAccess?: boolean | null
            requestedExtraBranches?: number
            extraUsers?: number
            extraPosStations?: number
            message?: string
        }

        const client = await prisma.client.findUnique({
            where: { id: session.user.clientId },
            select: { planType: true, name: true, creditosEnabled: true },
        })

        if (!client) {
            return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
        }

        // Validación: requestedCreditTier es válido si:
        //   (a) requestedModules incluye "creditos" (alta del módulo), o
        //   (b) el cliente YA tiene Créditos activo (cambio de tier).
        // El bug previo ignoraba el caso (b) y rechazaba a clientes que solo
        // querían cambiar TIER_1 → TIER_2.
        if (requestedCreditTier) {
            const requestingCreditos = (requestedModules ?? []).includes("creditos")
            if (!requestingCreditos && !client.creditosEnabled) {
                return NextResponse.json(
                    { error: "requestedCreditTier solo válido si solicitas o ya tienes el módulo de Créditos" },
                    { status: 400 }
                )
            }
        }

        const created = await prisma.upgradeRequest.create({
            data: {
                clientId: session.user.clientId,
                userId: session.user.id,
                currentPlan: client.planType,
                requestedPlan: requestedPlan || null,
                requestedModules: requestedModules || [],
                requestedCreditTier: requestedCreditTier ?? null,
                requestedApiAccess: requestedApiAccess ?? null,
                requestedExtraBranches: requestedExtraBranches ?? 0,
                extraUsers: extraUsers || 0,
                extraPosStations: extraPosStations || 0,
                message: message || null,
                status: "PENDING",
            },
        })

        return NextResponse.json({
            success: true,
            id: created.id,
            message: "Solicitud enviada correctamente",
        })
    } catch (error: unknown) {
        console.error("[UPGRADE_REQUEST] Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error al procesar" },
            { status: 500 }
        )
    }
}
