import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { NextResponse } from "next/server"

/**
 * PATCH /api/notifications/[id]/read
 * Marca una notificación como leída
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const { id } = await params
    const userId = session.user.id

    // Verificar que la notificación pertenece al usuario
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!notification) {
      return NextResponse.json(
        { error: "Notificación no encontrada" },
        { status: 404 }
      )
    }

    // Marcar como leída
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error("[API] Error al marcar notificación como leída:", error)
    return NextResponse.json(
      { error: "Error al actualizar notificación" },
      { status: 500 }
    )
  }
}

