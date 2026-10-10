import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { sendEmail } from "@/lib/mail"
import { welcomeTemplate, getCrossSellModules } from "@/lib/email-templates/welcome"
import { z } from "zod"
import { isAddonIncludedInPlan, type PlanType } from "@/lib/constants/plans"

// Schema: el SUPER_ADMIN aprueba la cuenta y elige qué addons activar.
// Cualquier flag del catálogo es opcional; lo que no venga queda en false.
// Si modules.creditos es true, creditTier es obligatorio.
const approveSchema = z.object({
    clientId: z.string(),
    modules: z.object({
        facturacion:    z.boolean().optional().default(false),
        inventory:      z.boolean().optional().default(false),
        pos:            z.boolean().optional().default(false),
        payday:         z.boolean().optional().default(false),
        logistics:      z.boolean().optional().default(false),
        creditos:       z.boolean().optional().default(false),
        apiAccess:      z.boolean().optional().default(false),
        whatsapp:       z.boolean().optional().default(false),
        premiumSupport: z.boolean().optional().default(false),
    }),
    creditTier:    z.enum(["TIER_1", "TIER_2", "TIER_3"]).optional(),
    extraBranches: z.number().int().min(0).optional().default(0),
})

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const validation = approveSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            )
        }

        const { clientId, modules, creditTier, extraBranches } = validation.data

        // Si activan créditos, el tier es obligatorio.
        if (modules.creditos && !creditTier) {
            return NextResponse.json(
                { error: "Para activar Créditos debes elegir un tier (TIER_1/2/3)" },
                { status: 400 }
            )
        }

        // Cargamos el cliente para conocer su plan (afecta qué addons se
        // consideran incluidos automáticamente).
        const existing = await prisma.client.findUnique({
            where: { id: clientId },
            select: { planType: true },
        })
        if (!existing) {
            return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
        }
        const planType = (existing.planType as PlanType) ?? "START"

        // Construir updateData iterando catálogo. Para addons del catálogo
        // que tienen flagField, lo activamos según el toggle. Si el plan
        // los incluye, también los activamos sí o sí (ENTERPRISE).
        const updateData: Record<string, unknown> = {
            approvalStatus: "APPROVED",
            isActive: true,
            pendingModules: [],
            facturacionEnabled: modules.facturacion,
            inventoryEnabled:   modules.inventory,
            posEnabled:         modules.pos,
            paydayEnabled:      modules.payday,
            logisticsEnabled:   modules.logistics  || isAddonIncludedInPlan(planType, "logistics"),
            creditosEnabled:    modules.creditos,
            apiAccessEnabled:   modules.apiAccess  || isAddonIncludedInPlan(planType, "apiAccess"),
            whatsappEnabled:        modules.whatsapp,
            premiumSupportEnabled:  modules.premiumSupport,
            extraBranches:      extraBranches,
        }
        if (modules.creditos && creditTier) {
            updateData.motorCreditTier = creditTier
        } else if (!modules.creditos) {
            updateData.motorCreditTier = null
        }

        const result = await prisma.$transaction(async (tx) => {
            // Update client: approve and activate modules
            const client = await tx.client.update({
                where: { id: clientId },
                data: updateData,
                include: {
                    users: {
                        where: { role: "CLIENT" },
                        select: { id: true, name: true, email: true, status: true },
                    }
                }
            })

            // Activate all users for this client and set status to ACTIVE
            await tx.user.updateMany({
                where: {
                    clientId,
                    role: "CLIENT",
                },
                data: {
                    status: "ACTIVE",
                    isActive: true,
                },
            })

            // Audit log
            await tx.auditLog.create({
                data: {
                    userId: session.user!.id,
                    userEmail: session.user!.email!,
                    action: "APPROVE_CLIENT",
                    entity: "Client",
                    entityId: clientId,
                    changes: JSON.stringify({
                        approvalStatus: "APPROVED",
                        modules,
                        creditTier: creditTier ?? null,
                        extraBranches,
                        usersActivated: client.users.length,
                    }),
                    ip: request.headers.get("x-forwarded-for") || "unknown",
                    userAgent: request.headers.get("user-agent") || "unknown",
                },
            })

            return client
        })

        // Send welcome email to all users with cross-selling
        const activeModules: string[] = []
        if (modules.inventory) activeModules.push("inventory")
        if (modules.pos) activeModules.push("pos")
        if (modules.payday) activeModules.push("payday")
        if (updateData.logisticsEnabled) activeModules.push("logistics")
        const crossSellModules = getCrossSellModules(activeModules)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://plentypay.com"

        const emailErrors: string[] = []
        for (const user of result.users) {
            const html = welcomeTemplate({
                userName: user.name || "Usuario",
                companyName: result.name,
                loginUrl: `${baseUrl}/auth/signin`,
                activeModules,
                availableModules: crossSellModules,
            })

            const emailResult = await sendEmail({
                to: user.email,
                subject: "Tu cuenta ha sido aprobada - PlentyPay",
                html,
            })

            if (!emailResult.success) {
                console.error(`[APPROVE] Failed to send welcome email to ${user.email}:`, emailResult.error)
                emailErrors.push(user.email)
            }
        }

        return NextResponse.json({
            success: true,
            client: result,
            ...(emailErrors.length > 0 && {
                warning: `La organización fue aprobada pero no se pudo enviar el correo a: ${emailErrors.join(', ')}. Verifique la configuración de correos.`,
            }),
        })
    } catch (error) {
        console.error("Error approving client:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
