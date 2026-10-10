import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, clientId: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    if (user.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No se puede eliminar un Super Admin" },
        { status: 400 }
      )
    }

    // Desactivar el usuario (soft delete) para preservar datos fiscales
    // Invalidar sesiones activas y registrar audit log en transacción
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          isActive: false,
          status: "DEACTIVATED",
        },
      })

      // Revocar todas las sesiones activas del usuario
      await tx.session.deleteMany({
        where: { userId: id },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user!.id,
          userEmail: session.user!.email!,
          action: "DELETE_USER",
          entity: "User",
          entityId: id,
          changes: JSON.stringify({
            name: user.name,
            email: user.email,
            clientId: user.clientId,
            softDelete: true,
          }),
          ip: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: "Usuario desactivado correctamente",
    })
  } catch (error) {
    console.error("Error al eliminar usuario:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
