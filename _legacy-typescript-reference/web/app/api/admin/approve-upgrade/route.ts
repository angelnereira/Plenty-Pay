import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { PLAN_CONFIG, ADDON_CATALOG, isAddonIncludedInPlan, type PlanType, type AddonId } from "@/lib/constants/plans"
import { assertCanChangeTier } from "@/lib/motor/pricing"
import type { MotorCreditTier } from "@prisma/client"

const PLAN_LIMITS: Record<string, { users: number; pos: number; branches: number }> = Object.fromEntries(
    Object.entries(PLAN_CONFIG).map(([key, cfg]) => [key, {
        users: cfg.maxUsers,
        pos: cfg.maxPosStations,
        branches: cfg.maxBranches,
    }])
)

const ADDON_TO_FLAG: Partial<Record<AddonId, string>> = Object.fromEntries(
    Object.entries(ADDON_CATALOG)
        .filter(([, spec]) => spec.flagField)
        .map(([id, spec]) => [id, spec.flagField as string])
)

export async function POST(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 })
        }

        const body = await request.json()
        const {
            requestId,
            clientId,
            requestedPlan,
            requestedModules,
            requestedCreditTier,
            requestedApiAccess,
            requestedExtraBranches,
            extraUsers,
            extraPosStations,
        } = body as {
            requestId: string
            clientId: string
            requestedPlan?: string | null
            requestedModules?: string[]
            requestedCreditTier?: MotorCreditTier | null
            requestedApiAccess?: boolean | null
            requestedExtraBranches?: number
            extraUsers?: number
            extraPosStations?: number
        }

        const client = await prisma.client.findUnique({ where: { id: clientId } })
        if (!client) {
            return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
        }

        const newPlan = (requestedPlan || client.planType) as PlanType
        const baseLimits = PLAN_LIMITS[newPlan] || PLAN_LIMITS.START

        // Si activan/cambian tier de créditos, validar contra el uso actual
        // (no se puede bajar a un tier cuyo límite ya está superado).
        if (requestedCreditTier) {
            try {
                await assertCanChangeTier(clientId, requestedCreditTier)
            } catch (e: unknown) {
                return NextResponse.json(
                    { error: e instanceof Error ? e.message : "No se puede aplicar el tier solicitado" },
                    { status: 400 }
                )
            }
        }

        const updateData: Record<string, unknown> = {
            planType: newPlan,
            maxUsers: baseLimits.users + (extraUsers || 0),
            maxPosStations: baseLimits.pos + (extraPosStations || 0),
            maxBranches: baseLimits.branches,
            extraBranches: requestedExtraBranches ?? client.extraBranches,
        }

        // Solo cambiamos approvalStatus si el cliente venía PENDING o PARTIAL.
        // Estados terminales (APPROVED, REJECTED) no se sobrescriben aquí.
        if (client.approvalStatus === "PENDING" || client.approvalStatus === "PARTIAL") {
            updateData.approvalStatus = "APPROVED"
        }

        // Activar addons según requestedModules + lo que el plan incluye.
        for (const addonId of Object.keys(ADDON_CATALOG) as AddonId[]) {
            const flag = ADDON_TO_FLAG[addonId]
            if (!flag) continue
            const requestedActive = requestedModules?.includes(addonId) ?? false
            const includedByPlan = isAddonIncludedInPlan(newPlan, addonId)
            if (requestedActive || includedByPlan) {
                updateData[flag] = true
            }
        }

        // API Access independiente: si requestedApiAccess llega explícito, respetarlo.
        if (requestedApiAccess !== undefined && requestedApiAccess !== null) {
            updateData.apiAccessEnabled = requestedApiAccess || isAddonIncludedInPlan(newPlan, "apiAccess")
        }

        // Tier de créditos: solo asignar si solicitan explícitamente o si el plan lo activa.
        if (requestedCreditTier) {
            updateData.motorCreditTier = requestedCreditTier
            updateData.creditosEnabled = true
        }

        await prisma.client.update({
            where: { id: clientId },
            data: updateData,
        })

        await prisma.upgradeRequest.update({
            where: { id: requestId },
            data: {
                status: "APPROVED",
                processedAt: new Date(),
                processedBy: session.user.id,
            },
        })

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error("[APPROVE_UPGRADE] Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error" },
            { status: 500 }
        )
    }
}
