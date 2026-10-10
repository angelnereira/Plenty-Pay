import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { clientId, userId, quantity, price, notes } = body

    // Validar campos
    if (!clientId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      )
    }

    // Verificar que la organización existe
    const organization = await prisma.client.findUnique({
      where: { id: clientId },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organización no encontrada" },
        { status: 404 }
      )
    }

    // Verificar que el usuario existe si se proporcionó
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        )
      }
    }

    // Crear o actualizar FolioAssignment
    // Primero buscar si existe un pool activo
    let folioPool = await prisma.folioPool.findFirst({
      where: {
        provider: "HKA",
        availableFolios: { gt: 0 },
      },
      orderBy: {
        purchaseDate: "desc",
      },
    })

    // Si no existe pool, crear uno nuevo
    if (!folioPool) {
      folioPool = await prisma.folioPool.create({
        data: {
          batchNumber: `BATCH-${Date.now()}`,
          provider: "HKA",
          totalFolios: quantity,
          availableFolios: quantity,
          assignedFolios: 0,
          consumedFolios: 0,
          purchaseAmount: (price || 0.06) * quantity,
          purchaseDate: new Date(),
        },
      })
    }

    // Crear FolioAssignment para la organización
    await prisma.folioAssignment.create({
      data: {
        folioPoolId: folioPool.id,
        clientId,
        assignedAmount: quantity,
        consumedAmount: 0,
        alertThreshold: 10,
      },
    })

    // Actualizar el pool
    await prisma.folioPool.update({
      where: { id: folioPool.id },
      data: {
        availableFolios: { decrement: quantity },
        assignedFolios: { increment: quantity },
      },
    })

    // TODO: Crear registro en AuditLog
    // TODO: Crear notificación para la organización

    return NextResponse.json({
      success: true,
      message: `${quantity} folios asignados correctamente`,
      data: {
        quantity,
        clientId,
        userId,
        totalCost: (price || 0.06) * quantity,
      },
    })
  } catch (error) {
    console.error("Error al asignar folios:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

