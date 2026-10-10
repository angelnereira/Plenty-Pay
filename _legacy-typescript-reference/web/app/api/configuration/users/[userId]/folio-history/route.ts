import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth()

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const { userId } = await params

    // Verificar que el usuario existe
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        clientId: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    // Solo SUPER_ADMIN puede ver historial de cualquier usuario
    // ORG_ADMIN solo puede ver usuarios de su organización
    const isSuperAdmin = session.user.role === "SUPER_ADMIN"
    const isOrgAdmin = session.user.role === "CLIENT"

    if (!isSuperAdmin && !isOrgAdmin) {
      // Los usuarios normales solo pueden ver su propio historial
      if (session.user.id !== userId) {
        return NextResponse.json(
          { error: "No tienes permisos para ver este historial" },
          { status: 403 }
        )
      }
    }

    if (isOrgAdmin && targetUser.clientId !== session.user.clientId) {
      return NextResponse.json(
        { error: "No puedes ver el historial de usuarios de otra organización" },
        { status: 403 }
      )
    }

    if (!targetUser.clientId) {
      return NextResponse.json({
        history: [],
        summary: {
          totalAssigned: 0,
          totalConsumed: 0,
          totalAvailable: 0,
          totalSpent: 0,
        },
      })
    }

    // Obtener historial de asignaciones de folios para la organización del usuario
    const folioAssignments = await prisma.folioAssignment.findMany({
      where: {
        clientId: targetUser.clientId,
      },
      orderBy: {
        assignedAt: "desc",
      },
      select: {
        id: true,
        assignedAmount: true,
        consumedAmount: true,
        assignedAt: true,
        folioPool: {
          select: {
            batchNumber: true,
            provider: true,
          },
        },
      },
    })

    // Calcular resumen
    const summary = {
      totalAssigned: folioAssignments.reduce((sum, item) => sum + item.assignedAmount, 0),
      totalConsumed: folioAssignments.reduce((sum, item) => sum + item.consumedAmount, 0),
      totalAvailable: 0,
      totalSpent: 0,
    }

    summary.totalAvailable = summary.totalAssigned - summary.totalConsumed
    summary.totalSpent = summary.totalAssigned * 0.06 // Precio promedio de 6 centavos

    return NextResponse.json({
      history: folioAssignments.map((item) => ({
        id: item.id,
        assignedAmount: item.assignedAmount,
        consumedAmount: item.consumedAmount,
        assignedAt: item.assignedAt,
        batchNumber: item.folioPool.batchNumber,
        provider: item.folioPool.provider,
      })),
      summary,
    })
  } catch (error) {
    console.error("[API] Error al obtener historial de folios:", error)
    return NextResponse.json(
      { error: "Error al obtener historial de folios" },
      { status: 500 }
    )
  }
}

