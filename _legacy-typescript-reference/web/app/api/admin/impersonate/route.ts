import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { createImpersonationToken } from "@core/auth/impersonation"

export async function POST(request: NextRequest) {
    try {
        const session = await auth()

        // Verificar permisos de Super Admin
        if (!session?.user || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json(
                { error: "No autorizado" },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { userId } = body

        if (!userId) {
            return NextResponse.json(
                { error: "User ID requerido" },
                { status: 400 }
            )
        }

        // Verificar que el usuario existe
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!targetUser) {
            return NextResponse.json(
                { error: "Usuario no encontrado" },
                { status: 404 }
            )
        }

        // Generar token de suplantación firmado con HMAC-SHA256
        // Compatible con verifyImpersonationToken() en auth.config.ts
        const token = await createImpersonationToken(userId, session.user.id)

        // Registrar impersonación en audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userEmail: session.user.email || undefined,
                action: "USER_IMPERSONATE",
                entity: "User",
                entityId: userId,
                changes: JSON.stringify({
                    adminId: session.user.id,
                    adminEmail: session.user.email,
                    targetUserId: userId,
                    targetUserEmail: targetUser.email,
                    targetUserName: targetUser.name,
                }),
                ip: request.headers.get("x-forwarded-for") || undefined,
                userAgent: request.headers.get("user-agent") || undefined,
            },
        })

        // Retornar URL de redirección
        return NextResponse.json({
            redirectUrl: `/auth/impersonate?token=${token}`,
        })
    } catch (error) {
        console.error("[IMPERSONATE_ERROR]", error)
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        )
    }
}
