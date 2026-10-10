import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { sendEmail, EMAIL_SENDERS } from "@/lib/mail"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { type = "PASSWORD_RESET", sendEmailToUser = false } = body

    if (!["PASSWORD_RESET", "ACCOUNT_VERIFICATION"].includes(type)) {
      return NextResponse.json({ error: "Tipo de token inválido" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    // Invalidate previous tokens of same type for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: id, usedAt: null, type },
      data: { usedAt: new Date() },
    })

    // Create token — expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const record = await prisma.passwordResetToken.create({
      data: {
        userId: id,
        type,
        expiresAt,
        createdBy: session.user.id,
      },
    })

    // Always use the request origin so the link points to the exact deployment
    // the admin is using — never rely on NEXTAUTH_URL which may point elsewhere.
    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`
    const url = `${baseUrl}/auth/reset-password?token=${record.token}`

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        action: "ADMIN_GENERATE_RESET_LINK",
        entity: "User",
        entityId: id,
        changes: JSON.stringify({
          type,
          targetUserEmail: user.email,
          targetUserName: user.name,
          expiresAt: expiresAt.toISOString(),
          sendEmailToUser,
        }),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    if (sendEmailToUser) {
      const isVerification = type === "ACCOUNT_VERIFICATION"
      await sendEmail({
        to: user.email,
        from: EMAIL_SENDERS.recovery,
        subject: isVerification
          ? "Verifica tu cuenta — PlentyPay"
          : "Restablecer tu contraseña — PlentyPay",
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #1e40af;">${isVerification ? "Verifica tu cuenta" : "Restablecer contraseña"}</h2>
            <p>Hola ${user.name},</p>
            <p>${
              isVerification
                ? "Un administrador ha generado un enlace de verificación para tu cuenta en PlentyPay."
                : "Un administrador ha generado un enlace para que puedas restablecer la contraseña de tu cuenta en PlentyPay."
            }</p>
            <p>Haz clic en el siguiente enlace. Expira en <strong>24 horas</strong>.</p>
            <a href="${url}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
              ${isVerification ? "Verificar cuenta" : "Restablecer contraseña"}
            </a>
            <p style="color:#6b7280;font-size:12px;">O copia este enlace en tu navegador:<br>${url}</p>
          </div>
        `,
      })
    }

    return NextResponse.json({ url, expiresAt: expiresAt.toISOString() })
  } catch (error) {
    console.error("[GENERATE_RESET_LINK_ERROR]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
