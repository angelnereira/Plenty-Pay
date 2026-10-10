import { NextResponse } from "next/server"
import { z } from "zod"
import { compare, hash } from "bcryptjs"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es obligatoria"),
  newPassword: z
    .string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña no puede superar 72 caracteres"),
  confirmPassword: z.string().min(1, "Confirma tu nueva contraseña"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = changePasswordSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const isCurrentValid = await compare(data.currentPassword, user.password)
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "La contraseña actual es incorrecta" },
        { status: 400 }
      )
    }

    const hashedPassword = await hash(data.newPassword, 10)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { password: hashedPassword },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          userEmail: session.user.email ?? undefined,
          action: "PASSWORD_CHANGED",
          entity: "User",
          entityId: session.user.id,
          ip: request.headers.get("x-forwarded-for") ?? undefined,
          userAgent: request.headers.get("user-agent") ?? undefined,
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.issues },
        { status: 400 }
      )
    }
    console.error("[API] Error cambiando contraseña:", error)
    return NextResponse.json(
      { error: "No se pudo cambiar la contraseña" },
      { status: 500 }
    )
  }
}
