import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { sendEmail } from "@/lib/mail"
import { z } from "zod"

const rejectSchema = z.object({
    clientId: z.string(),
    reason: z.string().min(3),
})

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const validation = rejectSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 })
        }

        const { clientId, reason } = validation.data

        // Update Client (REJECTED) with audit log
        const result = await prisma.$transaction(async (tx) => {
            const client = await tx.client.update({
                where: { id: clientId },
                data: {
                    approvalStatus: "REJECTED",
                    isActive: false,
                    suspendReason: `Rechazado en registro: ${reason}`
                },
                include: {
                    users: {
                        where: { role: "CLIENT" },
                        take: 1
                    }
                }
            })

            // Deactivate users
            await tx.user.updateMany({
                where: { clientId, role: "CLIENT" },
                data: { status: "DEACTIVATED", isActive: false },
            })

            // Audit log
            await tx.auditLog.create({
                data: {
                    userId: session.user!.id,
                    userEmail: session.user!.email!,
                    action: "REJECT_CLIENT",
                    entity: "Client",
                    entityId: clientId,
                    changes: JSON.stringify({ reason, clientName: client.name }),
                    ip: request.headers.get("x-forwarded-for") || "unknown",
                    userAgent: request.headers.get("user-agent") || "unknown",
                },
            })

            return client
        })

        const user = result.users[0]

        if (user && user.email) {
            // 2. Send Rejection Email
            await sendEmail({
                to: user.email,
                subject: "Actualización sobre tu solicitud en PlentyPay",
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #ef4444;">Solicitud Rechazada</h1>
                        <p>Lamentamos informarte que tu solicitud de registro para <strong>${result.name}</strong> no ha sido aprobada en este momento.</p>
                        
                        <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fca5a5; color: #991b1b;">
                            <p style="margin: 0;"><strong>Motivo:</strong></p>
                            <p style="margin-top: 5px;">${reason}</p>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
                            Si crees que esto es un error o deseas corregir la información, por favor responde a este correo.
                        </p>
                    </div>
                `
            })
        }

        return NextResponse.json({ success: true, client: result })
    } catch (error) {
        console.error("Error rejecting client:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
