import { NextRequest, NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"
import { sendEmail, EMAIL_SENDERS } from "@/lib/mail"
import { registrationReceivedEmail, adminNewRegistrationEmail } from "@/lib/email-templates/transactional"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }

    // 1. Buscar el token
    const verificationToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { include: { client: true } } }
    })

    if (!verificationToken || verificationToken.type !== "ACCOUNT_VERIFICATION" || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 404 })
    }

    const { user } = verificationToken

    // 2. Marcar usuario y token como verificados/usados
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() }
      }),
      prisma.passwordResetToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() }
      })
    ])

    // 3. Enviar correo de "Registro Recibido" al usuario
    await sendEmail({
      to: user.email,
      from: EMAIL_SENDERS.notifications,
      subject: "Correo verificado exitosamente — PlentyPay",
      html: registrationReceivedEmail(user.name || "Cliente")
    })

    // 4. Enviar notificación al administrador
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM
    if (adminEmail) {
      const companyLabel = user.client?.name?.trim() || "Sin organización"

      await sendEmail({
        to: adminEmail,
        from: EMAIL_SENDERS.notifications,
        subject: `[PlentyPay] Nueva Solicitud de Registro: ${companyLabel}`,
        html: adminNewRegistrationEmail({
          companyName: companyLabel,
          name: user.name || "N/A",
          email: user.email,
        }),
      })
    }

    // 5. Redirigir a una página de éxito (que consumiremos en el frontend)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
    return NextResponse.redirect(`${baseUrl}/auth/verify-email?success=true`)

  } catch (error) {
    console.error("[VERIFY_EMAIL_ERROR]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
